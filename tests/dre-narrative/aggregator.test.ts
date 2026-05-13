import { describe, it, expect } from "vitest";
import { aggregateDre } from "@/dre-narrative/aggregator.js";

interface EntryRow {
  amountCents: number;
  direction: string;
  predictedCategory: string | null;
  confirmedCategory: string | null;
}

function entry(amountCents: number, category: string, confirmed = false): EntryRow {
  return {
    amountCents,
    direction: amountCents >= 0 ? "credit" : "debit",
    predictedCategory: confirmed ? null : category,
    confirmedCategory: confirmed ? category : null,
  };
}

describe("dre-narrative/aggregator", () => {
  it("agrega receita bruta e deduções", () => {
    const dre = aggregateDre([
      entry(1_000_000, "receita_bruta"),
      entry(50_000, "deducoes_receita"),
    ]);
    expect(dre.receitaBruta).toBe(1_000_000);
    expect(dre.deducoes).toBe(50_000);
    expect(dre.receitaLiquida).toBe(950_000);
  });

  it("calcula lucro bruto e margem bruta (%)", () => {
    const dre = aggregateDre([
      entry(1_000_000, "receita_bruta"),
      entry(400_000, "cpv_cmv"),
    ]);
    expect(dre.custosDiretos).toBe(400_000);
    expect(dre.lucroBruto).toBe(600_000);
    expect(dre.margemBruta).toBe(60); // 60% com 2 casas
  });

  it("soma despesas operacionais e produz EBITDA", () => {
    const dre = aggregateDre([
      entry(1_000_000, "receita_bruta"),
      entry(100_000, "despesas_pessoal"),
      entry(50_000, "prolabore"),
    ]);
    expect(dre.totalDespesasOp).toBe(150_000);
    expect(dre.ebitda).toBe(1_000_000 - 150_000);
  });

  it("retorna margem zero quando receitaLiquida é zero (sem NaN/Infinity)", () => {
    const dre = aggregateDre([
      entry(100_000, "despesas_pessoal"),
    ]);
    expect(dre.margemBruta).toBe(0);
    expect(dre.margemEbitda).toBe(0);
    expect(dre.margemLiquida).toBe(0);
  });

  it("respeita precedência confirmedCategory > predictedCategory", () => {
    const dre = aggregateDre([
      // Predicted como "receita_bruta", mas confirmed como "outras_receitas".
      {
        amountCents: 100_000,
        direction: "credit",
        predictedCategory: "receita_bruta",
        confirmedCategory: "outras_receitas",
      },
    ]);
    expect(dre.receitaBruta).toBe(0);
    expect(dre.outrasDespesas).toBe(100_000); // outras_receitas+outras_despesas no mesmo bucket
  });

  it("categoriza nao_classificado quando categoria é null", () => {
    const dre = aggregateDre([
      { amountCents: 500, direction: "debit", predictedCategory: null, confirmedCategory: null },
    ]);
    expect(dre.naoClassificado).toBe(500);
  });

  it("EBITDA + depreciacao = EBIT", () => {
    const dre = aggregateDre([
      entry(1_000_000, "receita_bruta"),
      entry(100_000, "depreciacao"),
    ]);
    expect(dre.depreciacao).toBe(100_000);
    expect(dre.ebit).toBe(dre.ebitda - 100_000);
  });

  it("não-P&L (capex, emprestimos, transferenciaInterna) fica isolado do resultado", () => {
    const dre = aggregateDre([
      entry(1_000_000, "receita_bruta"),
      entry(500_000, "capex"),
      entry(200_000, "emprestimos_entrada"),
      entry(50_000, "transferencia_interna"),
    ]);
    expect(dre.capex).toBe(500_000);
    expect(dre.emprestimosEntrada).toBe(200_000);
    expect(dre.transferenciaInterna).toBe(50_000);
    // lucroLiquido NÃO inclui CAPEX nem empréstimos.
    expect(dre.lucroLiquido).toBe(1_000_000);
  });
});
