import { callLlm } from "@/llm/index.js";
import {
  buildSystemPrompt as buildDreSystemPrompt,
  buildUserPrompt as buildDreUserPrompt,
  type EntryForClassification,
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
}

export type DreClassificationAgentInput = EntryForClassification;

const DEFAULT_DRE_CATEGORY = "nao_classificado";

export function parseAgentJson<T>(content: string, schema: { parse: (value: unknown) => T }): T {
  return schema.parse(JSON.parse(content));
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
  if (entries.length === 0) return [];

  const response = await callLlm({
    task: "clarity-judge",
    systemPrompt: clarityJudgeInternals.buildSystemPrompt(),
    userPrompt: clarityJudgeInternals.buildUserPrompt(entries),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  return parseAgentJson(response.content, ClarityResultsSchema);
}

export async function runDreClassificationAgent(
  entries: DreClassificationAgentInput[],
  options: MonthlyAgentRunOptions,
): Promise<DreClassificationResult[]> {
  if (entries.length === 0) return [];

  const response = await callLlm({
    task: "dre-classification",
    systemPrompt: buildDreSystemPrompt(),
    userPrompt: buildDreUserPrompt(entries),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  return parseAgentJson(response.content, DreClassificationResultsSchema).map((result) => ({
    ...result,
    category: coerceDreCategory(result.category),
  }));
}
