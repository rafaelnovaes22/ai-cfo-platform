import { describe, it, expect } from "vitest";
import {
  resolveDirectionFix,
  needsDirectionReview,
  DIRECTION_SAFEGUARD_CONFIDENCE,
} from "@/classification/direction-fix.js";
import { DRE_CATEGORIES, CATEGORY_NATURE } from "@/classification/taxonomy.js";

describe("classification/direction-fix — regra única de correção de direção", () => {
  it("flipa credit inferido quando a categoria é de despesa", () => {
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "simples_nacional"))
      .toEqual({ direction: "debit" });
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "despesas_administrativas"))
      .toEqual({ direction: "debit" });
  });

  it("flipa debit inferido quando a categoria é de receita", () => {
    expect(resolveDirectionFix({ direction: "debit", directionInferred: true }, "receita_bruta"))
      .toEqual({ direction: "credit" });
  });

  it("não flipa quando a direção NÃO é inferida (direção confiável vence a categoria)", () => {
    expect(resolveDirectionFix({ direction: "credit", directionInferred: false }, "simples_nacional"))
      .toBeNull();
  });

  it("não flipa quando a categoria concorda com a direção", () => {
    expect(resolveDirectionFix({ direction: "debit", directionInferred: true }, "simples_nacional"))
      .toBeNull();
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "receita_bruta"))
      .toBeNull();
  });

  it("não flipa em categorias de natureza neutra ou desconhecida", () => {
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "nao_classificado"))
      .toBeNull();
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "transferencia_interna"))
      .toBeNull();
    expect(resolveDirectionFix({ direction: "credit", directionInferred: true }, "categoria_invalida"))
      .toBeNull();
  });

  it("cobre todas as categorias da taxonomia sem lançar", () => {
    for (const category of DRE_CATEGORIES) {
      const fix = resolveDirectionFix({ direction: "credit", directionInferred: true }, category);
      const nature = CATEGORY_NATURE[category];
      if (nature === "debit") expect(fix).toEqual({ direction: "debit" });
      else expect(fix).toBeNull();
    }
  });
});

describe("classification/needsDirectionReview — salvaguarda de contradição", () => {
  const HIGH = DIRECTION_SAFEGUARD_CONFIDENCE;
  const LOW = DIRECTION_SAFEGUARD_CONFIDENCE - 0.01;

  it("marca review: direção confiável que contradiz categoria com alta confiança (pró-labore como entrada)", () => {
    expect(needsDirectionReview({ direction: "credit", directionInferred: false }, "prolabore", HIGH)).toBe(true);
    expect(needsDirectionReview({ direction: "debit", directionInferred: false }, "receita_bruta", 0.95)).toBe(true);
  });

  it("não marca review quando a confiança da categoria é baixa", () => {
    expect(needsDirectionReview({ direction: "credit", directionInferred: false }, "prolabore", LOW)).toBe(false);
  });

  it("não marca review quando a direção é inferida (o corretor já resolve)", () => {
    expect(needsDirectionReview({ direction: "credit", directionInferred: true }, "prolabore", 0.99)).toBe(false);
  });

  it("não marca review quando a categoria concorda com a direção", () => {
    expect(needsDirectionReview({ direction: "debit", directionInferred: false }, "prolabore", 0.99)).toBe(false);
    expect(needsDirectionReview({ direction: "credit", directionInferred: false }, "receita_bruta", 0.99)).toBe(false);
  });

  it("não marca review em categoria de natureza neutra/desconhecida", () => {
    expect(needsDirectionReview({ direction: "credit", directionInferred: false }, "transferencia_interna", 0.99)).toBe(false);
    expect(needsDirectionReview({ direction: "credit", directionInferred: false }, "categoria_invalida", 0.99)).toBe(false);
  });
});
