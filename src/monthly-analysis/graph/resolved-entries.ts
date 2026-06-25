// Lançamento "resolvido" = já tem categoria e dispensa LLM em normalize/clarity/
// classificação. Duas origens: categoria CONFIRMADA na origem (DRE import) ou
// PREDITA num run anterior (persistida em LedgerEntry.predictedCategory). Com a
// análise consolidada, uma re-análise reprocessava TODO o histórico pelo LLM; isto
// deixa só os lançamentos novos/ambíguos passarem pelo modelo.
import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";

/**
 * Flag de rollback: reusar predictedCategory de runs anteriores. Default ligado.
 * Desligar (MONTHLY_ANALYSIS_REUSE_PREDICTED=false) força reclassificação completa,
 * útil se a taxonomia mudar e a predição antiga ficar inválida.
 */
export function reusePredictedEnabled(): boolean {
  return process.env.MONTHLY_ANALYSIS_REUSE_PREDICTED !== "false";
}

function hasCategory(value: string | null | undefined): boolean {
  return value != null && value !== "";
}

/** Categoria confirmada na origem (fato — precede tudo). */
export function isConfirmed(raw: Pick<RawLedgerEntry, "confirmedCategory">): boolean {
  return hasCategory(raw.confirmedCategory);
}

/** Resolvido: confirmado na origem OU predito num run anterior (se o reuso estiver ligado). */
export function isResolvedEntry(
  raw: Pick<RawLedgerEntry, "confirmedCategory" | "predictedCategory">,
  reusePredicted = reusePredictedEnabled(),
): boolean {
  if (isConfirmed(raw)) return true;
  return reusePredicted && hasCategory(raw.predictedCategory);
}

/** Conjunto de entryIds resolvidos (dispensam normalize/clarity/LLM). */
export function resolvedEntryIds(
  rawEntries: RawLedgerEntry[],
  reusePredicted = reusePredictedEnabled(),
): Set<string> {
  return new Set(
    rawEntries.filter((r) => isResolvedEntry(r, reusePredicted)).map((r) => r.entryId),
  );
}
