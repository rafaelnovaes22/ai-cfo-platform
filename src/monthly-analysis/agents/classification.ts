import { callLlm } from "@/llm/index.js";
import type { LlmResponse } from "@/llm/types.js";
import { NOOP_LLM_RESPONSE } from "@/monthly-analysis/graph/instrumentation.js";
import {
  buildSystemPrompt as buildDreSystemPrompt,
  buildUserPrompt as buildDreUserPrompt,
  type EntryForClassification,
  type TenantFact,
} from "@/classification/prompts.js";
import {
  CLARITY_CONFIDENCE_CAP,
  type Clarity,
  type JudgeInput,
  _internals as clarityJudgeInternals,
} from "@/classification/judge.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import {
  ClarityResultsSchema,
  DreClassificationResultsSchema,
  type ClarityResult,
  type DreClassificationResult,
} from "@/monthly-analysis/schemas/agents.js";

export interface MonthlyAgentRunOptions {
  tenantId: string;
  traceId?: string;
  segment?: string;
  tenantFacts?: TenantFact[];
  // Perfil do negócio inferido das descrições (ver business-profile.ts). Vai a
  // todos os lotes para classificar receita-fim vs despesa com contexto do ramo.
  businessProfile?: string;
}

export type DreClassificationAgentInput = EntryForClassification;

const DEFAULT_DRE_CATEGORY = "nao_classificado";

// Extrai o bloco JSON de uma resposta de LLM tolerando cercas markdown
// (```json ... ```) e prosa antes/depois — causas comuns de JSON.parse falhar.
function extractJsonBlock(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1]! : trimmed).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return body;
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return end > start ? body.slice(start, end + 1) : body.slice(start);
}

export function parseAgentJson<T>(content: string, schema: { parse: (value: unknown) => T }): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(content));
  } catch (err) {
    // Erro claro e contextualizado em vez de SyntaxError cru — ajuda o retry/QA gate.
    throw new Error(
      `parseAgentJson: resposta do LLM não é JSON válido (${(err as Error).message}). Início: ${content.slice(0, 200)}`,
    );
  }
  return schema.parse(parsed);
}

export function coerceDreCategory(category: string): string {
  return DRE_CATEGORIES.includes(category as never) ? category : DEFAULT_DRE_CATEGORY;
}

export function capConfidenceByClarity(confidence: number, clarity: Clarity): number {
  return Math.min(confidence, CLARITY_CONFIDENCE_CAP[clarity]);
}

export function applyClarityCaps(
  classifications: DreClassificationResult[],
  clarityResults: ClarityResult[],
): DreClassificationResult[] {
  const clarityByEntryId = new Map(clarityResults.map((result) => [result.entryId, result.clarity]));

  return classifications.map((classification) => {
    const clarity = clarityByEntryId.get(classification.entryId);
    return {
      ...classification,
      category: coerceDreCategory(classification.category),
      confidence: clarity === undefined
        ? classification.confidence
        : capConfidenceByClarity(classification.confidence, clarity),
    };
  });
}

export async function runClarityJudgeAgent(
  entries: JudgeInput[],
  options: MonthlyAgentRunOptions,
): Promise<ClarityResult[]> {
  const { data } = await runClarityJudgeAgentWithTelemetry(entries, options);
  return data;
}

export async function runClarityJudgeAgentWithTelemetry(
  entries: JudgeInput[],
  options: MonthlyAgentRunOptions,
): Promise<{ data: ClarityResult[]; response: LlmResponse; latencyMs: number }> {
  if (entries.length === 0) {
    return { data: [], response: NOOP_LLM_RESPONSE, latencyMs: 0 };
  }

  const start = Date.now();
  const response = await callLlm({
    task: "clarity-judge",
    systemPrompt: clarityJudgeInternals.buildSystemPrompt(),
    userPrompt: clarityJudgeInternals.buildUserPrompt(entries),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  const data = parseAgentJson(response.content, ClarityResultsSchema);
  return { data, response, latencyMs: Date.now() - start };
}

export async function runDreClassificationAgent(
  entries: DreClassificationAgentInput[],
  options: MonthlyAgentRunOptions,
): Promise<DreClassificationResult[]> {
  const { data } = await runDreClassificationAgentWithTelemetry(entries, options);
  return data;
}

export async function runDreClassificationAgentWithTelemetry(
  entries: DreClassificationAgentInput[],
  options: MonthlyAgentRunOptions,
): Promise<{ data: DreClassificationResult[]; response: LlmResponse; latencyMs: number }> {
  if (entries.length === 0) {
    return { data: [], response: NOOP_LLM_RESPONSE, latencyMs: 0 };
  }

  const start = Date.now();
  const response = await callLlm({
    task: "dre-classification",
    systemPrompt: buildDreSystemPrompt(),
    userPrompt: buildDreUserPrompt(entries, options.segment, options.tenantFacts, options.businessProfile),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  const data = parseAgentJson(response.content, DreClassificationResultsSchema).map((result) => ({
    ...result,
    category: coerceDreCategory(result.category),
  }));
  return { data, response, latencyMs: Date.now() - start };
}
