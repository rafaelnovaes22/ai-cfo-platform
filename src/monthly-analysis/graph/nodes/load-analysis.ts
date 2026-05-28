import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";
import { buildTenantContext } from "@/learning/tenant-context.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

const HISTORY_WINDOW = 12; // meses de histórico carregados para análise de tendência

// Carrega metadata da MonthlyAnalysis + lançamentos brutos (LedgerEntry).
// Também popula previousDre, historicalDre (últimos 12 meses fechados) e openingBalance.
// Valida tenancy. Popula state.rawEntries para o nó `normalize` consumir.
export async function loadAnalysisNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const prisma = getPrisma();

  const analysis = await prisma.monthlyAnalysis.findUnique({
    where: { id: state.analysisId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      referenceMonth: true,
      openingBalanceCents: true,
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

  const tenantData = analysis.tenant as {
    industrySegment?: string;
    taxRegime?: string;
    productConfig?: unknown;
  } | undefined;
  const segment = tenantData?.industrySegment ?? "geral";

  const [entries, historicalRecords, tenantMemory] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { analysisId: state.analysisId, tenantId: state.tenantId },
      select: { id: true, date: true, description: true, amountCents: true, direction: true },
      orderBy: { date: "asc" },
    }),
    // Busca análises fechadas anteriores ao mês atual para histórico e sinal MoM
    prisma.monthlyAnalysis.findMany({
      where: {
        tenantId: state.tenantId,
        referenceMonth: { lt: analysis.referenceMonth },
        status: { in: ["ready", "delivered", "approved"] },
      },
      orderBy: { referenceMonth: "desc" },
      take: HISTORY_WINDOW,
      select: { referenceMonth: true, dreJson: true },
    }),
    // Carrega memória L1 do tenant (ADR-011 Etapa 3) — fatos, preferências, padrões e sinais globais
    buildTenantContext(state.tenantId, segment),
  ]);

  const rawEntries: RawLedgerEntry[] = entries.map((entry) => ({
    entryId: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    description: entry.description,
    amountCents: entry.amountCents,
    direction: entry.direction === "credit" ? "in" : "out",
  }));

  // Filtra registros sem DRE gerado e ordena do mais antigo ao mais recente
  const validHistorical = historicalRecords
    .filter((r) => r.dreJson != null)
    .reverse() as { referenceMonth: string; dreJson: DreLines }[];

  const historicalDre = validHistorical.map((r) => r.dreJson);
  const previousDre = historicalDre.length > 0 ? historicalDre[historicalDre.length - 1] : undefined;
  const openingBalance = analysis.openingBalanceCents ?? undefined;

  const config = (tenantData?.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;
  const toneOfVoice = config?.toneOfVoice ?? "formal";

  logger.debug(
    {
      analysisId: analysis.id,
      referenceMonth: analysis.referenceMonth,
      status: analysis.status,
      entriesCount: rawEntries.length,
      historicalMonths: historicalDre.length,
      hasPreviousDre: previousDre !== undefined,
      hasOpeningBalance: openingBalance !== undefined,
    },
    "monthly-analysis.graph.load_analysis: análise carregada",
  );

  return {
    rawEntries,
    segment,
    taxRegime: tenantData?.taxRegime ?? "simples",
    toneOfVoice,
    tenantMemory,
    previousDre,
    historicalDre,
    openingBalance,
  };
}
