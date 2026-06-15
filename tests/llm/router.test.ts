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
