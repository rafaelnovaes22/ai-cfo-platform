import { describe, it, expect } from "vitest";
import { resolveRoute } from "@/llm/router.js";
import type { LlmTask } from "@/llm/types.js";

// Tarefas determinísticas: o mesmo extrato DEVE gerar a mesma saída (saldo estável
// entre reingestões). Bug 2026-06-15: sem temperature, o Gemini oscilava a
// classificação de itens ambíguos e o saldo do caixa mudava a cada reimport.
const DETERMINISTIC: LlmTask[] = [
  "normalization",
  "business-profile",
  "clarity-judge",
  "dre-classification",
  "anomaly-detection",
  "margin-diagnosis",
  "cashflow-risk",
  "financial-qa-review",
  "dre-extraction",
  "eval-judge",
];

describe("llm/router — temperatura determinística", () => {
  it("tarefas determinísticas usam temperature=0 (primário e fallback)", () => {
    for (const task of DETERMINISTIC) {
      expect(resolveRoute(task).temperature, `${task} primário`).toBe(0);
      expect(resolveRoute(task, true).temperature, `${task} fallback`).toBe(0);
    }
  });

  it("geração de texto usa temperatura baixa (não default alto) sem ser 0", () => {
    for (const task of ["narrative-synthesis", "action-planning"] as LlmTask[]) {
      const temp = resolveRoute(task).temperature;
      expect(temp, task).toBeGreaterThan(0);
      expect(temp, task).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("llm/router — thinkingBudget configurável por env", () => {
  const KEY = "ACTION_PLANNING_THINKING_BUDGET";
  const withEnv = <T>(value: string | undefined, fn: () => T): T => {
    const prev = process.env[KEY];
    if (value === undefined) delete process.env[KEY]; else process.env[KEY] = value;
    try { return fn(); } finally {
      if (prev === undefined) delete process.env[KEY]; else process.env[KEY] = prev;
    }
  };

  it("default (sem env) mantém o thinkingBudget da rota", () => {
    withEnv(undefined, () => {
      expect(resolveRoute("action-planning").thinkingBudget).toBe(2048);
      expect(resolveRoute("action-plan").thinkingBudget).toBe(2048);
    });
  });

  it("env override aplica o budget reduzido (latência tunável sem deploy)", () => {
    withEnv("512", () => {
      expect(resolveRoute("action-planning").thinkingBudget).toBe(512);
      expect(resolveRoute("action-plan").thinkingBudget).toBe(512);
    });
  });

  it("env=0 desativa o thinking", () => {
    withEnv("0", () => expect(resolveRoute("action-planning").thinkingBudget).toBe(0));
  });

  it("env inválido cai no default da rota", () => {
    withEnv("abc", () => expect(resolveRoute("action-planning").thinkingBudget).toBe(2048));
  });

  it("tarefas sem thinkingBudget não são afetadas", () => {
    withEnv("512", () => {
      expect(resolveRoute("narrative-synthesis").thinkingBudget).toBeUndefined();
      expect(resolveRoute("dre-classification").thinkingBudget).toBeUndefined();
    });
  });

  it("fallback OpenAI nunca recebe thinkingBudget", () => {
    withEnv("512", () => expect(resolveRoute("action-planning", true).thinkingBudget).toBeUndefined());
  });
});
