import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import {
  NormalizedLedgerEntrySchema,
  type NormalizedLedgerEntry,
} from "@/monthly-analysis/schemas/agents.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/normalization.js";

// RawLedgerEntry é o contrato de entrada para o normalizador.
// Vem do ingest (CSV/PDF/manual) ainda sem o passe estruturado.
export interface RawLedgerEntry {
  entryId: string;
  date: string;
  description: string;
  amountCents: number;
  direction: "in" | "out";
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
 *
 * Modelo primário: gpt-4.1-nano (SLM). Ver src/llm/router.ts.
 */
export async function runNormalizationAgent(
  rawEntries: RawLedgerEntry[],
  options: MonthlyAgentRunOptions,
): Promise<NormalizedLedgerEntry[]> {
  if (rawEntries.length === 0) return [];

  const response = await callLlm({
    task: "normalization",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(rawEntries),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  const normalized = parseAgentJson(response.content, NormalizedLedgerEntriesSchema);

  assertImmutableFinancialFields(rawEntries, normalized);

  return normalized;
}

/**
 * Guard que valida que o LLM não tocou em `amountCents` nem `date`.
 * Esses campos vêm do extrato/planilha do cliente e não podem ser inventados
 * pelo modelo — qualquer divergência é tratada como erro fatal.
 */
function assertImmutableFinancialFields(
  rawEntries: RawLedgerEntry[],
  normalized: NormalizedLedgerEntry[],
): void {
  const rawById = new Map(rawEntries.map((entry) => [entry.entryId, entry]));

  for (const entry of normalized) {
    const original = rawById.get(entry.entryId);
    if (!original) {
      throw new Error(
        `normalization: entryId "${entry.entryId}" devolvido pelo LLM não existe no input original`,
      );
    }

    if (entry.amountCents !== original.amountCents) {
      throw new Error(
        `normalization: LLM alterou amountCents do entryId "${entry.entryId}" ` +
          `(original=${original.amountCents}, recebido=${entry.amountCents})`,
      );
    }

    if (entry.date !== original.date) {
      throw new Error(
        `normalization: LLM alterou date do entryId "${entry.entryId}" ` +
          `(original="${original.date}", recebido="${entry.date}")`,
      );
    }
  }
}

export const _internals = { assertImmutableFinancialFields, NormalizedLedgerEntriesSchema };
