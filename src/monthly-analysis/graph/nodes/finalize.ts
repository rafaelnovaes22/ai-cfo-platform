import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import { reconcileActionPlan } from "@/action-plan/reconcile.js";
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

  const { analysisId, tenantId, dre, anomalies, narrativeCards, actionPlan, costs, traceId } = state;

  const totalCostCents = costs.reduce((sum, c) => sum + c.costCents, 0);

  try {
    const analysis = await db.monthlyAnalysis.findUnique({
      where: { id: analysisId },
      select: { mode: true, costCents: true },
    });

    if (!analysis) {
      logger.error({ analysisId, tenantId }, "monthly-analysis.graph.finalize: analysis não encontrada");
      throw new Error(`finalize: analysisId "${analysisId}" não encontrada ao finalizar`);
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
        // Reconciliação incremental: preserva aprovação e status de execução dos itens
        // que reaparecem entre regenerações, em vez de apagar e recriar tudo (ADR-011).
        const existing = await tx.actionPlanItem.findMany({
          where: { analysisId },
          select: { id: true, matchKey: true, horizon: true, status: true, clientApproved: true, supersededAt: true },
        });
        const { toCreate, toUpdate, toSupersede } = reconcileActionPlan(existing, actionPlan.actions);
        const now = new Date();

        if (toCreate.length > 0) {
          await tx.actionPlanItem.createMany({
            data: toCreate.map((c) => ({
              analysisId,
              tenantId,
              leverKey: c.leverKey,
              matchKey: c.matchKey,
              horizon: c.horizon as typeof actionPlan.actions[number]["horizon"],
              title: c.title,
              description: c.description,
              effortLevel: c.effortLevel,
              riskLevel: c.riskLevel,
              impactCents: c.impactCents,
              deadlineDays: c.deadlineDays,
              doneWhen: c.doneWhen,
              status: "pending",
            })),
          });
        }
        for (const { id, content } of toUpdate) {
          // Refresh de conteúdo (título/descrição/impacto podem evoluir com novos dados);
          // status, clientApproved e clientComment NÃO são tocados. supersededAt limpo:
          // a alavanca voltou a ser recomendada.
          await tx.actionPlanItem.update({
            where: { id },
            data: {
              leverKey: content.leverKey,
              title: content.title,
              description: content.description,
              effortLevel: content.effortLevel,
              riskLevel: content.riskLevel,
              impactCents: content.impactCents,
              deadlineDays: content.deadlineDays,
              doneWhen: content.doneWhen,
              supersededAt: null,
            },
          });
        }
        if (toSupersede.length > 0) {
          await tx.actionPlanItem.updateMany({
            where: { id: { in: toSupersede } },
            data: { supersededAt: now },
          });
        }
      }

      // QA gate pode marcar needsReview=true mesmo em autonomous — nesse caso,
      // não publica direto; cai para "ready" e espera revisão humana.
      const isAutonomous = analysis.mode === "autonomous" && state.needsReview !== true;

      await tx.monthlyAnalysis.update({
        where: { id: analysisId },
        data: {
          ...(dre ? { dreJson: dre as unknown as object } : {}),
          ...(anomalies ? { anomaliesJson: anomalies as unknown as object } : {}),
          ...(narrativeCards ? { narrativeJson: narrativeCards as unknown as object } : {}),
          ...(actionPlan ? { actionPlanJson: actionPlan as unknown as object } : {}),
          costCents: (analysis.costCents ?? 0) + totalCostCents,
          // Correlaciona a análise com o trace canônico (LangSmith) para auditoria
          // pós-fato (C6). O ingest zera traceId ao reprocessar; o finalize regrava
          // o trace do run que efetivamente gerou este resultado.
          ...(traceId ? { traceId } : {}),
          status: isAutonomous ? "delivered" : "ready",
          generatedAt: new Date(),
          ...(isAutonomous ? { deliveredAt: new Date() } : {}),
        },
      });
    });
  } catch (error) {
    logger.error(
      { analysisId, tenantId, error },
      "monthly-analysis.graph.finalize: erro ao persistir resultado — job falhará para revert via BullMQ",
    );
    throw error;
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
