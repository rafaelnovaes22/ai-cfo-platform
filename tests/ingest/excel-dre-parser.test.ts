import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa o parser de Excel DRE (multi-sheet com meses no nome do sheet).
// Mocka parseDreText (do pdf-dre.ts) para isolar a logica de iteracao de sheets,
// deteccao de mes pelo nome do sheet, e pulo de sheets de resumo.
// Mocka XLSX.utils.sheet_to_json com matrizes numericas (layout 4-blocos),
// refletindo o preprocessamento introduzido em fix(ingest): layout 4-blocos.

const parseDreTextMock = vi.fn();
vi.mock("@/ingest/parsers/pdf-dre.js", () => ({
  parseDreText: (...args: unknown[]) => parseDreTextMock(...args),
  detectDreReferenceMonth: () => null,
}));

const xlsxReadMock = vi.fn();
const sheetToJsonMock = vi.fn();
vi.mock("xlsx", () => ({
  read: (...args: unknown[]) => xlsxReadMock(...args),
  utils: { sheet_to_json: (...args: unknown[]) => sheetToJsonMock(...args) },
}));

const { parseExcelDre } = await import("@/ingest/parsers/excel-dre.js");

function mockWorkbook(sheets: Record<string, unknown>) {
  return {
    SheetNames: Object.keys(sheets),
    Sheets: Object.fromEntries(
      Object.keys(sheets).map((name) => [name, { sheetName: name }]),
    ),
  };
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

function dreEntries(month: string): unknown[] {
  return [
    {
      date: lastDayOfMonth(month),
      description: "PAYPAL",
      amountCents: 46400000,
      direction: "credit",
      directionSource: "explicit",
      confirmedCategory: "receita_bruta",
      correctionSource: "dre-import",
      classificationConfidence: 1.0,
    },
  ];
}

// Matriz 4-blocos com 1 linha de lancamento por bloco + recap G-H (descartado).
// Reproduz o layout de "RELATORIO FINANCEIRO 2026.xlsx" de forma sanitizada.
function fourBlockMatrix(
  custos: [string, number][],
  receitas: [string, number][],
): unknown[][] {
  const rows: unknown[][] = [
    ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 0, ""],
  ];
  const maxRows = Math.max(custos.length, receitas.length);
  for (let i = 0; i < maxRows; i++) {
    const c = custos[i] ?? ["", ""];
    const r = receitas[i] ?? ["", ""];
    rows.push([c[0], c[1], "", "", r[0], r[1], "", "", "", "", ""]);
  }
  return rows;
}

describe("parseExcelDre", () => {
  beforeEach(() => {
    parseDreTextMock.mockReset();
    xlsxReadMock.mockReset();
    sheetToJsonMock.mockReset();
  });

  it("extrai entradas de múltiplos sheets (um por mês)", async () => {
    xlsxReadMock.mockReturnValue(
      mockWorkbook({ GENNAIO: "", FEBBRAIO: "" }),
    );

    sheetToJsonMock
      .mockReturnValueOnce(fourBlockMatrix(
        [["ALEGRIA", 173545], ["BEM", 800], ["SOL", 6330]],
        [["PAYPAL", 464000], ["GOOGLE", 25624]],
      ))
      .mockReturnValueOnce(fourBlockMatrix(
        [["ALEGRIA", 484935], ["BEM", 2500], ["SOL", 15580]],
        [["PAYPAL", 609907]],
      ));

    parseDreTextMock
      .mockResolvedValueOnce({ entries: dreEntries("2026-01"), orphanCount: 0 })
      .mockResolvedValueOnce({ entries: dreEntries("2026-02"), orphanCount: 0 });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-01", "t1");

    expect(result.entries.length).toBe(2); // 1 por sheet
    expect(result.entries[0]!.date).toBe("2026-01-31");
    expect(result.entries[1]!.date).toBe("2026-02-28");
    expect(parseDreTextMock).toHaveBeenCalledTimes(2);
    // Janeiro detectado pelo nome do sheet, ano do referenceMonth
    expect(parseDreTextMock).toHaveBeenNthCalledWith(1, expect.any(String), "2026-01", "t1");
    expect(parseDreTextMock).toHaveBeenNthCalledWith(2, expect.any(String), "2026-02", "t1");
  });

  it("pula sheets de resumo (RESUMO, SUMMARY)", async () => {
    xlsxReadMock.mockReturnValue(
      mockWorkbook({ GENNAIO: "", "RESUMO RELATORIO 2026": "" }),
    );

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["ALUGUEL", 4200], ["MARKETING", 3000], ["GOOGLE", 7908.1]],
      [["VENDAS", 100000]],
    ));

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-01"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-01", "t1");

    expect(parseDreTextMock).toHaveBeenCalledTimes(1); // só GENNAIO
    expect(result.entries.length).toBe(1);
  });

  it("pula sheets sem valores monetários", async () => {
    xlsxReadMock.mockReturnValue(
      mockWorkbook({ GENNAIO: "", NOTAS: "" }),
    );

    sheetToJsonMock
      .mockReturnValueOnce(fourBlockMatrix(
        [["VENDAS", 100000], ["PAYPAL", 50000], ["GOOGLE", 25624]],
        [],
      ))
      // Sheet "NOTAS": sem coluna RECEITAS detectada → buildSheetText retorna ""
      .mockReturnValueOnce([["Observação"], ["Reunião com cliente"]]);

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-01"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-01", "t1");

    expect(parseDreTextMock).toHaveBeenCalledTimes(1); // só GENNAIO
    expect(result.entries.length).toBe(1);
  });

  it("detecta mês pelo nome do sheet em italiano (MARZO)", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ MARZO: "" }));

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["VENDAS", 50000]],
      [["PAYPAL", 30000], ["GOOGLE", 10000]],
    ));

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-03"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-03", "t1");

    expect(result.entries[0]!.date).toBe("2026-03-31");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-03", "t1");
  });

  it("detecta mês pelo nome do sheet em português (JANEIRO)", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ JANEIRO: "" }));

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["VENDAS", 30000]],
      [["PAYPAL", 20000], ["GOOGLE", 10000]],
    ));

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-01"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1");

    // Janeiro detectado pelo nome do sheet, ano 2026 do referenceMonth
    expect(result.entries[0]!.date).toBe("2026-01-31");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-01", "t1");
  });

  it("detecta mês pelo nome do sheet em português (AGOSTO)", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ AGOSTO: "" }));

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["VENDAS", 30000]],
      [["PAYPAL", 20000], ["GOOGLE", 10000]],
    ));

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-08"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-08", "t1", { currentMonth: "2026-08" });

    expect(result.entries[0]!.date).toBe("2026-08-31");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-08", "t1");
  });

  it("usa referenceMonth quando sheet não tem mês no nome", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ DADOS: "" }));

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["VENDAS", 30000]],
      [["PAYPAL", 20000], ["GOOGLE", 10000]],
    ));

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-06"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1");

    expect(result.entries[0]!.date).toBe("2026-06-30");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-06", "t1");
  });

  it("usa o ano do nome do arquivo quando sheets trazem apenas meses", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ GENNAIO: "", DICEMBRE: "" }));

    sheetToJsonMock
      .mockReturnValueOnce(fourBlockMatrix(
        [["VENDAS", 30000]],
        [["PAYPAL", 20000], ["GOOGLE", 10000]],
      ))
      .mockReturnValueOnce(fourBlockMatrix(
        [["VENDAS", 30000]],
        [["PAYPAL", 20000], ["GOOGLE", 10000]],
      ));

    parseDreTextMock
      .mockResolvedValueOnce({ entries: dreEntries("2025-01"), orphanCount: 0 })
      .mockResolvedValueOnce({ entries: dreEntries("2025-12"), orphanCount: 0 });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1", {
      fileName: "RELATORIO FINANCEIRO 2025.xlsx",
      currentMonth: "2026-06",
    });

    expect(result.entries[0]!.date).toBe("2025-01-31");
    expect(result.entries[1]!.date).toBe("2025-12-31");
    expect(parseDreTextMock).toHaveBeenNthCalledWith(1, expect.any(String), "2025-01", "t1");
    expect(parseDreTextMock).toHaveBeenNthCalledWith(2, expect.any(String), "2025-12", "t1");
  });

  it("não processa sheets resolvidos para competência posterior ao mês vigente", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ GIUGNO: "", LUGLIO: "" }));

    sheetToJsonMock
      .mockReturnValueOnce(fourBlockMatrix(
        [["VENDAS", 30000]],
        [["PAYPAL", 20000], ["GOOGLE", 10000]],
      ))
      .mockReturnValueOnce(fourBlockMatrix(
        [["VENDAS", 30000]],
        [["PAYPAL", 20000], ["GOOGLE", 10000]],
      ));

    parseDreTextMock.mockResolvedValueOnce({ entries: dreEntries("2026-06"), orphanCount: 0 });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1", {
      currentMonth: "2026-06",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.date).toBe("2026-06-30");
    expect(parseDreTextMock).toHaveBeenCalledTimes(1);
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-06", "t1");
  });

  it("retorna vazio quando parseDreText falha", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ GENNAIO: "" }));

    sheetToJsonMock.mockReturnValue(fourBlockMatrix(
      [["VENDAS", 50000]],
      [["PAYPAL", 30000], ["GOOGLE", 10000]],
    ));

    parseDreTextMock.mockResolvedValue({ entries: [], orphanCount: 0 });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-01", "t1");

    expect(result.entries).toEqual([]);
    expect(result.orphanCount).toBe(0);
  });

  it("retorna vazio para buffer vazio", async () => {
    const result = await parseExcelDre(Buffer.alloc(0), "2026-01", "t1");
    expect(result.entries).toEqual([]);
    expect(parseDreTextMock).not.toHaveBeenCalled();
  });
});
