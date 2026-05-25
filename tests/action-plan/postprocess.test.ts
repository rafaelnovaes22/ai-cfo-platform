import { describe, expect, it } from "vitest";
import { parsePlanResponse } from "@/action-plan/generator.js";
import { normalizeActionPlanActions } from "@/action-plan/postprocess.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

function dre(overrides: Partial<DreLines>): DreLines {
  return {
    receitaBruta: 100_000_00,
    deducoes: 0,
    receitaLiquida: 100_000_00,
    custosDiretos: 40_000_00,
    lucroBruto: 60_000_00,
    margemBruta: 60,
    despesasPessoal: 20_000_00,
    prolabore: 0,
    despesasAdm: 10_000_00,
    despesasComerciais: 5_000_00,
    despesasTi: 0,
    despesasViagem: 0,
    despesasJuridicas: 0,
    despesasFinanceiras: 0,
    outrasDespesas: 0,
    outrasReceitasOp: 0,
    totalDespesasOp: 35_000_00,
    ebitda: 25_000_00,
    margemEbitda: 25,
    depreciacao: 0,
    amortizacao: 0,
    ebit: 25_000_00,
    margemOperacional: 25,
    receitaFinanceira: 0,
    resultadoFinanceiro: 0,
    resultadoAntesImpostos: 25_000_00,
    impostos: 5_000_00,
    lucroLiquido: 20_000_00,
    margemLiquida: 20,
    emprestimosEntrada: 0,
    amortizacaoDividas: 0,
    capex: 0,
    transferenciaInterna: 0,
    naoClassificado: 0,
    ...overrides,
  };
}

describe("action-plan/postprocess", () => {
  it("gera plano compativel com microempresa", () => {
    const out = normalizeActionPlanActions(
      [],
      dre({
        receitaBruta: 30_000_00,
        receitaLiquida: 30_000_00,
        custosDiretos: 12_000_00,
        despesasPessoal: 8_000_00,
        ebitda: 5_000_00,
        lucroLiquido: 5_000_00,
        margemLiquida: 16,
      }),
      "servicos",
      "microempresa com dependencia do socio operacional",
    );

    expect(out).toHaveLength(5);
    expect(out.filter((a) => a.horizon === "short")).toHaveLength(3);
    expect(out.every((a) => a.impactCents <= 6_000_00)).toBe(true);
    expect(out.map((a) => a.description).join(" ")).toContain("planilha");
    expect(out.map((a) => a.title).join(" ")).not.toMatch(/CFO|ERP/i);
  });

  it("gera plano de industria para pressao de CMV", () => {
    const out = normalizeActionPlanActions(
      [],
      dre({
        receitaBruta: 800_000_00,
        receitaLiquida: 800_000_00,
        custosDiretos: 520_000_00,
        lucroBruto: 280_000_00,
        margemBruta: 35,
        ebitda: 60_000_00,
        lucroLiquido: 32_000_00,
        margemLiquida: 4,
      }),
      "industria",
      "CMV subiu 7pp por inflacao de insumo",
    );

    const text = out.map((a) => `${a.title} ${a.description} ${a.doneWhen}`).join(" ");

    expect(out.filter((a) => a.horizon === "short")).toHaveLength(3);
    expect(text).toContain("fornecedores");
    expect(text).toContain("ficha tecnica");
    expect(text).toContain("reajuste");
    expect(out.some((a) => a.impactCents === 24_000_00)).toBe(true);
  });

  it("mantem cenario watch preventivo e com impactos modestos", () => {
    const out = normalizeActionPlanActions(
      [],
      dre({
        receitaBruta: 180_000_00,
        receitaLiquida: 180_000_00,
        ebitda: 14_000_00,
        lucroLiquido: 14_400_00,
        margemLiquida: 8,
      }),
      "varejo",
      "watch margem em queda despesa adm subindo ticket medio estavel",
    );

    const text = out.map((a) => `${a.title} ${a.description}`).join(" ");

    expect(out).toHaveLength(5);
    expect(out.every((a) => a.impactCents >= 1_000_00 && a.impactCents <= 5_000_00)).toBe(true);
    expect(text).toContain("Monitorar");
    expect(text).not.toMatch(/cortar|prejuizo|alerta critico/i);
  });

  it("gera plano de CAC e funil quando despesa comercial esta alta", () => {
    const out = normalizeActionPlanActions(
      [],
      dre({
        receitaBruta: 200_000_00,
        receitaLiquida: 200_000_00,
        despesasComerciais: 45_000_00,
        despesasPessoal: 70_000_00,
        ebitda: 25_000_00,
      }),
      "servicos",
      "despesa comercial cresceu sem aumento proporcional de receita cac funil",
    );

    const text = out.map((a) => `${a.title} ${a.description} ${a.doneWhen}`).join(" ");

    expect(text).toMatch(/CAC|lead|cross-sell|conversao/i);
    expect(out.every((a) => a.impactCents <= 40_000_00)).toBe(true);
  });

  it("gera plano de estrutura de capital quando despesa financeira consome ebitda", () => {
    const out = normalizeActionPlanActions(
      [],
      dre({
        receitaBruta: 1_000_000_00,
        receitaLiquida: 1_000_000_00,
        ebitda: 120_000_00,
        despesasFinanceiras: 80_000_00,
        lucroLiquido: 30_000_00,
        margemLiquida: 3,
      }),
      "industria",
      "despesa financeira consome ebitda capital de giro caro taxa 2,8% ao mes",
    );

    const text = out.map((a) => `${a.title} ${a.description} ${a.doneWhen}`).join(" ");

    expect(text).toMatch(/taxa|capital de giro|credito|recebiveis/i);
    expect(text).toContain("<=1,8% a.m.");
  });

  it("corrige impacto nao positivo sem mascarar horizontes incompletos", () => {
    const parsed = parsePlanResponse({
      actions: [
        { horizon: "short", title: "Aaa", description: "Descricao valida", effortLevel: "low", riskLevel: "low", impactCents: 0, doneWhen: "feito" },
        { horizon: "short", title: "Bbb", description: "Descricao valida", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito" },
        { horizon: "short", title: "Ccc", description: "Descricao valida", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito" },
        { horizon: "medium", title: "Ddd", description: "Descricao valida", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito" },
        { horizon: "long", title: "Eee", description: "Descricao valida", effortLevel: "low", riskLevel: "low", impactCents: 1, doneWhen: "feito" },
      ],
    });

    expect(parsed.actions[0]?.impactCents).toBe(50_000);
    expect(() => parsePlanResponse({
      actions: parsed.actions.map((a) => ({ ...a, horizon: "short" })),
    })).toThrow();
  });
});
