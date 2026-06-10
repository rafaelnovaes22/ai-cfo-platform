import { CATEGORY_NATURE, type DreCategory } from "@/classification/taxonomy.js";

// Regra única de correção de direção (PR #164): a categoria só vence quando a
// direção veio de inferência (arquivo sem coluna Tipo e sem sinais sistemáticos).
// Direção confiável (extrato com sinal, coluna Tipo, entrada manual) é fato do
// documento e NUNCA é sobrescrita por predição ou correção de categoria.
// Usada pelo classifier BullMQ, pelo nó dre-classifier (LangGraph) e pela rota
// de correção manual PATCH /classification/entries/:entryId/correct.
export function resolveDirectionFix(
  entry: { direction: string; directionInferred: boolean },
  category: string,
): { direction: "credit" | "debit" } | null {
  if (!entry.directionInferred) return null;
  const nature = CATEGORY_NATURE[category as DreCategory] ?? null;
  if (nature === null || nature === entry.direction) return null;
  return { direction: nature };
}
