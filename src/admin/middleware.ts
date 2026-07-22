import type { FastifyRequest, FastifyReply } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { problemDetail } from "@/http/problem-detail.js";
import { logger } from "@/observability/logger.js";

// Middleware de admin interno: protege rotas /admin/* com uma chave fora-de-band
// (ADMIN_API_KEY env var). Não usa JWT nem contexto de tenant — é operacional,
// não de produto. Comparação em tempo constante para evitar timing attack.
export async function requireAdminKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    logger.error("ADMIN_API_KEY não configurada — rota admin bloqueada");
    await reply.status(503).send(
      problemDetail({
        type: "https://api.example.com/errors/admin-not-configured",
        title: "Admin desabilitado",
        status: 503,
        detail: "Chave administrativa não configurada no servidor.",
      }),
    );
    return;
  }

  const header = req.headers.authorization;
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!provided) {
    await reply.status(401).send(
      problemDetail({
        type: "https://api.example.com/errors/admin-unauthorized",
        title: "Não autenticado",
        status: 401,
        detail: "Authorization header ausente ou formato inválido.",
      }),
    );
    return;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn({ ip: req.ip, url: req.url }, "Tentativa de acesso admin com chave inválida");
    await reply.status(403).send(
      problemDetail({
        type: "https://api.example.com/errors/admin-forbidden",
        title: "Permissão insuficiente",
        status: 403,
        detail: "Chave administrativa inválida.",
      }),
    );
    return;
  }
}
