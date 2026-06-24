import { describe, it, expect, vi, beforeEach } from "vitest";

// Testa o parser de Excel Dre (multi-sheet com meses no nome do sheet).
// Mocka parseDreText (do pdf-dre.ts) para isolar a logica de iteracao de sheets,
// deteccao de mes pelo nome do sheet, e pulo de sheets de resumo.

const parseDreTextMock = vi.fn();
vi.mock("@/ingest/parsers/pdf-dre.js", () => ({
  parseDreText: (...args: unknown[]) => parseDreTextMock(...args),
  detectDreReferenceMonth: () => null,
}));

const xlsxReadMock = vi.fn();
const sheetToCsvMock = vi.fn();
vi.mock("xlsx", () => ({
  read: (...args: unknown[]) => xlsxReadMock(...args),
  utils: { sheet_to_csv: (...args: unknown[]) => sheetToCsvMock(...args) },
}));

const { parseExcelDre } = await import("@/ingest/parsers/excel-dre.js");

function mockWorkbook(sheets: Record<string, string>) {
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

describe("parseExcelDre", () => {
  beforeEach(() => {
    parseDreTextMock.mockReset();
    xlsxReadMock.mockReset();
    sheetToCsvMock.mockReset();
  });

  it("extrai entradas de múltiplos sheets (um por mês)", async () => {
    xlsxReadMock.mockReturnValue(
      mockWorkbook({ GENNAIO: "", FEBBRAIO: "" }),
    );

    sheetToCsvMock
      .mockReturnValueOnce("CUSTOS\nALEGRIA,R$ 173.545,00\nBEM,R$ 800,00\nSOL,R$ 6.330,00")
      .mockReturnValueOnce("CUSTOS\nALEGRIA,R$ 484.935,00\nBEM,R$ 2.500,00\nSOL,R$ 15.580,00");

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

    sheetToCsvMock.mockReturnValue("CUSTOS\nALUGUEL,R$ 4.200,00\nMARKETING,R$ 3.000,00\nGOOGLE,R$ 7.908,10");

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

    sheetToCsvMock
      .mockReturnValueOnce("RECEITAS\nVENDAS,R$ 100.000,00\nPAYPAL,R$ 50.000,00\nGOOGLE,R$ 25.624,00")
      .mockReturnValueOnce("Observação\nReunião com cliente");

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

    sheetToCsvMock.mockReturnValue("RECEITAS\nVENDAS,R$ 50.000,00\nPAYPAL,R$ 30.000,00\nGOOGLE,R$ 10.000,00");

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

    sheetToCsvMock.mockReturnValue("RECEITAS\nVENDAS,R$ 30.000,00\nPAYPAL,R$ 20.000,00\nGOOGLE,R$ 10.000,00");

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-01"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1");

    // Janeiro detectado pelo nome do sheet, ano 2026 do referenceMonth
    expect(result.entries[0]!.date).toBe("2026-01-31");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-01", "t1");
  });

  it("usa referenceMonth quando sheet não tem mês no nome", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ DADOS: "" }));

    sheetToCsvMock.mockReturnValue("RECEITAS\nVENDAS,R$ 30.000,00\nPAYPAL,R$ 20.000,00\nGOOGLE,R$ 10.000,00");

    parseDreTextMock.mockResolvedValue({
      entries: dreEntries("2026-06"),
      orphanCount: 0,
    });

    const result = await parseExcelDre(Buffer.from("fake"), "2026-06", "t1");

    expect(result.entries[0]!.date).toBe("2026-06-30");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-06", "t1");
  });

  it("retorna vazio quando parseDreText falha", async () => {
    xlsxReadMock.mockReturnValue(mockWorkbook({ GENNAIO: "" }));

    sheetToCsvMock.mockReturnValue("RECEITAS\nVENDAS,R$ 50.000,00\nPAYPAL,R$ 30.000,00\nGOOGLE,R$ 10.000,00");

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
