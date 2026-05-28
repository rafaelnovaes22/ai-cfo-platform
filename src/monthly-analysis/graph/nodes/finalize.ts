import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { Anomaly, NarrativeEvidence } from "@/monthly-analysis/schemas/agents.js";

const PERCENTAGE_DRE_KEYS = new Set([
  "margemBruta", "margemEbitda", "margemOperacional", "margemLiquida",
]);

// Resolve evidenceRefs (nomes de métricas DRE / codes de anomalia / status)
// para o formato estruturado esperado pelo modelo NarrativeCard no banco.
function resolveEvidence(
  refs: string[],
  dre: DreLines | undefined,
  anomalies: Anomaly[] | undefined,
): NarrativeEvidence[] {
  return refs.map((ref) => {
    if (dre && ref in dre) {
      const value = (dre as unknown as Record<string, number>)[ref] ?? 0;
      return { metric: ref, value, unit: PERCENTAGE_DRE_KEYS.has(ref) ? "percent" : "brl_cents" };
    }
    if (ref.startsWith("marginDiagnosis.") || ref.startsWith("cashflowRisk.")) {
      return { metric: ref, value: 0, unit: "status" };
    }
    const anomaly = anomalies?.find((a) => a.code === ref);
    return {
      metric: ref,
      value: anomaly?.impactCents ?? 0,
      unit: "code",
    };
  });
}

// Persiste o resultado completo do pipeline LangGraph no banco e atualiza status.
// Equivale ao que narrator.ts + action-plan/generator.ts fazem no pipeline BullMQ.
export async function finalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const db = getPrisma();

  const { analysisId, tenantId, dre, anomalies, narrativeCards, actionPlan, costs } = state;

  const totalCostCents = costs.reduce((sum, c) => sum + c.costCents, 0);

  try {
    const analysis = await db.monthlyAnalysis.findUnique({
      where: { id: analysisId },
      select: { mode: true, costCents: true },
    });

    if (!analysis) {
      logger.warn({ analysisId, tenantId }, "monthly-analysis.graph.finalize: analysis não encontrada");
      return {};
    }

    await db.$transaction(async (tx) => {
      if (narrativeCards && narrativeCards.length > 0) {
        await tx.narrativeCard.deleteMany({ where: { analysisId } });
        await tx.narrativeCard.createMany({
          data: narrativeCards.map((card) => ({
            analysisId,
            cardType: card.type,
            title: card.title,
            body: card.body,
            evidence: resolveEvidence(card.evidenceRefs, dre, anomalies) as unknown as object,
          })),
        });
      }

      if (actionPlan && actionPlan.actions.length > 0) {
        await tx.actionPlanItem.deleteMany({ where: { analysisId } });
        await tx.actionPlanItem.createMany({
          data: actionPlan.actions.map((a) => ({
            analysisId,
            horizon: a.horizon,
            title: a.title,
            description: a.description,
            effortLevel: a.effortLevel,
            riskLevel: a.riskLevel,
            impactCents: a.impactCents,
            deadlineDays: a.deadlineDays ?? null,
            doneWhen: a.doneWhen,
            status: "pending",
          })),
        });
      }

      const isAutonomous = analysis.mode === "autonomous";

      await tx.monthlyAnalysis.update({
        where: { id: analysisId },
        data: {
          ...(dre ? { dreJson: dre as unknown as object } : {}),
          ...(anomalies ? { anomaliesJson: anomalies as unknown as object } : {}),
          ...(narrativeCards ? { narrativeJson: narrativeCards as unknown as object } : {}),
          ...(actionPlan ? { actionPlanJson: actionPlan as unknown as object } : {}),
          costCents: (analysis.costCents ?? 0) + totalCostCents,
          status: isAutonomous ? "delivered" : "ready",
          generatedAt: new Date(),
          ...(isAutonomous ? { deliveredAt: new Date() } : {}),
        },
      });
    });
  } catch (error) {
    logger.error(
      { analysisId, tenantId, error },
      "monthly-analysis.graph.finalize: erro ao persistir resultado",
    );
    return {};
  }

  logger.info(
    {
      analysisId,
      tenantId,
      costsCount: costs.length,
      totalCostCents,
      tracesCount: state.traces.length,
      errorsCount: state.errors.length,
      anomaliesCount: anomalies?.length ?? 0,
    },
    "monthly-analysis.graph.finalize: pipeline concluído e persistido",
  );

  return {};
}
