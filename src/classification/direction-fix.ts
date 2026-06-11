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

// Acima deste limiar de confiança, uma categoria cuja natureza contradiz a direção
// CONFIÁVEL do extrato é forte indício de erro no dado ou na classificação.
export const DIRECTION_SAFEGUARD_CONFIDENCE = 0.8;

/**
 * Salvaguarda: quando a direção é CONFIÁVEL (não-inferida — veio com sinal/coluna
 * Tipo do extrato) mas a categoria predita tem natureza OPOSTA com confiança alta,
 * algo está errado (ex.: pró-labore marcado como entrada num extrato com sinal).
 * A direção confiável não é sobrescrita (resolveDirectionFix retorna null aqui),
 * mas o lançamento é marcado para revisão humana em vez de gravado silenciosamente.
 */
export function needsDirectionReview(
  entry: { direction: string; directionInferred: boolean },
  category: string,
  confidence: number,
): boolean {
  if (entry.directionInferred) return false; // inferida → resolveDirectionFix já corrige
  const nature = CATEGORY_NATURE[category as DreCategory] ?? null;
  if (nature === null || nature === entry.direction) return false;
  return confidence >= DIRECTION_SAFEGUARD_CONFIDENCE;
}
