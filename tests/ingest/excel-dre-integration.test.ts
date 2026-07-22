import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

// Teste de integração: roda parseExcelDre com um workbook xlsx REAL gerado em
// memória (layout 4-blocos, multi-sheet, meses em italiano + sheet de resumo).
// Isola o LLM mockando parseDreText — valida o pipeline XLSX → buildSheetText
// → parseDreText (dispatch por sheet, detecção de mês, pulo de resumo, datas).

const parseDreTextMock = vi.fn();
vi.mock("@/ingest/parsers/pdf-dre.js", () => ({
  parseDreText: (...args: unknown[]) => parseDreTextMock(...args),
  detectDreReferenceMonth: () => null,
}));

const { parseExcelDre } = await import("@/ingest/parsers/excel-dre.js");

function aoaToSheet(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

// Replica o layout 4-blocos de "RELATORIO FINANCEIRO 2026.xlsx":
//   cols 0-1  CUSTOS (detalhe)
//   cols 4-5  RECEITAS (detalhe)
//   cols 8-9  RECAP (subtotais — deve ser descartado)
function monthSheet(
  custos: [string, number][],
  receitas: [string, number][],
): unknown[][] {
  const rows: unknown[][] = [
    ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", "", ""],
  ];
  const maxRows = Math.max(custos.length, receitas.length, 1);
  for (let i = 0; i < maxRows; i++) {
    rows.push([
      custos[i]?.[0] ?? "", custos[i]?.[1] ?? "",
      "", "",
      receitas[i]?.[0] ?? "", receitas[i]?.[1] ?? "",
      "", "", "", "", "",
    ]);
  }
  rows.push(["TOTAL", "", "", "", "TOTAL", "", "", "", "", "", ""]);
  return rows;
}

function buildWorkbookBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, aoaToSheet(rows), name);
  }
  // write Type="buffer" devolve ArrayBuffer/Uint8Array; converte para Buffer
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return Buffer.from(out as ArrayBuffer);
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

function dreEntries(month: string, n: number): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    date: lastDayOfMonth(month),
    description: `ITEM ${i}`,
    amountCents: 100000 + i * 1000,
    direction: "credit",
    directionSource: "explicit",
    confirmedCategory: "receita_bruta",
    correctionSource: "dre-import",
    classificationConfidence: 1.0,
  }));
}

describe("parseExcelDre (integração com xlsx real)", () => {
  beforeEach(() => parseDreTextMock.mockReset());

  it("processa múltiplos sheets de mês e pula RESUMO", async () => {
    const buf = buildWorkbookBuffer({
      GENNAIO: monthSheet([["ALEGRIA", 173545], ["BEM", 800]], [["PAYPAL", 464000], ["GOOGLE", 25624]]),
      FEBBRAIO: monthSheet([["ALEGRIA", 484935], ["BEM", 2500]], [["PAYPAL", 609907], ["GOOGLE", 20000]]),
      "RESUMO RELATORIO 2026": [
        ["", "LUCRO BRUTO", "LUCRO LIQUIDO", "FATTURATO"],
        ["GENNAIO", 465109.08, 323626.98, 812682.08],
      ],
    });

    parseDreTextMock
      .mockResolvedValueOnce({ entries: dreEntries("2026-01", 3), orphanCount: 0 })
      .mockResolvedValueOnce({ entries: dreEntries("2026-02", 3), orphanCount: 0 });

    const result = await parseExcelDre(buf, "2026-01", "t1");

    // RESUMO pulado; GENNAIO e FEBBRAIO processados (1 chamada por sheet)
    expect(parseDreTextMock).toHaveBeenCalledTimes(2);
    expect(parseDreTextMock).toHaveBeenNthCalledWith(1, expect.any(String), "2026-01", "t1");
    expect(parseDreTextMock).toHaveBeenNthCalledWith(2, expect.any(String), "2026-02", "t1");
    expect(result.entries.length).toBe(6); // 3 por mês
    expect(result.entries[0]!.date).toBe("2026-01-31");
    expect(result.entries[3]!.date).toBe("2026-02-28");
  });

  it("descarta subtotais do bloco recap G-H (não envia ao LLM)", async () => {
    const buf = buildWorkbookBuffer({
      MARZO: [
        ["CUSTOS", "", "", "", "RECEITAS", "", "", "", "RECEITAS", 685813.6, ""],
        ["ALEGRIA", 305022, "", "", "PAYPAL", 435791, "", "", "CUSTOS", 388496, ""],
        ["BEM", 3700, "", "", "GOOGLE", 25624, "", "", "LUCRO BRUTO", 297317.6, ""],
        ["TOTAL", 308722, "", "", "TOTAL", 461415, "", "", "", "", ""],
      ],
    });

    parseDreTextMock.mockResolvedValueOnce({ entries: dreEntries("2026-03", 4), orphanCount: 0 });

    await parseExcelDre(buf, "2026-03", "t1");

    expect(parseDreTextMock).toHaveBeenCalledTimes(1);
    const textoEnviado = parseDreTextMock.mock.calls[0]![0] as string;
    const linhas = textoEnviado.split("\n").filter(Boolean);

    // Só ALEGRIA/BEM (custos) e PAYPAL/GOOGLE (receitas) — subtotais/total não aparecem
    expect(linhas).toContain("CUSTOS - ALEGRIA,-R$ 305.022,00");
    expect(linhas).toContain("CUSTOS - BEM,-R$ 3.700,00");
    expect(linhas).toContain("RECEITAS - PAYPAL,R$ 435.791,00");
    expect(linhas).toContain("RECEITAS - GOOGLE,R$ 25.624,00");
    expect(linhas.find((l) => l.startsWith("TOTAL"))).toBeUndefined();
    expect(linhas.find((l) => l.startsWith("LUCRO BRUTO"))).toBeUndefined();
    expect(linhas.find((l) => /^CUSTOS,/.test(l))).toBeUndefined();
    expect(linhas.find((l) => /^RECEITAS,/.test(l))).toBeUndefined();
  });

  it("pula sheets de mês vazias (todos valores zerados)", async () => {
    const buf = buildWorkbookBuffer({
      GENNAIO: monthSheet([["ALEGRIA", 173545], ["BEM", 800]], [["PAYPAL", 464000], ["GOOGLE", 25624]]),
      GIUGNO: monthSheet([["ALEGRIA", 0], ["BEM", 0]], [["PAYPAL", 0], ["GOOGLE", 0]]),
    });

    parseDreTextMock.mockResolvedValueOnce({ entries: dreEntries("2026-01", 3), orphanCount: 0 });

    const result = await parseExcelDre(buf, "2026-01", "t1");

    // GIUGNO todo zerado → buildSheetText devolve "" → hasCurrencyValues false → pulado
    expect(parseDreTextMock).toHaveBeenCalledTimes(1);
    expect(result.entries.length).toBe(3);
  });

  it("detecta mês AGOSTO pelo nome do sheet (map de meses corrigido)", async () => {
    const buf = buildWorkbookBuffer({
      AGOSTO: monthSheet([["X", 1000], ["X2", 2000], ["X3", 3000]], [["Y", 2000], ["Y2", 3000]]),
    });

    parseDreTextMock.mockResolvedValueOnce({ entries: dreEntries("2026-08", 5), orphanCount: 0 });

    const result = await parseExcelDre(buf, "2026-08", "t1", { currentMonth: "2026-08" });

    expect(result.entries[0]!.date).toBe("2026-08-31");
    expect(parseDreTextMock).toHaveBeenCalledWith(expect.any(String), "2026-08", "t1");
  });
});

describe("parseExcelDre — extração de sheets em paralelo (PR-1)", () => {
  // Corpo em bloco de propósito: `() => mock.mockReset()` retornaria o mock, e o
  // vitest registraria esse retorno como cleanup hook, chamando o mock no teardown
  // com args vazios (month undefined) e quebrando a mockImplementation.
  beforeEach(() => { parseDreTextMock.mockReset(); });

  // 2 custos + 2 receitas por sheet (≥3 valores p/ passar em hasCurrencyValues).
  const threeMonths = () => buildWorkbookBuffer({
    GENNAIO: monthSheet([["ALEGRIA", 100], ["BEM", 110]], [["PAYPAL", 200], ["GOOGLE", 210]]),
    FEBBRAIO: monthSheet([["ALEGRIA", 300], ["BEM", 310]], [["PAYPAL", 400], ["GOOGLE", 410]]),
    MARZO: monthSheet([["ALEGRIA", 500], ["BEM", 510]], [["PAYPAL", 600], ["GOOGLE", 610]]),
  });

  it("uma sheet que falha não derruba as outras (extração isolada)", async () => {
    parseDreTextMock
      .mockResolvedValueOnce({ entries: dreEntries("2026-01", 2), orphanCount: 0 })
      .mockRejectedValueOnce(new Error("LLM timeout na sheet 2"))
      .mockResolvedValueOnce({ entries: dreEntries("2026-03", 3), orphanCount: 0 });

    const result = await parseExcelDre(threeMonths(), "2026-01", "t1", { currentMonth: "2026-12" });

    // 2 (jan) + 0 (fev falhou) + 3 (mar) — sem throw
    expect(result.entries.length).toBe(5);
    expect(result.entries[0]!.date).toBe("2026-01-31");
    expect(result.entries[2]!.date).toBe("2026-03-31");
  });

  it("preserva a ordem das sheets mesmo quando uma resolve antes da outra", async () => {
    // FEBBRAIO resolve rápido, GENNAIO devagar: o resultado ainda deve vir na ordem das sheets.
    parseDreTextMock.mockImplementation(async (_text: string, month: string) => {
      if (month === "2026-01") await new Promise((r) => setTimeout(r, 30));
      return { entries: dreEntries(month, 1), orphanCount: 0 };
    });

    const result = await parseExcelDre(threeMonths(), "2026-01", "t1", { currentMonth: "2026-12" });

    expect(result.entries.map((e) => e.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("respeita o limite de concorrência INGEST_DRE_SHEET_CONCURRENCY", async () => {
    const prev = process.env.INGEST_DRE_SHEET_CONCURRENCY;
    process.env.INGEST_DRE_SHEET_CONCURRENCY = "2";
    let active = 0;
    let maxActive = 0;
    parseDreTextMock.mockImplementation(async (_text: string, month: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return { entries: dreEntries(month, 1), orphanCount: 0 };
    });

    try {
      const result = await parseExcelDre(threeMonths(), "2026-01", "t1", { currentMonth: "2026-12" });
      expect(result.entries.length).toBe(3);
      expect(maxActive).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.INGEST_DRE_SHEET_CONCURRENCY;
      else process.env.INGEST_DRE_SHEET_CONCURRENCY = prev;
    }
  });
});
