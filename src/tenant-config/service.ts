import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/persistence/prisma.js";
import { AuthError } from "@/auth/service.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── productConfig ──────────────────────────────────────────────────────────

export async function getConfig(tenantId: string) {
  const db = getPrisma();
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { productConfig: true },
  });
  return tenant.productConfig as Record<string, unknown>;
}

export async function updateConfig(tenantId: string, patch: Record<string, unknown>) {
  const db = getPrisma();
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { productConfig: true },
  });

  // Deep merge preservando chaves existentes não enviadas no patch
  const current = tenant.productConfig as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = { ...(current[key] as object ?? {}), ...(value as object) };
    } else {
      merged[key] = value;
    }
  }

  // Prisma exige InputJsonValue — merged é Record<string, unknown> serializável em JSON.
  await db.tenant.update({
    where: { id: tenantId },
    data: { productConfig: merged as object },
  });
  return merged;
}

// ── RBAC ───────────────────────────────────────────────────────────────────

export async function changeRole(
  tenantId: string,
  targetUserId: string,
  requesterId: string,
  role: "admin" | "editor" | "viewer",
) {
  if (targetUserId === requesterId) {
    throw new AuthError("Não é possível alterar seu próprio role", 400);
  }

  const db = getPrisma();
  const user = await db.user.findFirst({ where: { id: targetUserId, tenantId } });
  if (!user) throw new AuthError("Membro não encontrado", 404);

  return db.user.update({ where: { id: targetUserId }, data: { role } });
}

// ── API Tokens ─────────────────────────────────────────────────────────────

export async function listTokens(tenantId: string) {
  const db = getPrisma();
  return db.apiToken.findMany({
    where: { tenantId, revokedAt: null },
    select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createToken(
  tenantId: string,
  data: { name: string; scopes: string[]; expiresInDays?: number },
) {
  const db = getPrisma();
  const rawToken = `sap_${randomBytes(32).toString("hex")}`;

  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 86_400_000)
    : null;

  const record = await db.apiToken.create({
    data: {
      tenantId,
      name: data.name,
      tokenHash: hashToken(rawToken),
      scopes: data.scopes,
      expiresAt,
    },
    select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });

  return { ...record, token: rawToken }; // token exposto uma única vez
}

export async function revokeToken(tenantId: string, tokenId: string) {
  const db = getPrisma();
  const token = await db.apiToken.findFirst({ where: { id: tokenId, tenantId } });
  if (!token) throw new AuthError("Token não encontrado", 404);

  await db.apiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
}
