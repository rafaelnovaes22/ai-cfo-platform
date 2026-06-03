import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();

vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import {
  runNormalizationAgent,
  type RawLedgerEntry,
} from "@/monthly-analysis/agents/normalization.js";

const rawEntries: RawLedgerEntry[] = [
  {
    entryId: "e1",
    date: "2026-04-10",
    description: "NF 123 CLIENTE ABC LTDA",
    amountCents: 100000,
    direction: "in",
  },
  {
    entryId: "e2",
    date: "2026-04-11",
    description: "PIX FORNECEDOR XYZ",
    amountCents: 25000,
    direction: "out",
  },
];

function llmResponse(content: unknown) {
  return {
    content: typeof content === "string" ? content : JSON.stringify(content),
    provider: "openai",
    model: "gpt-4.1-nano",
    inputTokens: 10,
    outputTokens: 10,
    costCents: 1,
    traceId: null,
  };
}

beforeEach(() => {
  callLlmMock.mockReset();
});

describe("runNormalizationAgent", () => {
  it("returns normalized entries when LLM output passes schema validation", async () => {
    callLlmMock.mockResolvedValue(llmResponse([
      {
        entryId: "e1",
        date: "2026-04-10",
        description: "NF 123 CLIENTE ABC LTDA",
        normalizedDescription: "NF 123 - Cliente ABC Ltda",
        amountCents: 100000,
        direction: "in",
        probableCounterparty: "Cliente ABC Ltda",
        documentType: "nf",
        features: [],
        noiseFlags: [],
      },
      {
        entryId: "e2",
        date: "2026-04-11",
        description: "PIX FORNECEDOR XYZ",
        normalizedDescription: "PIX para Fornecedor XYZ",
        amountCents: 25000,
        direction: "out",
        probableCounterparty: "Fornecedor XYZ",
        documentType: "pix",
        features: [],
        noiseFlags: ["unknown_counterparty"],
      },
    ]));

    const result = await runNormalizationAgent(rawEntries, {
      tenantId: "tenant-1",
      traceId: "trace-1",
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.documentType).toBe("nf");
    expect(result[1]?.documentType).toBe("pix");
    expect(result[1]?.noiseFlags).toContain("unknown_counterparty");

    expect(callLlmMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "normalization",
      tenantId: "tenant-1",
      traceId: "trace-1",
      jsonMode: true,
    }));
    const request = callLlmMock.mock.calls[0]?.[0] as { systemPrompt: string; userPrompt: string };
    expect(request.systemPrompt).toContain("documentType");
    expect(request.userPrompt).toContain("NF 123 CLIENTE ABC LTDA");
  });

  it("throws when LLM output fails schema validation (invalid documentType)", async () => {
    callLlmMock.mockResolvedValue(llmResponse([
      {
        entryId: "e1",
        date: "2026-04-10",
        description: "NF 123 CLIENTE ABC LTDA",
        normalizedDescription: "NF 123 - Cliente ABC Ltda",
        amountCents: 100000,
        direction: "in",
        documentType: "cheque", // não está no enum
        features: [],
        noiseFlags: [],
      },
    ]));

    await expect(
      runNormalizationAgent([rawEntries[0]!], { tenantId: "tenant-1" }),
    ).rejects.toThrow();
  });

  it("re-estampa amountCents do original quando o LLM altera (não falha a análise)", async () => {
    callLlmMock.mockResolvedValue(llmResponse([
      {
        entryId: "e1",
        date: "2026-04-10",
        description: "NF 123 CLIENTE ABC LTDA",
        normalizedDescription: "NF 123 - Cliente ABC Ltda",
        amountCents: 999999, // alterado pelo LLM
        direction: "in",
        documentType: "nf",
        features: [],
        noiseFlags: [],
      },
    ]));

    const result = await runNormalizationAgent([rawEntries[0]!], { tenantId: "tenant-1" });

    // amountCents volta ao valor original (fonte da verdade), sem lançar erro.
    expect(result).toHaveLength(1);
    expect(result[0]?.amountCents).toBe(100000);
    expect(result[0]?.entryId).toBe("e1");
  });

  it("re-estampa date do original quando o LLM altera o ano (ex: 2026→2024)", async () => {
    callLlmMock.mockResolvedValue(llmResponse([
      {
        entryId: "e1",
        date: "2024-04-10", // LLM "corrigiu" o ano futuro
        description: "NF 123 CLIENTE ABC LTDA",
        normalizedDescription: "NF 123 - Cliente ABC Ltda",
        amountCents: 100000,
        direction: "in",
        documentType: "nf",
        features: [],
        noiseFlags: [],
      },
    ]));

    const result = await runNormalizationAgent([rawEntries[0]!], { tenantId: "tenant-1" });

    // date volta ao valor original, sem lançar erro.
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe("2026-04-10");
    expect(result[0]?.entryId).toBe("e1");
  });

  it("recovers when LLM hallucinates a new entryId but amountCents+date match by position", async () => {
    callLlmMock.mockResolvedValue(llmResponse([
      {
        entryId: "hallucinated-uuid-0000-0000-000000000001", // UUID alucinado
        date: "2026-04-10",
        description: "NF 123 CLIENTE ABC LTDA",
        normalizedDescription: "NF 123 - Cliente ABC Ltda",
        amountCents: 100000, // idêntico ao original
        direction: "in",
        documentType: "nf",
        features: [],
        noiseFlags: [],
      },
      {
        entryId: "e2", // este está correto
        date: "2026-04-11",
        description: "PIX FORNECEDOR XYZ",
        normalizedDescription: "PIX para Fornecedor XYZ",
        amountCents: 25000,
        direction: "out",
        documentType: "pix",
        features: [],
        noiseFlags: [],
      },
    ]));

    const result = await runNormalizationAgent(rawEntries, { tenantId: "tenant-1" });

    // entryId deve ter sido corrigido de volta para "e1"
    expect(result).toHaveLength(2);
    expect(result[0]?.entryId).toBe("e1");
    expect(result[1]?.entryId).toBe("e2");
  });

  it("returns [] without calling the LLM when input is empty", async () => {
    await expect(
      runNormalizationAgent([], { tenantId: "tenant-1" }),
    ).resolves.toEqual([]);

    expect(callLlmMock).not.toHaveBeenCalled();
  });
});
