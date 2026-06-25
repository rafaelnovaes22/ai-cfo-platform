import {
  runNormalizationAgentWithTelemetry,
  buildPassthroughNormalized,
} from "@/monthly-analysis/agents/normalization.js";
import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import { resolvedEntryIds } from "@/monthly-analysis/graph/resolved-entries.js";
import { logger } from "@/observability/logger.js";
import type { NormalizedLedgerEntry } from "@/monthly-analysis/schemas/agents.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function normalizeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  const rawEntries = state.rawEntries ?? [];

  // Lançamentos já resolvidos (categoria confirmada na origem ou predita em run
  // anterior) pulam o LLM: viram NormalizedLedgerEntry determinístico (passthrough).
  // Só os não-resolvidos vão ao agente — corta o reprocessamento de todo o histórico
  // numa re-análise consolidada.
  const resolved = resolvedEntryIds(rawEntries);
  const toNormalize = rawEntries.filter((e) => !resolved.has(e.entryId));
  const passById = new Map(
    rawEntries.filter((e) => resolved.has(e.entryId)).map((e) => [e.entryId, buildPassthroughNormalized(e)]),
  );

  if (passById.size > 0) {
    logger.info(
      { analysisId: state.analysisId, passthrough: passById.size, toNormalize: toNormalize.length },
      "monthly-analysis.normalize: lançamentos já resolvidos pularam o LLM (passthrough)",
    );
  }

  // Lotes paralelos: normalização é por-lançamento, então dividir não muda o
  // resultado e corta o wall-clock no Vertex (ver chunk-runner.ts).
  const { data, response, latencyMs } = await runChunkedWithTelemetry(
    toNormalize,
    { tenantId: state.tenantId, traceId: state.traceId },
    runNormalizationAgentWithTelemetry,
  );

  // Merge preservando a ordem original de rawEntries e garantindo 1 saída por entry
  // (aggregate-dre junta por entryId; um entry perdido sumiria do DRE). Fallback de
  // segurança: entry não-resolvido que o LLM não devolveu vira passthrough + warn.
  const llmById = new Map(data.map((d) => [d.entryId, d]));
  const normalizedEntries: NormalizedLedgerEntry[] = rawEntries.map((e) => {
    const fromLlm = llmById.get(e.entryId);
    if (fromLlm) return fromLlm;
    const fromPass = passById.get(e.entryId);
    if (fromPass) return fromPass;
    logger.warn(
      { analysisId: state.analysisId, entryId: e.entryId },
      "monthly-analysis.normalize: entry não-resolvido ausente na saída do LLM — passthrough de segurança",
    );
    return buildPassthroughNormalized(e);
  });

  const { costs, traces } = buildAgentTelemetry({
    agent: "normalization",
    response,
    latencyMs,
    inputPayload: toNormalize,
    outputPayload: data,
  });

  return { normalizedEntries, costs, traces };
}
