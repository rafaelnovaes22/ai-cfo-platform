// RFC 7807 — Problem Details for HTTP APIs.
// Schema único reusado por todas as rotas; serializa erros 4xx/5xx com formato consistente.
import { z } from "zod";

export const ProblemDetailSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
});

export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

export function problemDetail(opts: ProblemDetail): ProblemDetail {
  return opts;
}

// Conveniência para rotas Fastify+Zod: bloco de responses 4xx/5xx padrão.
// Use spread no `response` do schema: `response: { 200: ..., ...defaultErrorResponses }`.
export const defaultErrorResponses = {
  400: ProblemDetailSchema,
  401: ProblemDetailSchema,
  403: ProblemDetailSchema,
  404: ProblemDetailSchema,
  409: ProblemDetailSchema,
  422: ProblemDetailSchema,
  500: ProblemDetailSchema,
} as const;
