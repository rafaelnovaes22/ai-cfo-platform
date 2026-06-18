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

  it("parseDreText extrai DRE colado como texto (sem PDF), reusando o extrator LLM", async () => {
    const { parseDreText } = await import("@/ingest/parsers/pdf-dre.js");

    const dreColado = [
      "DEMONSTRACAO DO RESULTADO DO EXERCICIO",
      "Periodo de competencia: 01/03/2026 a 31/03/2026",
      "Servicos recorrentes (MRR) 146.600,00",
      "Midia paga (38.700,00)",
    ].join("\n");

    const result = await parseDreText(dreColado, "2026-05", "tenant-test");

    expect(result.entries).toHaveLength(2);
    expect(result.referenceMonth).toBe("2026-03");
    expect(result.entries[0]).toMatchObject({
      description: "Servicos recorrentes MRR",
      direction: "credit",
      confirmedCategory: "receita_bruta",
      correctionSource: "dre-import",
    });
  });

  it("retorna 0 quando o LLM classifica o texto como não-extraível (relatório de indicadores → [])", async () => {
    // Caso da CEO: colou a saída de uma análise (percentuais + crescimento mês a
    // mês), não um DRE com valores absolutos. O prompt instrui o LLM a devolver []
    // nesse caso, e o ingest então cai no guard de 0 lançamentos (orienta, não
    // importa parcial). Aqui validamos o contrato: [] do LLM → 0 entries.
    const { callLlm } = await import("@/llm/index.js");
    vi.mocked(callLlm).mockResolvedValueOnce({
      content: "[]",
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 1,
      outputTokens: 1,
      costCents: 1,
      traceId: null,
    });
    const { parseDreText } = await import("@/ingest/parsers/pdf-dre.js");

    const resumoDeAnalise = [
      "Lucro Bruto / Receita 43,1% 43,4%",
      "CRESCIMENTO MÊS A MÊS",
      "Receita Bruta 641.726,01 +78,1% +42,1%",
    ].join("\n");

    const result = await parseDreText(resumoDeAnalise, "2026-06", "tenant-test");
    expect(result.entries).toHaveLength(0);
  });

  it("detecta competência por padrões comuns de DRE", async () => {
    const { detectDreReferenceMonth } = await import("@/ingest/parsers/pdf-dre.js");

    expect(detectDreReferenceMonth("DRE 03/2026 — Acme Marketing")).toBe("2026-03");
    expect(detectDreReferenceMonth("Período de competência: 01/03/2026 a 31/03/2026")).toBe("2026-03");
    expect(detectDreReferenceMonth("Relatório de março de 2026")).toBe("2026-03");
  });
});
