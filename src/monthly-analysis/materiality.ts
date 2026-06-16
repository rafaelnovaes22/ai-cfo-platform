import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { ActionPlanDraft, ActionPlanItemDraft } from "@/monthly-analysis/schemas/agents.js";

// Piso de materialidade: 3% do lucro líquido mensal. Abaixo disso, uma ação é
// ruído para o porte da empresa (ex.: "cortar R$ 46 de licença" num negócio que
// lucra R$ 11 mil/mês). Mais permissivo que o alvo do prompt (5%) de propósito —
// é uma rede de segurança contra o CLARAMENTE imaterial, não o ideal.
// Lucro <= 0 → piso 0 (empresa em crise: toda economia conta, não filtra).
export function materialityFloorCents(dre: DreLines): number {
  return Math.round(0.03 * Math.max(dre.lucroLiquido, 0));
}

export interface MaterialityFilterResult {
  plan: ActionPlanDraft;
  removed: ActionPlanItemDraft[];
}

// Remove ações abaixo do piso, MAS preserva a estrutura de 3 horizontes: se um
// horizonte ficaria vazio, mantém sua ação de maior impacto (melhor 1 ação fraca
// do que um horizonte sem nada). Determinístico — rede de segurança para quando o
// LLM gera micro-corte só para cumprir a cota mínima de ações short.
export function filterImmaterialActions(
  plan: ActionPlanDraft,
  floorCents: number,
): MaterialityFilterResult {
  if (floorCents <= 0) return { plan, removed: [] };

  const horizons: ActionPlanItemDraft["horizon"][] = ["short", "medium", "long"];
  const kept: ActionPlanItemDraft[] = [];
  const keptSet = new Set<ActionPlanItemDraft>();

  for (const h of horizons) {
    const items = plan.actions.filter((a) => a.horizon === h);
    if (items.length === 0) continue;
    const material = items.filter((a) => a.impactCents >= floorCents);
    const survivors = material.length > 0
      ? material
      : [items.reduce((a, b) => (b.impactCents > a.impactCents ? b : a))];
    for (const s of survivors) { kept.push(s); keptSet.add(s); }
  }

  const removed = plan.actions.filter((a) => !keptSet.has(a));
  return { plan: { actions: kept }, removed };
}
