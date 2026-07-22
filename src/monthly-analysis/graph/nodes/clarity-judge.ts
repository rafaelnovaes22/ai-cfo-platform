import { runClarityJudgeAgentWithTelemetry } from "@/monthly-analysis/agents/classification.js";
import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import { resolvedEntryIds } from "@/monthly-analysis/graph/resolved-entries.js";
import type { JudgeInput } from "@/classification/judge.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export async function clarityJudgeNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  // Clareza alimenta caps de confiança da classificação. Lançamentos resolvidos
  // (confirmados/preditos) não vão ao classificador LLM, então também não precisam de
  // clarity — applyClarityCaps mantém a confiança original quando falta clarity p/ um id.
  const resolved = resolvedEntryIds(state.rawEntries ?? []);
  const inputs: JudgeInput[] = (state.normalizedEntries ?? [])
    .filter((entry) => !resolved.has(entry.entryId))
    .map((entry) => ({
      entryId: entry.entryId,
      description: entry.normalizedDescription,
    }));

  // Lotes paralelos: avaliação de clareza é por-lançamento (ver chunk-runner.ts).
  const { data, response, latencyMs } = await runChunkedWithTelemetry(
    inputs,
    { tenantId: state.tenantId, traceId: state.traceId },
    runClarityJudgeAgentWithTelemetry,
  );

  const { costs, traces } = buildAgentTelemetry({
    agent: "clarity-judge",
    response,
    latencyMs,
    inputPayload: inputs,
    outputPayload: data,
  });

  return { clarityResults: data, costs, traces };
}
