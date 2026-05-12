import { createHash } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "@/auth/jwt.js";
import { getPrisma } from "@/persistence/prisma.js";

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
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
    await reply.status(401).send({ message: "Authorization header ausente" });
    return;
  }

  // Bearer <JWT> — usuário humano
  if (header.startsWith("Bearer ")) {
    try {
      const payload = await verifyAccessToken(header.slice(7));
      req.auth = { userId: payload.sub, tenantId: payload.tid, role: payload.role };
    } catch {
      await reply.status(401).send({ message: "Token inválido ou expirado" });
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
      await reply.status(401).send({ message: "API token inválido ou expirado" });
      return;
    }

    await db.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } });
    req.auth = { userId: "api-token", tenantId: apiToken.tenantId, role: "api" };
    return;
  }

  await reply.status(401).send({ message: "Formato de Authorization inválido" });
}

// Encadear após requireAuth: { preHandler: [requireAuth, requireRole("admin")] }
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      await reply.status(403).send({ message: "Permissão insuficiente" });
    }
  };
}

// C4 — bloqueia mutações fora dos modos permitidos da subscription.
// Encadear após requireAuth: { preHandler: [requireAuth, requireMode("assisted")] }
export function requireMode(...allowedModes: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth) {
      await reply.status(401).send({ message: "Não autenticado" });
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
        type: "https://api.aicfo.com.br/errors/mode-not-allowed",
        title: "Operação não permitida no modo atual",
        status: 403,
        detail: `Esta operação requer modo ${allowedModes.join(" ou ")}; subscription está em ${mode}.`,
      });
    }
  };
}
