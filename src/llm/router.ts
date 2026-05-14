import type { LlmTask, RouteConfig } from "@/llm/types.js";

// Roteamento por tarefa — único lugar que define qual provider/modelo usar.
// Para trocar modelo de uma tarefa: editar aqui, sem tocar nos nós do LangGraph.
const TASK_ROUTES: Record<LlmTask, RouteConfig> = {
  "classification":       { provider: "openai",    model: "gpt-4.1-mini" },
  "classification-judge": { provider: "openai",    model: "gpt-4.1-nano" },
  "dre-narrative":        { provider: "google",    model: "gemini-2.5-flash" },
  "action-plan":          { provider: "google",    model: "gemini-2.5-flash", thinkingBudget: 2048 },
};

// Fallback quando provider primário falha
const FALLBACK_ROUTES: Partial<Record<LlmTask, RouteConfig>> = {
  "classification":       { provider: "anthropic", model: "claude-haiku-4-5" },
  "classification-judge": { provider: "openai",    model: "gpt-4o-mini" },
  "dre-narrative":        { provider: "anthropic", model: "claude-sonnet-4-6" },
  "action-plan":          { provider: "anthropic", model: "claude-sonnet-4-6" },
};

export function resolveRoute(task: LlmTask, useFallback = false): RouteConfig {
  if (useFallback) return FALLBACK_ROUTES[task] ?? TASK_ROUTES[task];
  return TASK_ROUTES[task];
}
