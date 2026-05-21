import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/persistence/prisma.js";
import { signAccessToken, generateRefreshToken } from "@/auth/jwt.js";

const REFRESH_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

function hashRefreshToken(token: string): string {
  // SHA-256 para lookup por índice; bcrypt só para senhas (que não são indexáveis)
  return createHash("sha256").update(token).digest("hex");
}

export class AuthError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export async function register(data: {
  tenantName: string;
  cnpj?: string;
  email: string;
  password: string;
  name: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const db = getPrisma();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  try {
    const { user } = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.tenantName, cnpj: data.cnpj },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email,
          passwordHash,
          name: data.name,
          role: "admin",
        },
      });

      await tx.subscription.create({
        data: { tenantId: tenant.id, plan: "trial", mode: "shadow", status: "active" },
      });

      return { tenant, user };
    });

    return issueTokens(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AuthError("E-mail já cadastrado", 409);
    }
    throw err;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const db = getPrisma();
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError("Credenciais inválidas");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return issueTokens(user);
}

export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const db = getPrisma();
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await db.session.findUnique({ where: { refreshTokenHash: tokenHash } });

  if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
    throw new AuthError("Sessão inválida ou expirada");
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
  const accessToken = await signAccessToken({ sub: user.id, tid: user.tenantId, role: user.role });

  return { accessToken, refreshToken };
}

export async function logout(refreshToken: string): Promise<void> {
  const db = getPrisma();
  const tokenHash = hashRefreshToken(refreshToken);

  await db.session.updateMany({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function issueTokens(user: {
  id: string;
  tenantId: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const db = getPrisma();
  const refreshToken = generateRefreshToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await db.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({ sub: user.id, tid: user.tenantId, role: user.role });
  return { accessToken, refreshToken };
}
