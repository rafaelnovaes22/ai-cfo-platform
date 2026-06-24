import { z } from "zod";

// Payload para criar tenant premium via rota admin. Não passa pelo fluxo normal
// de registro (trial) nem pelo Stripe — a subscription já nasce com plano/mode
// definidos pelo operador. Senha é gerada automaticamente (tempPassword).
export const CreateTenantBody = z.object({
  tenantName: z.string().min(2),
  cnpj: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(2),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Telefone deve estar no formato E.164 (ex.: +5511999998888)")
    .optional(),
  industrySegment: z.string().optional(),
  taxRegime: z.string().optional(),
  // Defaults: business / autonomous / active — override se precisar.
  plan: z.enum(["lite", "pro", "business"]).default("business"),
  mode: z.enum(["shadow", "assisted", "autonomous"]).default("autonomous"),
});

export const CreateTenantResponse = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string(),
  tempPassword: z.string(),
  plan: z.string(),
  mode: z.string(),
  status: z.literal("active"),
});

export const ListTenantsQuery = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const TenantSummary = z.object({
  tenantId: z.string().uuid(),
  name: z.string(),
  cnpj: z.string().nullable(),
  plan: z.string(),
  mode: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

export const ListTenantsResponse = z.object({
  tenants: z.array(TenantSummary),
  total: z.number().int(),
});
