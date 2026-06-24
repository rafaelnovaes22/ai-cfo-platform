import { describe, it, expect, vi } from "vitest";

// Testa o pré-processamento buildSheetText isoladamente: converte a matriz
// numérica crua (sheet_to_json header:1) no formato esperado pelo extrator LLM
// de DRE (parseDreText). Injeta matrizes literais no formato do sheet real
// ("RELATORIO FINANCEIRO 2026.xlsx", layout 4-blocos) via mock do xlsx.

// Mocka sheet_to_json para devolver a matriz anexada ao stub do sheet.
const sheetToJsonMock = vi.fn();
vi.mock("xlsx", () => ({
  utils: { sheet_to_json: (...args: unknown[]) => sheetToJsonMock(...args) },
}));

const { buildSheetText } = await import("@/ingest/parsers/excel-dre.js");

// Stub minimo de WorkSheet — buildSheetText só chama sheet_to_json(sheet, ...)
// e ignora o resto. Anexamos a matriz que o mock deve retornar.
function stubSheet(matrix: unknown[][]): never {
  sheetToJsonMock.mockReturnValueOnce(matrix);
  return { __stub: true } as never;
}

describe("buildSheetText", () => {
  it("converte layout 4-blocos em texto linear (descartando recap G-H)", () => {
    const matrix: unknown[][] = [
      ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 812682.08, ""],
      ["ALEGRIA", 173545, "", "", "PAYPAL MARCO EUROPA", 464000, "", "", "CUSTOS", 347573, ""],
      ["BEM BRASIL", 800, "", "", "PAYPAL MARCO BRASIL", 159602.46, "", "", "LUCRO BRUTO", 465109.08, ""],
      ["BRASIL SHOW", -570, "", "", "PAYPAL RPT BRASIL", 35374.37, "", "", "", "", ""],
      ["TOTAL", 347573, "", "", "TOTAL", 812682.08, "", "", "", "", ""],
      ["DESPESAS", "", "", "", "", "", "", "", "", "", ""],
      ["MARKETING", 3000, "", "", "", "", "", "", "", "", ""],
      ["GOOGLE", 7908.1, "", "", "", "", "", "", "", "", ""],
      ["TOTAL", 141482.1, "", "", "", "", "", "", "", "", ""],
    ];

    const text = buildSheetText(stubSheet(matrix));
    const lines = text.split("\n");

    // Esperado: 3 custos + 3 receitas + 2 despesas = 8 linhas
    expect(lines.length).toBe(8);
    expect(lines).toContain("ALEGRIA,R$ 173.545,00");
    expect(lines).toContain("BEM BRASIL,R$ 800,00");
    expect(lines).toContain("BRASIL SHOW,-R$ 570,00"); // sinal negativo preservado
    expect(lines).toContain("PAYPAL MARCO EUROPA,R$ 464.000,00");
    expect(lines).toContain("PAYPAL MARCO BRASIL,R$ 159.602,46");
    expect(lines).toContain("MARKETING,R$ 3.000,00");
    expect(lines).toContain("GOOGLE,R$ 7.908,10");

    // Subtotais e cabeçalhos de seção NÃO aparecem
    expect(lines.find((l) => l.startsWith("TOTAL"))).toBeUndefined();
    expect(lines.find((l) => l.startsWith("LUCRO BRUTO"))).toBeUndefined();
    expect(lines.find((l) => /^CUSTOS,/.test(l))).toBeUndefined();
    expect(lines.find((l) => /^RECEITAS,/.test(l))).toBeUndefined();
    expect(lines.find((l) => /^DESPESAS,/.test(l))).toBeUndefined();
  });

  it("formata valores no padrão BR (vírgula decimal, ponto milhar)", () => {
    const matrix: unknown[][] = [
      ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 0, ""],
      ["ALGUM CUSTO", 1234567.89, "", "", "ALGUMA RECEITA", 999, "", "", "", "", ""],
    ];

    const text = buildSheetText(stubSheet(matrix));

    expect(text).toContain("ALGUM CUSTO,R$ 1.234.567,89");
    expect(text).toContain("ALGUMA RECEITA,R$ 999,00");
  });

  it("pula células vazias e 'R$ -' (sem valor numérico)", () => {
    const matrix: unknown[][] = [
      ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 0, ""],
      ["COM VALOR", 1000, "", "", "SEM VALOR", "", "", "", "", "", ""],
      ["ZERO", 0, "", "", "TRACEJO", "R$ -", "", "", "", "", ""],
    ];

    const text = buildSheetText(stubSheet(matrix));
    const lines = text.split("\n").filter(Boolean);

    expect(lines).toContain("COM VALOR,R$ 1.000,00");
    // ZERO e SEM VALOR e TRACEJO pulados (sem valor numérico ou zerado)
    expect(lines.find((l) => l.startsWith("ZERO"))).toBeUndefined();
    expect(lines.find((l) => l.startsWith("SEM VALOR"))).toBeUndefined();
    expect(lines.find((l) => l.startsWith("TRACEJO"))).toBeUndefined();
  });

  it("retorna string vazia quando sheet não tem cabeçalhos CUSTOS/RECEITAS", () => {
    const matrix: unknown[][] = [
      ["Observação"],
      ["Reunião com cliente"],
    ];

    const text = buildSheetText(stubSheet(matrix));
    expect(text).toBe("");
  });

  it("retorna string vazia para sheet sem linhas", () => {
    const text = buildSheetText(stubSheet([]));
    expect(text).toBe("");
  });

  it("aceita valores em string numérica quando célula vem formatada", () => {
    const matrix: unknown[][] = [
      ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 0, ""],
      ["CUSTO STR", "1.234,56", "", "", "RECEITA STR", "R$ 2.500,00", "", "", "", "", ""],
    ];

    const text = buildSheetText(stubSheet(matrix));
    const lines = text.split("\n").filter(Boolean);

    // toNumber interpreta tanto "1.234,56" (BR) quanto "R$ 2.500,00" (BR com prefixo)
    expect(lines).toContain("CUSTO STR,R$ 1.234,56");
    expect(lines).toContain("RECEITA STR,R$ 2.500,00");
  });
});
