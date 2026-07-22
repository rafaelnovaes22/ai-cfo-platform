import { createHash } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "@/auth/jwt.js";
import { getPrisma } from "@/persistence/prisma.js";
import { problemDetail } from "@/http/problem-detail.js";
import { isSubscriber } from "@/auth/subscription-access.js";

// Respostas de erro padronizadas em ProblemDetail (RFC 7807) — o frontend lê
// `title`/`detail`, e as rotas que declaram defaultErrorResponses validam contra
// ProblemDetailSchema. Enviar { message } cru aqui causava 500 de serialização.
function sendUnauthorized(reply: FastifyReply, detail: string): Promise<void> {
  return reply.status(401).send(
    problemDetail({
      type: "https://api.example.com/errors/unauthorized",
      title: "Não autenticado",
      status: 401,
      detail,
    }),
  ) as unknown as Promise<void>;
}

function sendForbidden(reply: FastifyReply, detail: string): Promise<void> {
  return reply.status(403).send(
    problemDetail({
      type: "https://api.example.com/errors/forbidden",
      title: "Permissão insuficiente",
      status: 403,
      detail,
    }),
  ) as unknown as Promise<void>;
}

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
  // Tipo de credencial: "user" (JWT humano) ou "api_token" (token de integração).
  kind: "user" | "api_token";
  // Scopes carregados quando kind === "api_token". Para usuários humanos é null
  // (autorização vai por role via requireRole).
  scopes: string[] | null;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

// Usar como preHandler em rotas protegidas: { preHandler: [requireAuth] }
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;

  if (!header) {
    await sendUnauthorized(reply, "Authorization header ausente");
    return;
  }

  // Bearer <JWT> — usuário humano
  if (header.startsWith("Bearer ")) {
    try {
      const payload = await verifyAccessToken(header.slice(7));
      req.auth = {
        userId: payload.sub,
        tenantId: payload.tid,
        role: payload.role,
        kind: "user",
        scopes: null,
      };
    } catch {
      await sendUnauthorized(reply, "Token inválido ou expirado");
    }
    return;
  }

  // Token sap_<hex> — integração via API token (Onda 4+)
  if (header.startsWith("Token ")) {
    const rawToken = header.slice(6);
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const db = getPrisma();
    const apiToken = await db.apiToken.findUnique({ where: { tokenHash } });

    if (!apiToken || apiToken.revokedAt || (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
      await sendUnauthorized(reply, "API token inválido ou expirado");
      return;
    }

    await db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } });
    req.auth = {
      userId: "api-token",
      tenantId: apiToken.tenantId,
      role: "api",
      kind: "api_token",
      scopes: Array.isArray(apiToken.scopes) ? (apiToken.scopes as string[]) : [],
    };
    return;
  }

  await sendUnauthorized(reply, "Formato de Authorization inválido");
}

// Encadear após requireAuth: { preHandler: [requireAuth, requireRole("admin")] }
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      await sendForbidden(reply, `Operação requer role ${roles.join(" ou ")}.`);
    }
  };
}

/**
 * Enforcement real de scopes para API tokens.
 *
 * Para usuários humanos (kind === "user") esta verificação é PASSADA — autorização
 * de humano vai por role (use requireRole em série).
 *
 * Para API tokens (kind === "api_token") o request precisa ter PELO MENOS UM dos
 * scopes listados. Scopes seguem convenção `recurso:ação`:
 *   - `ingest:write`, `ingest:read`
 *   - `analyses:read`
 *   - `classification:read`, `classification:write`
 *   - `dre:read`
 *   - `action-plan:read`, `action-plan:write`
 *   - `export:read`
 *   - `hub:read`
 *
 * Scope `*` (wildcard) concede tudo — só use em integrações internas auditadas.
 *
 * Encadear após requireAuth:
 *   { preHandler: [requireAuth, requireScope("ingest:write")] }
 */
export function requireScope(...required: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth) {
      await sendUnauthorized(reply, "Não autenticado");
      return;
    }
    // Usuário humano não passa por scope — usa role.
    if (req.auth.kind === "user") return;

    const scopes = req.auth.scopes ?? [];
    if (scopes.includes("*")) return;
    const matched = required.some((s) => scopes.includes(s));
    if (!matched) {
      await reply.status(403).send(
        problemDetail({
          type: "https://api.example.com/errors/scope-missing",
          title: "Permissão insuficiente",
          status: 403,
          detail: `API token requer scope ${required.join(" ou ")}; possui [${scopes.join(", ")}].`,
        }),
      );
    }
  };
}

/**
 * Guard de MUTAÇÃO que cobre humanos E api tokens num único preHandler.
 *
 * - kind "user": exige uma das `roles` (viewer não muta).
 * - kind "api_token": exige um dos `scopes` (ou wildcard `*`).
 *
 * Necessário porque requireRole sozinho bloquearia api tokens (role "api"),
 * e requireScope sozinho deixa qualquer humano (inclusive viewer) passar.
 */
export function requireWrite(roles: string[], scopes: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth) {
      await sendUnauthorized(reply, "Não autenticado");
      return;
    }
    if (req.auth.kind === "user") {
      if (!roles.includes(req.auth.role)) {
        await sendForbidden(reply, `Operação requer role ${roles.join(" ou ")}.`);
      }
      return;
    }
    const s = req.auth.scopes ?? [];
    if (s.includes("*")) return;
    if (!scopes.some((x) => s.includes(x))) {
      await sendForbidden(reply, `API token requer scope ${scopes.join(" ou ")}.`);
    }
  };
}

/**
 * Gate de acesso ao app web: só assinante pago ativo passa. Lead (plan
 * student/trial) recebe 403 — a conta existe (lead capturado), mas o painel é
 * exclusivo de assinante. API tokens de integração passam (acesso programático
 * não é "site"). Encadear após requireAuth.
 */
export function requireSubscriber() {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth) {
      await sendUnauthorized(reply, "Não autenticado");
      return;
    }
    // Integrações (api_token) não passam pelo gate de "site".
    if (req.auth.kind === "api_token") return;

    const db = getPrisma();
    const subscription = await db.subscription.findUnique({
      where: { tenantId: req.auth.tenantId },
      select: { plan: true, status: true },
    });
    if (!isSubscriber(subscription?.plan, subscription?.status)) {
      await reply.status(403).send(
        problemDetail({
          type: "https://api.example.com/errors/subscriber-only",
          title: "Acesso exclusivo para assinantes",
          status: 403,
          detail: "O painel do Aicfo é exclusivo para assinantes. Sua conta foi registrada.",
        }),
      );
    }
  };
}

// C4 — bloqueia mutações fora dos modos permitidos da subscription.
// Encadear após requireAuth: { preHandler: [requireAuth, requireMode("assisted")] }
export function requireMode(...allowedModes: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth) {
      await sendUnauthorized(reply, "Não autenticado");
      return;
    }
    const db = getPrisma();
    const subscription = await db.subscription.findUnique({
      where: { tenantId: req.auth.tenantId },
      select: { mode: true },
    });
    const mode = subscription?.mode ?? "shadow";
    if (!allowedModes.includes(mode)) {
      await reply.status(403).send({
        type: "https://api.example.com/errors/mode-not-allowed",
        title: "Operação não permitida no modo atual",
        status: 403,
        detail: `Esta operação requer modo ${allowedModes.join(" ou ")}; subscription está em ${mode}.`,
      });
    }
  };
}
