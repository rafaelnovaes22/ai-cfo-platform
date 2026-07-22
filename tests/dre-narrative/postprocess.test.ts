import { describe, expect, it } from "vitest";
import { normalizeNarrativeCards, type NarrativeCard } from "@/dre-narrative/postprocess.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

const cards: NarrativeCard[] = [
  { type: "critical_gap", title: "x", body: "x", evidence: [] },
  { type: "attention", title: "x", body: "x", evidence: [] },
  { type: "healthy", title: "x", body: "x", evidence: [] },
];

function dre(overrides: Partial<DreLines>): DreLines {
  return {
    receitaBruta: 100_000_00,
    deducoes: 0,
    receitaLiquida: 100_000_00,
    custosDiretos: 65_000_00,
    lucroBruto: 35_000_00,
    margemBruta: 35,
    despesasPessoal: 40_000_00,
    prolabore: 0,
    despesasAdm: 0,
    despesasComerciais: 0,
    despesasTi: 0,
    despesasViagem: 0,
    despesasJuridicas: 0,
    despesasFinanceiras: 0,
    outrasDespesas: 0,
    outrasReceitasOp: 0,
    totalDespesasOp: 40_000_00,
    ebitda: -5_000_00,
    margemEbitda: -5,
    depreciacao: 0,
    amortizacao: 0,
    ebit: -5_000_00,
    margemOperacional: -5,
    receitaFinanceira: 0,
    resultadoFinanceiro: 0,
    resultadoAntesImpostos: -5_000_00,
    impostos: 0,
    lucroLiquido: -3_800_00,
    margemLiquida: -5,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
    ...overrides,
  };
}

describe("dre-narrative/postprocess", () => {
  it("normaliza prejuízo com evidence canônica de margem e folha", () => {
    const out = normalizeNarrativeCards(cards, dre({}), "servicos", "formal");
    const critical = out.find((card) => card.type === "critical_gap")!;

    expect(critical.evidence.map((e) => e.metric)).toContain("margemLiquida");
    expect(critical.evidence.map((e) => e.metric)).toContain("despesasPessoal");
    expect(critical.evidence.map((e) => e.metric)).toContain("despesasPessoal/receitaLiquida");
    expect(critical.body).toContain("Reduza");
  });

  it("normaliza varejo com CMV alto em attention", () => {
    const out = normalizeNarrativeCards(cards, dre({ lucroLiquido: 30_000_00, margemLiquida: 30 }), "varejo", "formal");
    const attention = out.find((card) => card.type === "attention")!;

    expect(attention.body).toContain("o que foi pago aos fornecedores");
    expect(attention.body).toContain("o que sobrou apos pagar os fornecedores");
    expect(attention.evidence.map((e) => e.metric)).toEqual(["cmv", "margemBruta"]);
  });
});
