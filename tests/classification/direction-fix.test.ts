import { describe, it, expect } from "vitest";
import { resolveDirectionFix } from "@/classification/direction-fix.js";
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
