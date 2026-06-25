import { describe, it, expect } from "vitest";
import { INJECTION_GUARD } from "@/llm/prompt-safety.js";
import { buildSystemPrompt as classificationSystemPrompt } from "@/classification/prompts.js";
import { buildNarrativeSystemPrompt } from "@/dre-narrative/prompts.js";
import { buildSystemPrompt as buildActionPlanSystemPrompt } from "@/monthly-analysis/agents/prompts/action-planning.js";

describe("prompt-safety — guarda contra prompt injection", () => {
  it("INJECTION_GUARD instrui tratar dados como conteúdo, nunca como comando", () => {
    const g = INJECTION_GUARD.toLowerCase();
    expect(g).toContain("dados");
    expect(g).toContain("obedeça");
    expect(g).toContain("ignore as regras acima");
  });

  it("system prompt de classificação inclui a guarda", () => {
    expect(classificationSystemPrompt()).toContain(INJECTION_GUARD);
  });

  it("system prompt de narrativa DRE inclui a guarda", () => {
    expect(buildNarrativeSystemPrompt()).toContain(INJECTION_GUARD);
  });

  it("system prompt de plano de ação inclui a guarda", () => {
    expect(buildActionPlanSystemPrompt()).toContain(INJECTION_GUARD);
  });
});
