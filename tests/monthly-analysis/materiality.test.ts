import { describe, it, expect } from "vitest";
import { materialityFloorCents, filterImmaterialActions } from "@/monthly-analysis/materiality.js";
import type { ActionPlanDraft, ActionPlanItemDraft } from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

function dreWithLucro(lucroLiquidoCents: number): DreLines {
  // Só lucroLiquido importa para o piso; o resto é preenchido com zero.
  return { lucroLiquido: lucroLiquidoCents } as DreLines;
}

function action(overrides: Partial<ActionPlanItemDraft>): ActionPlanItemDraft {
  return {
    horizon: "short",
    title: "Ação",
    description: "Descrição operacional com número 10%.",
    effortLevel: "low",
    riskLevel: "low",
    impactCents: 100_00,
    deadlineDays: 15,
    doneWhen: "Critério mensurável com R$ 1.000.",
    evidenceRefs: ["dre:lucroLiquido"],
    assumptions: [],
    confidence: 0.7,
    ...overrides,
  };
}

describe("monthly-analysis/materiality", () => {
  it("piso = 3% do lucro líquido mensal; lucro <= 0 → piso 0", () => {
    expect(materialityFloorCents(dreWithLucro(11_712_00))).toBe(351_36); // 3% de R$ 11.712
    expect(materialityFloorCents(dreWithLucro(0))).toBe(0);
    expect(materialityFloorCents(dreWithLucro(-5_000_00))).toBe(0);
  });

  it("piso 0 não filtra nada (empresa em crise)", () => {
    const plan: ActionPlanDraft = { actions: [action({ impactCents: 1_00 })] };
    const { plan: out, removed } = filterImmaterialActions(plan, 0);
    expect(out.actions).toHaveLength(1);
    expect(removed).toHaveLength(0);
  });

  it("descarta a 2ª short imaterial e preserva a material (caso R$ 46 vs R$ 1.000)", () => {
    const plan: ActionPlanDraft = {
      actions: [
        action({ horizon: "short", title: "Acelere recebíveis", impactCents: 1_000_00 }),
        action({ horizon: "short", title: "Otimize licenças", impactCents: 46_00 }),
        action({ horizon: "medium", title: "Novo pacote", impactCents: 3_000_00 }),
        action({ horizon: "long", title: "Reserva", impactCents: 5_856_00 }),
        action({ horizon: "long", title: "Reinvestir", impactCents: 500_00 }),
      ],
    };
    const floor = materialityFloorCents(dreWithLucro(11_712_00)); // R$ 351,36
    const { plan: out, removed } = filterImmaterialActions(plan, floor);

    const titles = out.actions.map((a) => a.title);
    expect(titles).toContain("Acelere recebíveis");
    expect(titles).not.toContain("Otimize licenças"); // R$ 46 < R$ 351 → fora
    expect(titles).toContain("Reinvestir"); // R$ 500 > R$ 351 → fica
    expect(removed.map((a) => a.title)).toEqual(["Otimize licenças"]);
  });

  it("não esvazia um horizonte: mantém a ação de maior impacto se todas forem imateriais", () => {
    const plan: ActionPlanDraft = {
      actions: [
        action({ horizon: "short", title: "Material", impactCents: 1_000_00 }),
        action({ horizon: "medium", title: "Fraca A", impactCents: 30_00 }),
        action({ horizon: "medium", title: "Fraca B", impactCents: 80_00 }),
        action({ horizon: "long", title: "Longa material", impactCents: 2_000_00 }),
      ],
    };
    const { plan: out } = filterImmaterialActions(plan, 351_36);
    const medium = out.actions.filter((a) => a.horizon === "medium");
    expect(medium).toHaveLength(1);
    expect(medium[0]?.title).toBe("Fraca B"); // a de maior impacto sobrevive
  });
});
