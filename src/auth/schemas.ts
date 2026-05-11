import { z } from "zod";

export const RegisterBody = z.object({
  tenantName: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
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
});
