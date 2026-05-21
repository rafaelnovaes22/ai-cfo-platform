import { logger } from "@/observability/logger.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Nó esqueleto de fechamento: emite uma linha de log estruturada com os
// contadores de telemetria do estado. Não muta o estado.
export async function finalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  logger.info(
    {
      analysisId: state.analysisId,
      tenantId: state.tenantId,
      costsCount: state.costs.length,
      tracesCount: state.traces.length,
      errorsCount: state.errors.length,
    },
    "monthly-analysis.graph.finalize: pipeline concluído",
  );

  return {};
}
