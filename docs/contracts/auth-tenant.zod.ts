import { z } from "zod";

export const RegisterBody = z.object({
  tenantName: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar no formato E.164 (ex.: +5511999998888)")
    .optional(),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof RefreshBody>;

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenResponse = z.infer<typeof TokenResponse>;

export const MeResponse = z.object({
  userId: z.string(),
  tenantId: z.string(),
  role: z.string(),
  name: z.string(),
  email: z.string(),
  plan: z.string(),
  subscriptionStatus: z.string(),
  isSubscriber: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const PasswordResetRequestBody = z.object({
  email: z.string().email(),
});
export type PasswordResetRequestBody = z.infer<typeof PasswordResetRequestBody>;

export const PasswordResetConfirmBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});
export type PasswordResetConfirmBody = z.infer<typeof PasswordResetConfirmBody>;
