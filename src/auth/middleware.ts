import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "@/auth/jwt.js";

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

  if (!header?.startsWith("Bearer ")) {
    await reply.status(401).send({ message: "Authorization header ausente" });
    return;
  }

  try {
    const payload = await verifyAccessToken(header.slice(7));
    req.auth = { userId: payload.sub, tenantId: payload.tid, role: payload.role };
  } catch {
    await reply.status(401).send({ message: "Token inválido ou expirado" });
  }
}

// Encadear após requireAuth: { preHandler: [requireAuth, requireRole("admin")] }
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      await reply.status(403).send({ message: "Permissão insuficiente" });
    }
  };
}
