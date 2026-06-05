import { z } from "zod";

export const RegisterBody = z.object({
  tenantName: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  // Telefone WhatsApp (E.164) — pré-preenche Tenant.whatsappPhone como sugestão.
  // NÃO habilita o canal: opt-in explícito (whatsappEnabled/optInAt) fica para
  // PATCH /config/whatsapp (LGPD Art. 7 — ver ADR-016).
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar no formato E.164 (ex.: +5511999998888)")
    .optional(),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const MeResponse = z.object({
  userId: z.string(),
  tenantId: z.string(),
  role: z.string(),
  name: z.string(),
  email: z.string(),
});

export const PasswordResetRequestBody = z.object({
  email: z.string().email(),
});

export const PasswordResetConfirmBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const PasswordResetResponse = z.object({
  ok: z.literal(true),
});
