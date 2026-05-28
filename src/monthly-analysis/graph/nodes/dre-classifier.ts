import {
  applyClarityCaps,
  runDreClassificationAgent,
} from "@/monthly-analysis/agents/classification.js";
import type { EntryForClassification } from "@/classification/prompts.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

export async function dreClassifierNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const inputs: EntryForClassification[] = (state.normalizedEntries ?? []).map((entry) => ({
    entryId: entry.entryId,
    date: entry.date,
    description: entry.normalizedDescription,
    amountCents: entry.amountCents,
    direction: entry.direction,
  }));
  const tenantFacts = (state.tenantMemory?.facts ?? [])
    .filter((f): f is { content: { description: string; category: string }; confidence: number } =>
      typeof (f.content as Record<string, unknown>)?.description === "string" &&
      typeof (f.content as Record<string, unknown>)?.category === "string"
    )
    .map((f) => ({
      description: (f.content as { description: string; category: string }).description,
      category: (f.content as { description: string; category: string }).category,
    }));

  const classifications = await runDreClassificationAgent(inputs, {
    tenantId: state.tenantId,
    segment: state.segment,
    tenantFacts,
  });
  const finalClassifications =
    state.clarityResults && state.clarityResults.length > 0
      ? applyClarityCaps(classifications, state.clarityResults)
      : classifications;

  // Flywheel de treinamento: persiste predição + confiança para cada lançamento.
  // Usado por SelfHarnessWorker (ADR-011 Etapa 4) para construir dataset rotulado.
  // Falha não-bloqueante: o pipeline continua mesmo se o write-back falhar.
  if (finalClassifications.length > 0) {
    try {
      const db = getPrisma();
      const results = await Promise.allSettled(
        finalClassifications.map((c) =>
          db.ledgerEntry.updateMany({
            where: { id: c.entryId, tenantId: state.tenantId },
            data: {
              predictedCategory: c.category,
              classificationConfidence: c.confidence,
            },
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        logger.warn(
          { analysisId: state.analysisId, tenantId: state.tenantId, failedCount: failed.length },
          "monthly-analysis.dre-classifier: falha ao persistir predictedCategory em alguns lançamentos",
        );
      }
    } catch (err) {
      logger.warn(
        { analysisId: state.analysisId, tenantId: state.tenantId, err },
        "monthly-analysis.dre-classifier: write-back de predictedCategory indisponível",
      );
    }
  }

  return { classifiedEntries: finalClassifications };
}
