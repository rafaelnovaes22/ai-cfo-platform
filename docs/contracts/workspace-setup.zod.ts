import { z } from "zod";

const INDUSTRY_SEGMENTS = [
  "agencia",
  "industria-leve",
  "servicos-b2b",
  "saas",
  "varejo",
  "geral",
] as const;
const TAX_REGIMES = ["simples", "lucro-presumido", "lucro-real"] as const;
const ROLES = ["admin", "editor", "viewer"] as const;

export const UpdateProfileBody = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  industrySegment: z.enum(INDUSTRY_SEGMENTS).optional(),
  taxRegime: z.enum(TAX_REGIMES).optional(),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const AddMemberBody = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(ROLES).default("editor"),
});
export type AddMemberBody = z.infer<typeof AddMemberBody>;

export const ProfileResponse = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string().nullable(),
  industrySegment: z.string(),
  taxRegime: z.string(),
  createdAt: z.string(),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

export const MemberResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().nullable(),
});
export type MemberResponse = z.infer<typeof MemberResponse>;

export const AddMemberResponse = MemberResponse.extend({
  tempPassword: z.string(),
});
export type AddMemberResponse = z.infer<typeof AddMemberResponse>;
