import { describe, expect, it, vi } from "vitest";

vi.mock("@/ingest/parsers/pdf-text.js", () => ({
  extractPdfText: vi.fn(async () =>
    [
      "DEMONSTRACAO DO RESULTADO DO EXERCICIO",
      "Periodo de competencia: 01/03/2026 a 31/03/2026",
      "1.1.01 Servicos recorrentes (MRR) 146.600,00 74,15%",
      "4.1.01 Midia paga (trafego) (38.700,00) -19,58%",
    ].join("\n"),
  ),
}));

vi.mock("@/llm/index.js", () => ({
  callLlm: vi.fn(async () => ({
    content: JSON.stringify([
      {
        category: "receita_bruta",
        description: "Servicos recorrentes MRR",
        value: 146600,
        direction: "credit",
      },
      {
        category: "despesas_comerciais",
        description: "Midia paga trafego",
        value: 38700,
        direction: "debit",
      },
    ]),
    provider: "openai",
    model: "gpt-4.1-mini",
    inputTokens: 1,
    outputTokens: 1,
    costCents: 1,
    traceId: null,
  })),
}));

describe("ingest/parsers/pdf-dre — DRE consolidado", () => {
  it("converte DRE texto-selecionável em lançamentos sintéticos categorizados", async () => {
    const { parsePdfDre } = await import("@/ingest/parsers/pdf-dre.js");

    const result = await parsePdfDre(Buffer.from("pdf"), "2026-05", "tenant-test");

    expect(result.entries).toHaveLength(2);
    expect(result.referenceMonth).toBe("2026-03");
    expect(result.entries[0]).toMatchObject({
      date: "2026-03-31",
      description: "Servicos recorrentes MRR",
      amountCents: 14_660_000,
      direction: "credit",
      confirmedCategory: "receita_bruta",
      correctionSource: "dre-import",
    });
    expect(result.entries[1]).toMatchObject({
      date: "2026-03-31",
      description: "Midia paga trafego",
      amountCents: 3_870_000,
      direction: "debit",
      confirmedCategory: "despesas_comerciais",
    });
  });

  it("detecta competência por padrões comuns de DRE", async () => {
    const { detectDreReferenceMonth } = await import("@/ingest/parsers/pdf-dre.js");

    expect(detectDreReferenceMonth("DRE 03/2026 — Acme Marketing")).toBe("2026-03");
    expect(detectDreReferenceMonth("Período de competência: 01/03/2026 a 31/03/2026")).toBe("2026-03");
    expect(detectDreReferenceMonth("Relatório de março de 2026")).toBe("2026-03");
  });
});
