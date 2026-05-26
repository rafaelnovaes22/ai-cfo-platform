import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

// Carrega metadata da MonthlyAnalysis + lançamentos brutos (LedgerEntry).
// Valida tenancy. Popula state.rawEntries para o nó `normalize` consumir.
export async function loadAnalysisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const prisma = getPrisma();

  const analysis = await prisma.monthlyAnalysis.findUnique({
    where: { id: state.analysisId },
    select: {
      id: true, tenantId: true, status: true,
      tenant: { select: { industrySegment: true, taxRegime: true, productConfig: true } },
    },
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

  const entries = await prisma.ledgerEntry.findMany({
    where: { analysisId: state.analysisId, tenantId: state.tenantId },
    select: { id: true, date: true, description: true, amountCents: true, direction: true },
    orderBy: { date: "asc" },
  });

  const rawEntries: RawLedgerEntry[] = entries.map((entry) => ({
    entryId: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    description: entry.description,
    amountCents: entry.amountCents,
    direction: entry.direction === "credit" ? "in" : "out",
  }));

  const tenantData = analysis.tenant as { industrySegment?: string; taxRegime?: string; productConfig?: unknown } | undefined;
  const config = (tenantData?.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;
  const toneOfVoice = config?.toneOfVoice ?? "formal";

  logger.debug(
    { analysisId: analysis.id, status: analysis.status, entriesCount: rawEntries.length },
    "monthly-analysis.graph.load_analysis: analysis + entries carregados",
  );

  return {
    rawEntries,
    segment: tenantData?.industrySegment ?? "geral",
    taxRegime: tenantData?.taxRegime ?? "simples",
    toneOfVoice,
  };
}
