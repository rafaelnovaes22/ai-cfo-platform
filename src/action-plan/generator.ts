import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { callLlm } from "@/llm/index.js";
import { buildActionPlanSystemPrompt, buildActionPlanUserPrompt } from "@/action-plan/prompts.js";
import { normalizeActionPlanActions } from "@/action-plan/postprocess.js";
import { logger } from "@/observability/logger.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

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

function calcImpactSummary(actions: z.infer<typeof ActionSchema>[]) {
  const sum = (h: string) =>
    actions.filter((a) => a.horizon === h).reduce((acc, a) => acc + a.impactCents, 0);
  return {
    shortImpact:  sum("short"),
    mediumImpact: sum("medium"),
    longImpact:   sum("long"),
    totalImpact:  actions.reduce((acc, a) => acc + a.impactCents, 0),
  };
}

export async function generateActionPlan(
  analysisId: string,
  tenantId: string,
  dre: DreLines,
): Promise<void> {
  const db = getPrisma();

  const [analysis, tenant, narrativeCards] = await Promise.all([
    db.monthlyAnalysis.findUniqueOrThrow({ where: { id: analysisId } }),
    db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    db.narrativeCard.findMany({ where: { analysisId }, orderBy: { createdAt: "asc" } }),
  ]);

  const config = (tenant.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;
  const toneOfVoice = config?.toneOfVoice ?? "formal";

  const systemPrompt = buildActionPlanSystemPrompt();
  const userPrompt = buildActionPlanUserPrompt({
    dre,
    referenceMonth: analysis.referenceMonth,
    segment: tenant.industrySegment,
    taxRegime: tenant.taxRegime,
    toneOfVoice,
    narrativeCards: narrativeCards.map((c) => ({
      type: c.cardType,
      title: c.title,
      body: c.body,
    })),
  });

  const llmResponse = await callLlm({
    task: "action-plan",
    systemPrompt,
    userPrompt,
    tenantId,
    jsonMode: true,
  });

  // Schema enforce mínimos por horizonte via refinement; parse falha → tenta retry único.
  let parsed: z.infer<typeof PlanResponseSchema>;
  let totalCostCents = llmResponse.costCents;
  try {
    parsed = PlanResponseSchema.parse(JSON.parse(llmResponse.content));
  } catch (err) {
    logger.warn({ analysisId, err: String(err) }, "Plano não passou no schema — retry com instrução reforçada");

    const retryResponse = await callLlm({
      task: "action-plan",
      systemPrompt,
      userPrompt: userPrompt + "\n\nATENÇÃO: O plano DEVE ter no mínimo 3 ações 'short', 1 'medium' e 1 'long'. Cada ação DEVE ter 'doneWhen' descrevendo critério executável de conclusão.",
      tenantId,
      jsonMode: true,
    });
    totalCostCents += retryResponse.costCents;
    // Se o retry também falhar, propaga o erro — NÃO persistir plano inválido (spec §1, C2).
    parsed = PlanResponseSchema.parse(JSON.parse(retryResponse.content));
  }

  const actions = normalizeActionPlanActions(
    parsed.actions,
    dre,
    tenant.industrySegment,
    narrativeCards.map((card) => `${card.title}\n${card.body}`).join("\n"),
  );
  const impact = calcImpactSummary(actions);

  await db.$transaction(async (tx) => {
    await tx.actionPlanItem.deleteMany({ where: { analysisId } });

    await tx.actionPlanItem.createMany({
      data: actions.map((a) => ({
        analysisId,
        horizon:     a.horizon,
        title:       a.title,
        description: a.description,
        effortLevel: a.effortLevel,
        riskLevel:   a.riskLevel,
        impactCents: a.impactCents,
        deadlineDays: a.deadlineDays ?? null,
        doneWhen:    a.doneWhen,
      })),
    });

    // Determina status final conforme o modo da assinatura (C4)
    const isAutonomous = analysis.mode === "autonomous";
    await tx.monthlyAnalysis.update({
      where: { id: analysisId },
      data: {
        actionPlanJson: { ...impact, actions },
        costCents:      (analysis.costCents ?? 0) + totalCostCents,
        status:         isAutonomous ? "delivered" : "ready",
        deliveredAt:    isAutonomous ? new Date() : null,
      },
    });
  });

  logger.info(
    {
      analysisId,
      actionCount: actions.length,
      totalImpactCents: impact.totalImpact,
      costCents: totalCostCents,
      mode: analysis.mode,
    },
    "Plano de ação gerado",
  );
}
