import { logger } from "@/observability/logger.js";

// Email transacional — adapter C7. Resend é o provider; fallback é log-only em dev.
// Único lugar do código que deve importar SDK de email; resto consome `sendEmail`.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = {
  delivered: boolean;
  provider: "resend" | "log-only";
  messageId?: string;
};

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Aicfo <no-reply@aicfo.app>";

async function sendViaResend(msg: EmailMessage): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, "Resend rejeitou envio");
    throw new Error(`Resend failed: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string };
  return { delivered: true, provider: "resend", messageId: data.id };
}

function sendViaLog(msg: EmailMessage): SendResult {
  // Em dev sem RESEND_API_KEY o link cai no log — facilita iteração local.
  // Production sem chave é configuração inválida; o caller deve checar.
  logger.warn(
    { to: msg.to, subject: msg.subject, body: msg.text },
    "Email não enviado — RESEND_API_KEY ausente (modo log-only)",
  );
  return { delivered: false, provider: "log-only" };
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (!RESEND_API_KEY) return sendViaLog(msg);
  try {
    return await sendViaResend(msg);
  } catch (err) {
    logger.error({ err, to: msg.to }, "Falha no envio de email");
    return sendViaLog(msg);
  }
}

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}
