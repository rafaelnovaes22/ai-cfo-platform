import { callLlm } from "@/llm/index.js";
import type { LlmResponse } from "@/llm/types.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type NarrativeSynthesisAgentInput,
} from "@/monthly-analysis/agents/prompts/narrative-synthesis.js";
import {
  NarrativeCardDraftsSchema,
  type NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";

export type { NarrativeSynthesisAgentInput } from "@/monthly-analysis/agents/prompts/narrative-synthesis.js";

/**
 * Sintetiza os 3 cards de "Leitura do mês" a partir do diagnóstico financeiro
 * (DRE + anomalias + diagnóstico de margem + risco de caixa).
 *
 * Contrato: retorna EXATAMENTE 3 cards — 1 critical_gap + 1 attention + 1 healthy.
 * Composição enforced via NarrativeCardDraftsSchema (.refine()).
 */
export async function runNarrativeSynthesisAgent(
  input: NarrativeSynthesisAgentInput,
  options: MonthlyAgentRunOptions,
): Promise<NarrativeCardDraft[]> {
  const { data } = await runNarrativeSynthesisAgentWithTelemetry(input, options);
  return data;
}

export async function runNarrativeSynthesisAgentWithTelemetry(
  input: NarrativeSynthesisAgentInput,
  options: MonthlyAgentRunOptions,
): Promise<{ data: NarrativeCardDraft[]; response: LlmResponse; latencyMs: number }> {
  const start = Date.now();
  const response = await callLlm({
    task: "narrative-synthesis",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  const data = parseAgentJson(response.content, NarrativeCardDraftsSchema);
  return { data, response, latencyMs: Date.now() - start };
}
