// Schemas e parse do plano de ação. O gerador legado do pipeline BullMQ
// (generateActionPlan) foi removido — o grafo LangGraph tem seu próprio agente
// (monthly-analysis/agents/action-planning.ts). Estes schemas seguem como
// contrato executável da spec §1, usados pelo postprocess e pelos evals.
import { z } from "zod";

// Exportado para testes unitários — schema é o contrato executável da spec §1.
export const ActionSchema = z.object({
  horizon:     z.enum(["short", "medium", "long"]),
  title:       z.string().min(3),
  description: z.string().min(10),
  effortLevel: z.enum(["low", "medium", "high"]),
  riskLevel:   z.enum(["low", "medium", "high"]),
  impactCents: z.number().int().positive(),
  deadlineDays: z.number().int().positive().optional(),
  // C2 — doneWhen é critério executável; sem ele a ação não é mensurável (spec action-plan.md §1).
  doneWhen:    z.string().min(5),
});

// PlanResponseSchema enforce mínimos por horizonte como Zod refinement (não apenas total).
export const PlanResponseSchema = z.object({
  actions: z.array(ActionSchema).min(5),
}).refine(
  ({ actions }) => actions.filter((a) => a.horizon === "short").length >= 3,
  { message: "Mínimo 3 ações 'short' obrigatório", path: ["actions"] },
).refine(
  ({ actions }) => actions.filter((a) => a.horizon === "medium").length >= 1,
  { message: "Mínimo 1 ação 'medium' obrigatório", path: ["actions"] },
).refine(
  ({ actions }) => actions.filter((a) => a.horizon === "long").length >= 1,
  { message: "Mínimo 1 ação 'long' obrigatório", path: ["actions"] },
);

function normalizeGeneratedPlanPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { actions?: unknown }).actions)) {
    return raw;
  }
  return {
    ...(raw as Record<string, unknown>),
    actions: ((raw as { actions: unknown[] }).actions).map((item) => {
      if (!item || typeof item !== "object") return item;
      const action = { ...(item as Record<string, unknown>) };
      if (typeof action.impactCents !== "number" || !Number.isFinite(action.impactCents) || action.impactCents <= 0) {
        action.impactCents = 50_000;
      }
      if (typeof action.deadlineDays === "number" && action.deadlineDays <= 0) {
        action.deadlineDays = 7;
      }
      return action;
    }),
  };
}

export function parsePlanResponse(raw: unknown): z.infer<typeof PlanResponseSchema> {
  return PlanResponseSchema.parse(normalizeGeneratedPlanPayload(raw));
}
