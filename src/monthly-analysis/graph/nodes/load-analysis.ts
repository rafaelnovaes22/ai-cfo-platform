import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Nó esqueleto: lê a MonthlyAnalysis em Prisma para validar tenancy do estado.
// Não popula resultados de agentes — esses arrays só são preenchidos pelos nós
// reais (normalization, clarity, etc.) em ondas futuras.
export async function loadAnalysisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const prisma = getPrisma();

  const analysis = await prisma.monthlyAnalysis.findUnique({
    where: { id: state.analysisId },
    select: { id: true, tenantId: true, status: true },
  });

  if (!analysis) {
    logger.warn(
      { analysisId: state.analysisId, tenantId: state.tenantId },
      "monthly-analysis.graph.load_analysis: analysis not found, prosseguindo com estado vazio",
    );
    return {};
  }

  if (analysis.tenantId !== state.tenantId) {
    logger.error(
      {
        analysisId: state.analysisId,
        stateTenantId: state.tenantId,
        dbTenantId: analysis.tenantId,
      },
      "monthly-analysis.graph.load_analysis: tenant mismatch — possível violação de C5/L1",
    );
    return {};
  }

  logger.debug(
    { analysisId: analysis.id, status: analysis.status },
    "monthly-analysis.graph.load_analysis: analysis carregada",
  );

  return {};
}
