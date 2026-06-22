import { z } from "zod";

export const ProductConfigBody = z.object({
  monthlyAnalysis: z
    .object({
      toneOfVoice: z.enum(["formal", "informal"]).optional(),
      customInstructions: z.string().max(500).optional(),
      minEntries: z.number().int().min(1).max(10_000).optional(),
    })
    .optional(),
});
export type ProductConfigBody = z.infer<typeof ProductConfigBody>;

export const ChangeRoleBody = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});
export type ChangeRoleBody = z.infer<typeof ChangeRoleBody>;

export const CreateTokenBody = z.object({
  name: z.string().min(2).max(60),
  scopes: z.array(z.string().max(50)).max(20).default([]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateTokenBody = z.infer<typeof CreateTokenBody>;

export const TokenListItem = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type TokenListItem = z.infer<typeof TokenListItem>;

export const CreateTokenResponse = TokenListItem.extend({
  token: z.string(),
});
export type CreateTokenResponse = z.infer<typeof CreateTokenResponse>;
