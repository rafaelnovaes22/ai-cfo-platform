import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/persistence/prisma.js";
import { signAccessToken, generateRefreshToken } from "@/auth/jwt.js";

const REFRESH_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

// Hash bcrypt fixo usado para igualar o tempo de resposta do login quando o
// usuário não existe — evita enumeração de usuários por timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("aicfo-timing-equalizer", BCRYPT_ROUNDS);

// E-mail é case-insensitive: normaliza no write e no read para que login e
// password-reset (que já normalizava) sejam consistentes.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
  phone?: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const db = getPrisma();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  try {
    const { user } = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        // phone só pré-preenche o destinatário; canal fica desabilitado até opt-in.
        data: { name: data.tenantName, cnpj: data.cnpj, whatsappPhone: data.phone },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizeEmail(data.email),
          passwordHash,
          name: data.name,
          role: "admin",
        },
      });

      await tx.subscription.create({
        data: { tenantId: tenant.id, plan: "trial", mode: "assisted", status: "active" },
      });

      return { tenant, user };
    });

    return issueTokens(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Mapear a constraint violada para a mensagem correta (não assumir e-mail).
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(",")
        : String(err.meta?.target ?? "");
      if (target.includes("whatsappPhone")) {
        throw new AuthError("Número de WhatsApp já vinculado a outra conta", 409);
      }
      if (target.includes("cnpj")) {
        throw new AuthError("CNPJ já cadastrado", 409);
      }
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
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });

  // Sempre roda bcrypt (no hash dummy quando o usuário não existe) para que o
  // tempo de resposta não revele se o e-mail está cadastrado.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordOk) {
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

  // Rotação de refresh token: revoga a sessão atual e emite um token novo.
  // Sem isto, o mesmo refresh token valeria 30 dias mesmo após uso (reuso indevido).
  const newRefreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await db.$transaction([
    db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
    db.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(newRefreshToken),
        expiresAt,
      },
    }),
  ]);

  const accessToken = await signAccessToken({ sub: user.id, tid: user.tenantId, role: user.role });

  return { accessToken, refreshToken: newRefreshToken };
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
