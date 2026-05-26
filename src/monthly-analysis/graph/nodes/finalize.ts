import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

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
            evidence: [] as unknown as object,
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
