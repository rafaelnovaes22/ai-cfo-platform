import { describe, it, expect } from "vitest";
import { parseText } from "@/ingest/parsers/text.js";

describe("ingest/parsers/text — clipboard TSV/CSV", () => {
  it("parseia TSV BR happy path", () => {
    const raw = [
      "Data\tHistórico\tValor\tD/C",
      "30/04/2026\tPix recebido\t1500,00\tC",
      "30/04/2026\tBoleto fornecedor\t300,00\tD",
    ].join("\n");
    const r = parseText(raw);
    expect(r.orphanCount).toBe(0);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({
      date: "2026-04-30",
      description: "Pix recebido",
      amountCents: 150_000,
      direction: "credit",
    });
    expect(r.entries[1]).toMatchObject({
      direction: "debit",
      amountCents: 30_000,
    });
  });

  it("parseia CSV BR com separador ';'", () => {
    const raw = [
      "Data;Histórico;Valor",
      "01/05/2026;Salário João;5000,00",
      "02/05/2026;Aluguel;1200,00",
    ].join("\n");
    const r = parseText(raw);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]?.amountCents).toBe(500_000);
  });

  it("paste sem ano usa o defaultYear (espelha o placeholder do textarea)", () => {
    const raw = [
      "Data\tDescrição\tValor",
      "01/09\tCliente Vértice MRR\t14200",
      "02/09\tMeta Ads\t-22840",
    ].join("\n");
    const r = parseText(raw, "2026");
    expect(r.orphanCount).toBe(0);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({ date: "2026-09-01", direction: "credit" });
    expect(r.entries[1]).toMatchObject({ date: "2026-09-02", direction: "debit" });
  });

  it("paste sem ano e sem defaultYear vira órfão (não inventa ano)", () => {
    const raw = "Data\tDescrição\tValor\n01/09\tX\t100,00\n02/09\tY\t200,00";
    const r = parseText(raw);
    expect(r.entries).toHaveLength(0);
    expect(r.orphanCount).toBe(2);
  });

  it("retorna vazio se < 2 linhas", () => {
    expect(parseText("").entries).toHaveLength(0);
    expect(parseText("apenas header").entries).toHaveLength(0);
  });

  it("conta órfãos quando data inválida", () => {
    const raw = [
      "Data\tHistórico\tValor",
      "31/02/2026\tFevereiro inexistente\t100,00", // 31/02 não existe
      "30/04/2026\tBoleto\t200,00",
    ].join("\n");
    const r = parseText(raw);
    expect(r.entries).toHaveLength(1);
    expect(r.orphanCount).toBe(1);
  });

  it("conta órfãos quando descrição vazia", () => {
    const raw = [
      "Data\tHistórico\tValor",
      "30/04/2026\t\t100,00",
      "01/05/2026\tValid\t200,00",
    ].join("\n");
    const r = parseText(raw);
    expect(r.entries).toHaveLength(1);
    expect(r.orphanCount).toBe(1);
  });

  it("conta órfãos quando valor inválido", () => {
    const raw = [
      "Data\tHistórico\tValor",
      "30/04/2026\tDesc\tabc",
      "01/05/2026\tValid\t200,00",
    ].join("\n");
    const r = parseText(raw);
    expect(r.entries).toHaveLength(1);
    expect(r.orphanCount).toBe(1);
  });

  it("aceita CRLF (Windows line endings)", () => {
    const raw = "Data\tHistórico\tValor\r\n30/04/2026\tPix\t100,00\r\n";
    const r = parseText(raw);
    expect(r.entries).toHaveLength(1);
  });

  it("infere direction pelo sinal quando coluna ausente", () => {
    const raw = [
      "Data\tHistórico\tValor",
      "30/04/2026\tPagamento (contábil)\t(500,00)", // parênteses = negativo
      "01/05/2026\tRecebimento\t1000,00",
    ].join("\n");
    const r = parseText(raw);
    expect(r.entries[0]?.direction).toBe("debit");
    expect(r.entries[1]?.direction).toBe("credit");
  });

  it("não usa tenantId do input (multi-tenancy via JWT — não testado aqui mas declarado)", () => {
    // Smoke — parser não recebe tenantId. C8 enforcement vive em ingest/service.ts.
    const r = parseText("Data\tHistórico\tValor\n30/04/2026\tX\t100,00\n");
    expect(r).not.toHaveProperty("tenantId");
  });
});
