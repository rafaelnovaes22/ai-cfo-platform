import { z } from "zod";

// Contratos executáveis para a próxima evolução do SKU monthly-analysis.
// Esta camada ainda não altera o pipeline atual; ela define os envelopes e
// schemas que serão usados pelos nós LangGraph/agentes especializados.

export const AgentNameSchema = z.enum([
  "normalization",
  "clarity-judge",
  "dre-classification",
  "anomaly-detection",
  "margin-diagnosis",
  "cashflow-risk",
  "narrative-synthesis",
  "action-planning",
  "financial-qa-review",
]);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const AgentSeveritySchema = z.enum(["low", "medium", "high"]);
export type AgentSeverity = z.infer<typeof AgentSeveritySchema>;

export const AgentCostSchema = z.object({
  agent: AgentNameSchema,
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  traceId: z.string().nullable().optional(),
});
export type AgentCost = z.infer<typeof AgentCostSchema>;

export const AgentTraceSchema = z.object({
  agent: AgentNameSchema,
  inputHash: z.string().min(8),
  outputHash: z.string().min(8).optional(),
  schemaPassed: z.boolean(),
  retryCount: z.number().int().nonnegative().default(0),
});
export type AgentTrace = z.infer<typeof AgentTraceSchema>;

export const AgentErrorSchema = z.object({
  agent: AgentNameSchema,
  code: z.string().min(2),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type AgentError = z.infer<typeof AgentErrorSchema>;

export const NormalizedLedgerEntrySchema = z.object({
  entryId: z.string(),
  date: z.string(),
  description: z.string(),
  normalizedDescription: z.string(),
  amountCents: z.number().int(),
  direction: z.enum(["in", "out"]),
  probableCounterparty: z.string().nullable().optional(),
  documentType: z.enum(["nf", "invoice", "boleto", "pix", "ted", "card", "payroll", "tax", "unknown"]),
  features: z.array(z.string()).default([]),
  noiseFlags: z.array(z.string()).default([]),
});
export type NormalizedLedgerEntry = z.infer<typeof NormalizedLedgerEntrySchema>;

export const ClarityResultSchema = z.object({
  // entryId/reason com default: o Gemini às vezes omite campos em respostas grandes
  // (77+ lançamentos). Clarity é advisory (cap por entryId) — um item com entryId ""
  // é só ignorado em applyClarityCaps, em vez de derrubar a análise inteira (ZodError).
  entryId: z.string().default(""),
  clarity: z.enum(["clear", "partial", "ambiguous"]),
  reason: z.string().max(240).default(""),
});
export type ClarityResult = z.infer<typeof ClarityResultSchema>;
export const ClarityResultsSchema = z.array(ClarityResultSchema);
export type ClarityResults = z.infer<typeof ClarityResultsSchema>;

export const DreClassificationResultSchema = z.object({
  // entryId com default "": o Gemini às vezes omite; resolveRealEntryId cai no índice
  // da resposta como fallback, então não quebra o mapeamento (e evita ZodError).
  entryId: z.string().default(""),
  category: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(240).optional(),
});
export type DreClassificationResult = z.infer<typeof DreClassificationResultSchema>;
export const DreClassificationResultsSchema = z.array(DreClassificationResultSchema);
export type DreClassificationResults = z.infer<typeof DreClassificationResultsSchema>;

export const AnomalySchema = z.object({
  code: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(10),
  severity: AgentSeveritySchema,
  evidenceMetric: z.string().min(2),
  impactCents: z.number().int().optional(),
});
export type Anomaly = z.infer<typeof AnomalySchema>;

export const MarginDiagnosisSchema = z.object({
  grossMarginStatus: z.enum(["healthy", "attention", "critical"]),
  operatingMarginStatus: z.enum(["healthy", "attention", "critical"]),
  mainDrivers: z.array(z.object({
    driver: z.string().min(3),
    evidenceMetric: z.string().min(2),
    impactCents: z.number().int(),
    severity: AgentSeveritySchema,
  })).min(1),
});
export type MarginDiagnosis = z.infer<typeof MarginDiagnosisSchema>;

export const CashflowRiskSchema = z.object({
  status: z.enum(["healthy", "attention", "critical", "insufficient_data"]),
  reasons: z.array(z.string().min(3)),
  limitations: z.array(z.string().min(3)).default([]),
});
export type CashflowRisk = z.infer<typeof CashflowRiskSchema>;

// Evidência estruturada para o modelo NarrativeCard no banco.
// unit: "brl_cents" | "percent" | "status" | "code"
export const NarrativeEvidenceSchema = z.object({
  metric: z.string().min(2),
  value: z.number(),
  unit: z.string().min(2),
});
export type NarrativeEvidence = z.infer<typeof NarrativeEvidenceSchema>;

export const NarrativeCardDraftSchema = z.object({
  type: z.enum(["critical_gap", "attention", "healthy"]),
  title: z.string().min(3),
  body: z.string().min(10),
  // Refs resolvidas em finalizeNode → NarrativeEvidence[] antes de persistir.
  evidenceRefs: z.array(z.string().min(2)).min(1),
});
export type NarrativeCardDraft = z.infer<typeof NarrativeCardDraftSchema>;

// Wrapper que reforça composição contratual: EXATAMENTE 3 cards, um de cada tipo.
export const NarrativeCardDraftsSchema = z.array(NarrativeCardDraftSchema)
  .length(3, { message: "Exatamente 3 cards de narrativa são obrigatórios" })
  .refine(
    (cards) => cards.filter((c) => c.type === "critical_gap").length === 1,
    { message: "Exatamente 1 card do tipo critical_gap é obrigatório" },
  )
  .refine(
    (cards) => cards.filter((c) => c.type === "attention").length === 1,
    { message: "Exatamente 1 card do tipo attention é obrigatório" },
  )
  .refine(
    (cards) => cards.filter((c) => c.type === "healthy").length === 1,
    { message: "Exatamente 1 card do tipo healthy é obrigatório" },
  );
export type NarrativeCardDrafts = z.infer<typeof NarrativeCardDraftsSchema>;

export const ActionPlanItemDraftSchema = z.object({
  horizon: z.enum(["short", "medium", "long"]),
  title: z.string().min(3),
  description: z.string().min(10),
  effortLevel: z.enum(["low", "medium", "high"]),
  riskLevel: z.enum(["low", "medium", "high"]),
  impactCents: z.number().int().positive(),
  deadlineDays: z.number().int().positive().optional(),
  doneWhen: z.string().min(5),
  evidenceRefs: z.array(z.string().min(2)).min(1),
  assumptions: z.array(z.string().min(3)).default([]),
  confidence: z.number().min(0).max(1),
});
export type ActionPlanItemDraft = z.infer<typeof ActionPlanItemDraftSchema>;

export const ActionPlanDraftSchema = z.object({
  actions: z.array(ActionPlanItemDraftSchema).min(5),
  // Mín 2 short (não 3): forçar uma 3ª short numa empresa saudável e estável produzia
  // micro-corte imaterial só para completar a cota. Com 2, o "espaço" migra para
  // medium/long, onde moram as alavancas estruturais (reserva, diversificação).
}).refine(({ actions }) => actions.filter((a) => a.horizon === "short").length >= 2, {
  message: "Mínimo 2 ações short obrigatório",
  path: ["actions"],
}).refine(({ actions }) => actions.filter((a) => a.horizon === "medium").length >= 1, {
  message: "Mínimo 1 ação medium obrigatório",
  path: ["actions"],
}).refine(({ actions }) => actions.filter((a) => a.horizon === "long").length >= 1, {
  message: "Mínimo 1 ação long obrigatório",
  path: ["actions"],
});
export type ActionPlanDraft = z.infer<typeof ActionPlanDraftSchema>;

export const QaReviewSchema = z.object({
  publishable: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(["blocker", "warning"]),
    code: z.string().min(2),
    message: z.string().min(5),
    evidenceRef: z.string().optional(),
  })),
  retryTargets: z.array(z.enum(["narrative-synthesis", "action-planning"])).default([]),
});
export type QaReview = z.infer<typeof QaReviewSchema>;
