import { describe, it, expect, vi, beforeEach } from "vitest";

const callLlmMock = vi.fn();
vi.mock("@/llm/index.js", () => ({
  callLlm: (...args: unknown[]) => callLlmMock(...args),
}));

import { inferBusinessProfile, _internals } from "@/classification/business-profile.js";

beforeEach(() => {
  callLlmMock.mockReset();
});

const desc = (description: string) => ({ description });

describe("classification/business-profile — sampleDescriptions", () => {
  it("deduplica descrições (case-insensitive) e preserva ordem", () => {
    const out = _internals.sampleDescriptions([
      desc("Energia Light"),
      desc("ENERGIA LIGHT"),
      desc("Aluguel estúdio"),
      desc("  "),
    ]);
    expect(out).toEqual(["Energia Light", "Aluguel estúdio"]);
  });

  it("trunca descrições muito longas", () => {
    const longa = "x".repeat(500);
    const out = _internals.sampleDescriptions([desc(longa), desc("b"), desc("c")]);
    expect(out[0]!.length).toBeLessThanOrEqual(120);
  });

  it("limita o tamanho da amostra", () => {
    const many = Array.from({ length: 200 }, (_, i) => desc(`Lançamento ${i}`));
    expect(_internals.sampleDescriptions(many).length).toBeLessThanOrEqual(50);
  });
});

describe("classification/business-profile — inferBusinessProfile", () => {
  it("retorna o perfil quando o LLM responde", async () => {
    callLlmMock.mockResolvedValue({
      content: "Produtora de conteúdo jornalístico. Receita-fim: cobertura, assessoria de imprensa, locução.",
    });
    const profile = await inferBusinessProfile(
      [desc("Cobertura jornalística"), desc("Pró-labore Cid"), desc("Energia Light")],
      { tenantId: "t1" },
    );
    expect(profile).toContain("Produtora de conteúdo");
    expect(callLlmMock).toHaveBeenCalledTimes(1);
    expect(callLlmMock.mock.calls[0]![0]).toMatchObject({ task: "business-profile" });
  });

  it("retorna undefined sem chamar LLM quando a amostra é pequena demais", async () => {
    const profile = await inferBusinessProfile([desc("a"), desc("b")], { tenantId: "t1" });
    expect(profile).toBeUndefined();
    expect(callLlmMock).not.toHaveBeenCalled();
  });

  it("degrada graciosamente: erro do LLM → undefined, não propaga", async () => {
    callLlmMock.mockRejectedValue(new Error("vertex timeout"));
    const profile = await inferBusinessProfile(
      [desc("Cobertura"), desc("Aluguel"), desc("Energia")],
      { tenantId: "t1" },
    );
    expect(profile).toBeUndefined();
  });
});
