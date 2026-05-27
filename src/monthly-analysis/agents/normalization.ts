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
import { logger } from "@/observability/logger.js";

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
 * - Recuperação de entryId: LLM às vezes alucina UUID novo; se amountCents+date
 *   batem por posição, re-estampamos o entryId correto sem lançar erro.
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

  return assertImmutableFinancialFields(rawEntries, normalized);
}

/**
 * Guard que valida que o LLM não tocou em `amountCents` nem `date`.
 * Esses campos vêm do extrato/planilha do cliente e não podem ser inventados
 * pelo modelo — qualquer divergência é tratada como erro fatal.
 *
 * Recuperação de entryId: quando o LLM alucina um UUID novo mas os campos
 * imutáveis (amountCents + date) batem por posição, re-estampamos o entryId
 * correto e logamos aviso — sem lançar erro.
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
          "normalization: LLM alucinoui entryId — corrigido por posição",
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

    corrected.push(entry);
  }

  return corrected;
}

export const _internals = { assertImmutableFinancialFields, NormalizedLedgerEntriesSchema };
