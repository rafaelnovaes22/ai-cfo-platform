import { describe, expect, it } from "vitest";
import { buildNarrativeSignals } from "@/dre-narrative/prompts.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

function dre(overrides: Partial<DreLines>): DreLines {
  return {
    receitaBruta: 100_000_00,
    deducoes: 0,
    receitaLiquida: 100_000_00,
    custosDiretos: 65_000_00,
    lucroBruto: 35_000_00,
    margemBruta: 35,
    despesasPessoal: 30_000_00,
    prolabore: 10_000_00,
    despesasAdm: 0,
    despesasComerciais: 0,
    despesasTi: 0,
    despesasViagem: 0,
    despesasJuridicas: 0,
    despesasFinanceiras: 4_000_00,
    outrasDespesas: 0,
    outrasReceitasOp: 50_000_00,
    totalDespesasOp: -10_000_00,
    ebitda: 45_000_00,
    margemEbitda: 45,
    depreciacao: 0,
    amortizacao: 0,
    ebit: 20_000_00,
    margemOperacional: 20,
    receitaFinanceira: 0,
    resultadoFinanceiro: -4_000_00,
    resultadoAntesImpostos: 16_000_00,
    impostos: 0,
    lucroLiquido: 16_000_00,
    margemLiquida: 16,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
    ...overrides,
  };
}

describe("dre-narrative/prompts", () => {
  it("expõe gatilhos calculados para o narrador", () => {
    const signals = buildNarrativeSignals(dre({}), "varejo", "lucroReal");

    expect(signals).toContain("pessoal + pro-labore >= 40%");
    expect(signals).toContain("varejo com CMV > 60%");
    expect(signals).toContain("despesas financeiras > 15%");
    expect(signals).toContain("outras receitas operacionais > 0");
  });

  it("marca margem baixa sem arredondar para cima", () => {
    const signals = buildNarrativeSignals(dre({ lucroLiquido: 4_990_00, margemLiquida: 4.99 }), "servicos", "simples");

    expect(signals).toContain("Margem liquida: 4.99%");
    expect(signals).toContain("margemLiquida < 5%");
  });
});
