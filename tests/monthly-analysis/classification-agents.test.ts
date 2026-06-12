import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import {
  ClarityResultsSchema,
  DreClassificationResultsSchema,
  applyClarityCaps,
  capConfidenceByClarity,
  coerceDreCategory,
  parseAgentJson,
  runClarityJudgeAgent,
  runDreClassificationAgent,
} from "@/monthly-analysis/agents/index.js";

beforeEach(() => {
  callLlmMock.mockReset();
});

describe("monthly-analysis classification agent schemas", () => {
  it("accepts clarity results and rejects invalid clarity labels", () => {
    expect(() => ClarityResultsSchema.parse([
      { entryId: "e1", clarity: "clear", reason: "NF numerada" },
      { entryId: "e2", clarity: "ambiguous", reason: "sem contraparte" },
    ])).not.toThrow();

    expect(() => ClarityResultsSchema.parse([
      { entryId: "e1", clarity: "unclear", reason: "x" },
    ])).toThrow();
  });

  it("accepts DRE classification output and enforces confidence range", () => {
    expect(() => DreClassificationResultsSchema.parse([
      { entryId: "e1", category: "receita_bruta", confidence: 0.92 },
    ])).not.toThrow();

    expect(() => DreClassificationResultsSchema.parse([
      { entryId: "e1", category: "receita_bruta", confidence: 1.2 },
    ])).toThrow();
  });
});

describe("monthly-analysis classification agent helpers", () => {
  it("parses JSON through the provided schema", () => {
    const parsed = parseAgentJson(
      JSON.stringify([{ entryId: "e1", clarity: "partial", reason: "fornecedor sem NF" }]),
      ClarityResultsSchema,
    );

    expect(parsed).toEqual([{ entryId: "e1", clarity: "partial", reason: "fornecedor sem NF" }]);
    expect(() => parseAgentJson("not-json", ClarityResultsSchema)).toThrow();
  });

  it("coerces unknown DRE categories to nao_classificado", () => {
    expect(coerceDreCategory("receita_bruta")).toBe("receita_bruta");
    expect(coerceDreCategory("categoria_alucinada")).toBe("nao_classificado");
  });

  it("caps confidence according to clarity verdicts", () => {
    expect(capConfidenceByClarity(0.98, "clear")).toBe(0.98);
    expect(capConfidenceByClarity(0.98, "partial")).toBe(0.75);
    expect(capConfidenceByClarity(0.98, "ambiguous")).toBe(0.6);

    expect(applyClarityCaps(
      [
        { entryId: "e1", category: "receita_bruta", confidence: 0.99 },
        { entryId: "e2", category: "categoria_alucinada", confidence: 0.9 },
        { entryId: "e3", category: "despesas_pessoal", confidence: 0.8 },
      ],
      [
        { entryId: "e1", clarity: "partial", reason: "sem documento" },
        { entryId: "e2", clarity: "ambiguous", reason: "sem contexto" },
      ],
    )).toEqual([
      { entryId: "e1", category: "receita_bruta", confidence: 0.75 },
      { entryId: "e2", category: "nao_classificado", confidence: 0.6 },
      { entryId: "e3", category: "despesas_pessoal", confidence: 0.8 },
    ]);
  });
});

describe("monthly-analysis classification agents", () => {
  it("runs clarity judge with the agentic task while reusing the legacy judge prompt", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", clarity: "clear", reason: "NF numerada" }]),
      provider: "openai",
      model: "gpt-4.1-nano",
      inputTokens: 10,
      outputTokens: 10,
      costCents: 1,
      traceId: null,
    });

    const result = await runClarityJudgeAgent(
      [{ entryId: "e1", description: "NF 1234 ACME LTDA" }],
      { tenantId: "tenant-1", traceId: "trace-1" },
    );

    expect(result).toEqual([{ entryId: "e1", clarity: "clear", reason: "NF numerada" }]);
    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "clarity-judge",
      tenantId: "tenant-1",
      traceId: "trace-1",
      jsonMode: true,
    }));
    const request = callLlmMock.mock.calls[0]?.[0] as { systemPrompt: string; userPrompt: string };
    expect(request.systemPrompt).toContain("auditor de clareza");
    expect(request.userPrompt).toContain("NF 1234 ACME LTDA");
  });

  it("runs DRE classifier with the agentic task and sanitizes unknown categories", async () => {
    // O LLM responde com os aliases curtos (e0, e1, …) que o agente envia, não
    // com o UUID real — o aliasing é o que evita a alucinação de id.
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([
        { entryId: "ref-0", category: "receita_bruta", confidence: 0.95 },
        { entryId: "ref-1", category: "alucinada", confidence: 0.91 },
      ]),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 10,
      outputTokens: 10,
      costCents: 1,
      traceId: null,
    });

    const result = await runDreClassificationAgent(
      [
        {
          entryId: "23f0ba89-940a-4dd4-af89-464278967942",
          date: "2026-04-10",
          description: "NF 123 CLIENTE ABC LTDA",
          amountCents: 1000,
          direction: "credit",
        },
        {
          entryId: "7a4b22f6-d2ac-40dd-a955-87d1c7c33be0",
          date: "2026-04-11",
          description: "LANÇAMENTO ESTRANHO",
          amountCents: 500,
          direction: "debit",
        },
      ],
      { tenantId: "tenant-1" },
    );

    // Remapeado de volta aos UUIDs reais a partir dos aliases.
    expect(result).toEqual([
      { entryId: "23f0ba89-940a-4dd4-af89-464278967942", category: "receita_bruta", confidence: 0.95 },
      { entryId: "7a4b22f6-d2ac-40dd-a955-87d1c7c33be0", category: "nao_classificado", confidence: 0.91 },
    ]);
    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "dre-classification",
      tenantId: "tenant-1",
      jsonMode: true,
    }));
    const request = callLlmMock.mock.calls[0]?.[0] as { systemPrompt: string; userPrompt: string };
    expect(request.systemPrompt).toContain("CATEGORIAS DRE PERMITIDAS");
    expect(request.userPrompt).toContain("NF 123 CLIENTE ABC LTDA");
    // O UUID nunca chega ao LLM — só o alias curto, imune à troca de dígitos.
    expect(request.userPrompt).not.toContain("23f0ba89-940a-4dd4-af89-464278967942");
    expect(request.userPrompt).toContain("ref-0");
  });

  it("recupera o entryId real mesmo quando o LLM corrompe o alias (anti-alucinação)", async () => {
    const realIds = [
      "23f0ba89-940a-4dd4-af89-464278967942",
      "7a4b22f6-d2ac-40dd-a955-87d1c7c33be0",
      "0c14d058-efc3-41bb-ad85-42410886e284",
    ];
    // ref-0 ecoado certo; ref-1 com ruído ("ref- 1"); 3º totalmente alucinado (UUID inventado).
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([
        { entryId: "ref-0", category: "receita_bruta", confidence: 0.9 },
        { entryId: "ref- 1", category: "despesas_pessoal", confidence: 0.8 },
        { entryId: "23f0ba89-940a-4dd4-a46d-9726730dc222", category: "despesas_juridicas", confidence: 0.7 },
      ]),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 10,
      outputTokens: 10,
      costCents: 1,
      traceId: null,
    });

    const result = await runDreClassificationAgent(
      realIds.map((id, i) => ({
        entryId: id,
        date: "2026-04-10",
        description: `LANC ${i}`,
        amountCents: 1000,
        direction: "debit",
      })),
      { tenantId: "tenant-1" },
    );

    // Todos remapeados ao id real: ref-0 exato, "ref- 1" pelo número, e o 3º pela posição.
    expect(result.map((r) => r.entryId)).toEqual(realIds);
  });

  it("inclui segmento no userPrompt quando passado nas options", async () => {
    callLlmMock.mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.95 }]),
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 10,
      outputTokens: 10,
      costCents: 1,
      traceId: null,
    });

    await runDreClassificationAgent(
      [{ entryId: "e1", date: "2026-05-01", description: "MENSALIDADE CLIENTE ABC", amountCents: 50000, direction: "credit" }],
      { tenantId: "tenant-1", segment: "saas" },
    );

    const request = callLlmMock.mock.calls[0]?.[0] as { userPrompt: string };
    expect(request.userPrompt).toContain("saas");
    expect(request.userPrompt).toContain("Segmento da empresa");
  });

  it("does not call the LLM for empty batches", async () => {
    await expect(runClarityJudgeAgent([], { tenantId: "tenant-1" })).resolves.toEqual([]);
    await expect(runDreClassificationAgent([], { tenantId: "tenant-1" })).resolves.toEqual([]);
    expect(callLlmMock).not.toHaveBeenCalled();
  });
});
