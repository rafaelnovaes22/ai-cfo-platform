import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "@/ingest/parsers/excel.js";

// Helpers — geram buffers xlsx programaticamente para fixtures inline.
function workbookFromAoA(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("ingest/parsers/excel — happy path", () => {
  it("parseia planilha BR com header padrão", () => {
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor", "D/C"],
      ["30/04/2026", "Pix recebido", "1500,00", "C"],
      ["01/05/2026", "Boleto fornecedor", "300,00", "D"],
    ]);
    const r = parseExcel(buf);
    expect(r.orphanCount).toBe(0);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({
      date: "2026-04-30",
      description: "Pix recebido",
      amountCents: 150_000,
      direction: "credit",
    });
  });

  it("aceita valor numérico direto (Excel guarda como number)", () => {
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor"],
      ["30/04/2026", "Salário", 5000.50],
    ]);
    const r = parseExcel(buf);
    expect(r.entries[0]?.amountCents).toBe(500_050);
  });

  it("infere direction pelo sinal contábil (parênteses) quando coluna ausente", () => {
    // Entrada string com formato contábil (parênteses) preserva sinal.
    // Entrada numérica do Excel perde o sinal no normalize (Math.abs); só strings contábeis sinalizam débito.
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor"],
      ["30/04/2026", "Recebimento", "1000,00"],
      ["01/05/2026", "Pagamento", "(500,00)"],
    ]);
    const r = parseExcel(buf);
    expect(r.entries[0]?.direction).toBe("credit");
    expect(r.entries[1]?.direction).toBe("debit");
  });

  it("cai em parsing posicional quando header não bate", () => {
    const buf = workbookFromAoA([
      ["X", "Y", "Z"], // header inválido
      ["30/04/2026", "Pix", "100,00"],
    ]);
    const r = parseExcel(buf);
    expect(r.entries).toHaveLength(1);
  });

  it("conta órfãos quando linha tem dado mas formato inválido", () => {
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor"],
      ["31/02/2026", "Fev inexistente", "100,00"], // 31/02 inválido
      ["30/04/2026", "Valid", "200,00"],
    ]);
    const r = parseExcel(buf);
    expect(r.entries).toHaveLength(1);
    expect(r.orphanCount).toBe(1);
  });

  it("ignora linhas em branco (sem data e sem descrição)", () => {
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor"],
      ["30/04/2026", "Pix", "100,00"],
      ["", "", ""],
      ["", "", ""],
      ["01/05/2026", "Boleto", "200,00"],
    ]);
    const r = parseExcel(buf);
    expect(r.entries).toHaveLength(2);
    expect(r.orphanCount).toBe(0);
  });
});

describe("ingest/parsers/excel — mitigação CVE (ADR-003)", () => {
  it("rejeita buffer > 20MB", () => {
    // Buffer de 21MB de bytes zero — não passa pela barreira mesmo sem ser xlsx válido.
    const big = Buffer.alloc(21 * 1024 * 1024);
    expect(() => parseExcel(big)).toThrow(/xlsx-file-too-large/);
  });

  it("trata buffer vazio sem explodir", () => {
    const r = parseExcel(Buffer.alloc(0));
    expect(r).toEqual({ entries: [], orphanCount: 0 });
  });

  it("acesso defensivo: workbook com sheet com apenas header não explode", () => {
    // XLSX rejeita workbooks vazios na escrita; testamos o caso degenerado mais próximo:
    // sheet sem dados além do header. O parser deve devolver vazio sem throw.
    const buf = workbookFromAoA([["Data", "Histórico", "Valor"]]);
    const r = parseExcel(buf);
    expect(r.entries).toHaveLength(0);
    expect(r.orphanCount).toBe(0);
  });

  it("aceita planilha com apenas header (rows < 2 → vazio)", () => {
    const buf = workbookFromAoA([["Data", "Histórico", "Valor"]]);
    const r = parseExcel(buf);
    expect(r.entries).toHaveLength(0);
  });
});

describe("ingest/parsers/excel — multi-tenancy boundary", () => {
  it("não recebe nem retorna tenantId — isolamento via service.ts (C8)", () => {
    const buf = workbookFromAoA([
      ["Data", "Histórico", "Valor"],
      ["30/04/2026", "Pix", "100,00"],
    ]);
    const r = parseExcel(buf);
    expect(r).not.toHaveProperty("tenantId");
    expect(r.entries[0]).not.toHaveProperty("tenantId");
  });
});
