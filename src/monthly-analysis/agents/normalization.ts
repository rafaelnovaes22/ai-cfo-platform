import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import type { LlmResponse } from "@/llm/types.js";
import {
  NormalizedLedgerEntrySchema,
  type NormalizedLedgerEntry,
} from "@/monthly-analysis/schemas/agents.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/normalization.js";
import { NOOP_LLM_RESPONSE } from "@/monthly-analysis/graph/instrumentation.js";
import { logger } from "@/observability/logger.js";

// RawLedgerEntry é o contrato de entrada para o normalizador.
// Vem do ingest (CSV/PDF/manual) ainda sem o passe estruturado.
export interface RawLedgerEntry {
  entryId: string;
  date: string;
  description: string;
  amountCents: number;
  direction: "in" | "out";
  // true = direção veio de fallback no parse (arquivo sem marcação de sentido).
  // O dre-classifier envia "unknown" ao LLM e pode corrigir pela categoria.
  directionInferred?: boolean;
}

const NormalizedLedgerEntriesSchema = z.array(NormalizedLedgerEntrySchema);

/**
 * Roda o agente de normalização sobre um lote de lançamentos brutos.
 *
 * Garantias:
 * - Se `rawEntries` estiver vazio, retorna [] sem chamar LLM.
 * - Saída do LLM passa por validação Zod (NormalizedLedgerEntrySchema).
 * - Guard pós-LLM verifica que `amountCents` e `date` não foram alterados:
 *   se foram, lança erro nomeando o entryId — esses campos são lei contábil
 *   e qualquer mutação pelo modelo é um bug crítico.
 * - Recuperação de entryId: LLM às vezes alucina UUID novo; se amountCents+date
 *   batem por posição, re-estampamos o entryId correto sem lançar erro.
 *
 * Modelo primário: gpt-4.1-nano (SLM). Ver src/llm/router.ts.
 */
export async function runNormalizationAgent(
  rawEntries: RawLedgerEntry[],
  options: MonthlyAgentRunOptions,
): Promise<NormalizedLedgerEntry[]> {
  const { data } = await runNormalizationAgentWithTelemetry(rawEntries, options);
  return data;
}

/**
 * Variante que devolve a resposta crua do LLM e a latência medida, para que o nó
 * do grafo possa emitir AgentCost / AgentTrace via buildAgentTelemetry.
 *
 * Quando rawEntries é vazio, retorna telemetria zerada (provider="noop") — assim
 * o nó pode emitir um trace mesmo no caminho sem LLM, mantendo schemaPassed=true.
 */
export async function runNormalizationAgentWithTelemetry(
  rawEntries: RawLedgerEntry[],
  options: MonthlyAgentRunOptions,
): Promise<{ data: NormalizedLedgerEntry[]; response: LlmResponse; latencyMs: number }> {
  if (rawEntries.length === 0) {
    return { data: [], response: NOOP_LLM_RESPONSE, latencyMs: 0 };
  }

  const start = Date.now();
  const response = await callLlm({
    task: "normalization",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(rawEntries),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  const normalized = parseAgentJson(response.content, NormalizedLedgerEntriesSchema);
  const data = assertImmutableFinancialFields(rawEntries, normalized);
  return { data, response, latencyMs: Date.now() - start };
}


/**
 * Garante que `amountCents` e `date` venham SEMPRE do extrato (fonte da verdade),
 * nunca do LLM. A normalização só deve produzir descrição/documentType/flags.
 *
 * - Recuperação de entryId: quando o LLM alucina um UUID novo mas amountCents+date
 *   batem por posição, re-estampamos o entryId correto.
 * - Campos imutáveis: quando o entryId é conhecido e o LLM alterou amountCents/date
 *   (alucinação, ex.: "corrigir" 2026→2024), RE-ESTAMPAMOS o valor original em vez
 *   de falhar a análise inteira. Não inventa nada — usa a fonte da verdade e loga.
 * - Só lança quando o entryId é desconhecido E a posição não casa (irrecuperável).
 */
function assertImmutableFinancialFields(
  rawEntries: RawLedgerEntry[],
  normalized: NormalizedLedgerEntry[],
): NormalizedLedgerEntry[] {
  const rawById = new Map(rawEntries.map((entry) => [entry.entryId, entry]));
  const corrected: NormalizedLedgerEntry[] = [];

  for (let i = 0; i < normalized.length; i++) {
    let entry = normalized[i]!;
    let original = rawById.get(entry.entryId);

    // LLM às vezes alucina um entryId novo. Se o tamanho bate e amountCents+date
    // conferem por posição, re-estampamos o entryId correto e continuamos.
    if (!original && normalized.length === rawEntries.length) {
      const positional = rawEntries[i]!;
      if (entry.amountCents === positional.amountCents && entry.date === positional.date) {
        logger.warn(
          { hallucinatedEntryId: entry.entryId, correctEntryId: positional.entryId, idx: i },
          "normalization: LLM alucinou entryId — corrigido por posição",
        );
        entry = { ...entry, entryId: positional.entryId };
        original = positional;
      }
    }

    if (!original) {
      throw new Error(
        `normalization: entryId "${entry.entryId}" devolvido pelo LLM não existe no input original`,
      );
    }

    // amountCents e date são lei contábil — vêm do extrato, não do LLM. Se o modelo
    // os alterou, re-estampamos o valor ORIGINAL (não falha a análise por causa disso).
    if (entry.amountCents !== original.amountCents || entry.date !== original.date) {
      logger.warn(
        {
          entryId: original.entryId,
          recebidoAmount: entry.amountCents, originalAmount: original.amountCents,
          recebidoDate: entry.date, originalDate: original.date,
        },
        "normalization: LLM alterou campo imutável (amountCents/date) — re-estampando valor original",
      );
      entry = { ...entry, amountCents: original.amountCents, date: original.date };
    }

    corrected.push(entry);
  }

  return corrected;
}

export const _internals = { assertImmutableFinancialFields, NormalizedLedgerEntriesSchema };
