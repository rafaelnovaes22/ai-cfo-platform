import { z } from "zod";

// productConfig — L1 do pipeline de IA (C5). Estrutura validada aqui; armazenada como JSONB (C8).
export const ProductConfigBody = z.object({
  monthlyAnalysis: z
    .object({
      toneOfVoice: z.enum(["formal", "informal"]).optional(),
      customInstructions: z.string().max(500).optional(),
      // Mínimo de lançamentos para acionar pipeline de classificação.
      // Abaixo desse número o outcome do ingest fica em "partial" sem enfileirar.
      // Default 50 (DEFAULT_MIN_INGEST_ENTRIES em src/ingest/service.ts).
      minEntries: z.number().int().min(1).max(10_000).optional(),
    })
    .optional(),
});

export const ChangeRoleBody = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

export const CreateTokenBody = z.object({
  name: z.string().min(2).max(60),
  scopes: z.array(z.string().max(50)).max(20).default([]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const TokenListItem = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

export const CreateTokenResponse = TokenListItem.extend({
  token: z.string(), // retornado uma única vez — não armazenado
});
