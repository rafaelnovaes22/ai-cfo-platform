import { describe, it, expect, beforeEach } from "vitest";
import {
  selectVariantByBandit,
  getOrInitVariant,
  recordVariantOutcome,
  selectBestVariant,
  getVariantStats,
  _resetStore,
  type VariantStats,
} from "@/learning/prompt-memory.js";

beforeEach(() => {
  _resetStore();
});

describe("selectVariantByBandit", () => {
  it("retorna a única variante quando só há uma", () => {
    const variants: VariantStats[] = [{ id: "v1", alpha: 5, beta: 1 }];
    expect(selectVariantByBandit(variants).id).toBe("v1");
  });

  it("lança erro quando não há variantes", () => {
    expect(() => selectVariantByBandit([])).toThrow();
  });

  it("prefere estatisticamente a variante com maior taxa de positivos", () => {
    // Roda 200 seleções — variante com alpha=90,beta=10 deve vencer com alta frequência
    const goodVariant: VariantStats = { id: "good", alpha: 90, beta: 10 };
    const badVariant: VariantStats = { id: "bad", alpha: 10, beta: 90 };

    let goodWins = 0;
    for (let i = 0; i < 200; i++) {
      if (selectVariantByBandit([goodVariant, badVariant]).id === "good") goodWins++;
    }

    // Espera vencer em >80% das vezes dado o sinal forte
    expect(goodWins).toBeGreaterThan(160);
  });

  it("explora ambas as variantes quando o prior é uniforme (exploration)", () => {
    const v1: VariantStats = { id: "v1", alpha: 1, beta: 1 };
    const v2: VariantStats = { id: "v2", alpha: 1, beta: 1 };

    let v1Wins = 0;
    for (let i = 0; i < 200; i++) {
      if (selectVariantByBandit([v1, v2]).id === "v1") v1Wins++;
    }

    // Com prior uniforme, deve selecionar cada variante em torno de 50%
    expect(v1Wins).toBeGreaterThan(60);
    expect(v1Wins).toBeLessThan(140);
  });
});

describe("getOrInitVariant", () => {
  it("inicializa com prior uniforme Beta(1,1)", () => {
    const stats = getOrInitVariant("classification", "v-default");
    expect(stats).toEqual({ id: "v-default", alpha: 1, beta: 1 });
  });

  it("retorna o mesmo objeto em chamadas subsequentes", () => {
    const a = getOrInitVariant("classification", "v1");
    const b = getOrInitVariant("classification", "v1");
    expect(a).toBe(b);
  });

  it("isola variantes por agentName", () => {
    const a = getOrInitVariant("classification", "v1");
    const b = getOrInitVariant("narrative-synthesis", "v1");
    // Mesmo id mas agentes diferentes — objetos distintos
    a.alpha = 10;
    expect(b.alpha).toBe(1);
  });
});

describe("recordVariantOutcome", () => {
  it("incrementa alpha em outcome positivo", () => {
    recordVariantOutcome("classification", "v1", true);
    const stats = getVariantStats("classification", "v1");
    expect(stats.alpha).toBe(2); // 1 (prior) + 1
    expect(stats.beta).toBe(1);
  });

  it("incrementa beta em outcome negativo", () => {
    recordVariantOutcome("classification", "v1", false);
    const stats = getVariantStats("classification", "v1");
    expect(stats.alpha).toBe(1);
    expect(stats.beta).toBe(2); // 1 (prior) + 1
  });

  it("acumula múltiplos outcomes", () => {
    recordVariantOutcome("classification", "v1", true);
    recordVariantOutcome("classification", "v1", true);
    recordVariantOutcome("classification", "v1", false);
    const stats = getVariantStats("classification", "v1");
    expect(stats.alpha).toBe(3);
    expect(stats.beta).toBe(2);
  });
});

describe("selectBestVariant", () => {
  it("retorna o id da variante com melhor histórico quando sinal é forte", () => {
    // Simula aprendizado: v-good recebeu muitos positivos
    for (let i = 0; i < 50; i++) recordVariantOutcome("classification", "v-good", true);
    for (let i = 0; i < 5; i++) recordVariantOutcome("classification", "v-good", false);
    for (let i = 0; i < 5; i++) recordVariantOutcome("classification", "v-bad", true);
    for (let i = 0; i < 50; i++) recordVariantOutcome("classification", "v-bad", false);

    // Com sinal forte, deve selecionar v-good consistentemente
    let goodWins = 0;
    for (let i = 0; i < 50; i++) {
      if (selectBestVariant("classification", ["v-good", "v-bad"]) === "v-good") goodWins++;
    }
    expect(goodWins).toBeGreaterThan(40);
  });

  it("lança erro quando variantIds está vazio", () => {
    expect(() => selectBestVariant("classification", [])).toThrow();
  });
});
