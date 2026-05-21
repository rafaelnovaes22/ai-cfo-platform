import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/persistence/prisma.js";
import { sendEmail } from "@/observability/email.js";
import { logger } from "@/observability/logger.js";
import { AuthError } from "@/auth/service.js";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora
const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEqualsHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function buildResetUrl(token: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}/reset-password?token=${token}`;
}

function buildEmail(name: string, resetUrl: string): { subject: string; html: string; text: string } {
  const subject = "Redefinição de senha — Aicfo";
  const text = [
    `Olá ${name},`,
    "",
    "Recebemos um pedido para redefinir sua senha na Aicfo.",
    "Acesse o link abaixo para criar uma nova senha (válido por 1 hora):",
    "",
    resetUrl,
    "",
    "Se você não pediu isso, ignore este email — sua senha continua a mesma.",
    "",
    "— Aicfo",
  ].join("\n");
  const html = `
<p>Olá ${name},</p>
<p>Recebemos um pedido para redefinir sua senha na Aicfo.</p>
<p>Clique no link abaixo para criar uma nova senha (válido por 1 hora):</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>Se você não pediu isso, ignore este email — sua senha continua a mesma.</p>
<p>— Aicfo</p>
`.trim();
  return { subject, html, text };
}

// Sempre retorna sucesso ao caller para não vazar a existência de emails na base.
// O envio real só acontece se o user existir; o caller não consegue distinguir.
export async function requestPasswordReset(email: string): Promise<void> {
  const db = getPrisma();
  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalized } });

  if (!user) {
    logger.info({ email: normalized }, "Password reset solicitado para email inexistente");
    return;
  }

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
  });

  const resetUrl = buildResetUrl(rawToken);
  const { subject, html, text } = buildEmail(user.name, resetUrl);
  await sendEmail({ to: user.email, subject, html, text });
}

export async function confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new AuthError("Senha deve ter ao menos 8 caracteres", 400);
  }

  const db = getPrisma();
  const tokenHash = hashToken(rawToken);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) throw new AuthError("Token inválido", 400);
  // Comparação constant-time para defesa em profundidade (já indexamos por hash, então o lookup é O(log n))
  if (!constantTimeEqualsHex(record.tokenHash, tokenHash)) {
    throw new AuthError("Token inválido", 400);
  }
  if (record.usedAt !== null) throw new AuthError("Token já utilizado", 400);
  if (record.expiresAt < new Date()) throw new AuthError("Token expirado", 400);

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Revoga todas as sessões ativas — força re-login após reset.
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
