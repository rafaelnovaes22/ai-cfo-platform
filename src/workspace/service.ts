import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/persistence/prisma.js";
import { AuthError } from "@/auth/service.js";

export async function getProfile(tenantId: string) {
  const db = getPrisma();
  return db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
}

export async function updateProfile(
  tenantId: string,
  data: { name?: string; cnpj?: string; industrySegment?: string; taxRegime?: string },
) {
  const db = getPrisma();
  return db.tenant.update({ where: { id: tenantId }, data });
}

export async function listMembers(tenantId: string) {
  const db = getPrisma();
  return db.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, emailVerified: true, lastLoginAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function addMember(
  tenantId: string,
  data: { email: string; name: string; role: "admin" | "editor" | "viewer" },
): Promise<{ id: string; name: string; email: string; role: string; emailVerified: boolean; lastLoginAt: null; tempPassword: string }> {
  const db = getPrisma();

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AuthError("E-mail já cadastrado", 409);

  const tempPassword = randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await db.user.create({
    data: { tenantId, email: data.email, name: data.name, role: data.role, passwordHash },
    select: { id: true, name: true, email: true, role: true, emailVerified: true, lastLoginAt: true },
  });

  return { ...user, tempPassword };
}

export async function removeMember(tenantId: string, userId: string, requesterId: string): Promise<void> {
  if (userId === requesterId) throw new AuthError("Não é possível remover a si mesmo", 400);

  const db = getPrisma();
  const user = await db.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new AuthError("Membro não encontrado", 404);

  await db.user.delete({ where: { id: userId } });
}
