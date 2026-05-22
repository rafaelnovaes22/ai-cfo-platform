import { describe, expect, it, vi } from "vitest";
import { parsePdf } from "@/ingest/parsers/pdf.js";
import { extractPdfText } from "@/ingest/parsers/pdf-text.js";

const getText = vi.fn(async () => ({
  text: "Data Historico Valor\n30/04/2026 Pix recebido 1500,00 C\n30/04/2026 Boleto fornecedor 300,00 D\n",
}));
const destroy = vi.fn(async () => {});

vi.mock("pdf-parse", () => ({
  PDFParse: vi.fn().mockImplementation(() => ({ getText, destroy })),
}));

describe("ingest/parsers/pdf — pdf-parse v2 integration", () => {
  it("extrai texto usando a API atual do pdf-parse", async () => {
    const text = await extractPdfText(Buffer.from("pdf"));

    expect(text).toContain("30/04/2026");
    expect(text).toContain("Pix recebido");
    expect(getText).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it("parseia PDF texto-selecionável com linhas datadas", async () => {
    const result = await parsePdf(Buffer.from("pdf"));

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      date: "2026-04-30",
      description: "Pix recebido",
      amountCents: 150_000,
      direction: "credit",
    });
    expect(result.entries[1]).toMatchObject({
      description: "Boleto fornecedor",
      amountCents: 30_000,
      direction: "debit",
    });
  });

  it("não trata cabeçalho de período de DRE como lançamento", async () => {
    getText.mockResolvedValueOnce({
      text: [
        "DEMONSTRACAO DO RESULTADO DO EXERCICIO",
        "Periodo de competencia: 01/03/2026 a 31/03/2026 - Valores em Reais",
        "1.1.01 Servicos recorrentes (MRR) 146.600,00 74,15%",
      ].join("\n"),
    });

    const result = await parsePdf(Buffer.from("pdf"));

    expect(result.entries).toHaveLength(0);
  });
});
