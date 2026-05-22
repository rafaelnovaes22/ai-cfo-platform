import type { LlmTask, RouteConfig } from "@/llm/types.js";

// Roteamento por tarefa — único lugar que define qual provider/modelo usar.
// Para trocar modelo de uma tarefa: editar aqui, sem tocar nos nós LangGraph/agentes.
//
// As 4 tarefas legadas continuam ativas para preservar o pipeline BullMQ atual.
// As tarefas granulares abaixo são a base do novo monthly-analysis multiagente.
// `eval-judge` é tooling do runner `llm_as_judge` (não vai pra produção).
const TASK_ROUTES: Record<LlmTask, RouteConfig> = {
  // Pipeline legado — compatibilidade.
  "classification":       { provider: "openai", model: "gpt-4.1-mini" },
  "classification-judge": { provider: "openai", model: "gpt-4.1-nano" },
  "dre-narrative":        { provider: "google", model: "gemini-2.5-flash" },
  "action-plan":          { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "eval-judge":           { provider: "openai", model: "gpt-4.1-mini" },
  "dre-extraction":       { provider: "openai", model: "gpt-4.1-mini" },

  // Pipeline agentic/LangGraph — SLM first.
  "normalization":        { provider: "openai", model: "gpt-4.1-nano" },
  "clarity-judge":        { provider: "openai", model: "gpt-4.1-nano" },
  "dre-classification":   { provider: "openai", model: "gpt-4.1-mini" },
  "anomaly-detection":    { provider: "google", model: "gemini-2.5-flash-lite" },
  "margin-diagnosis":     { provider: "google", model: "gemini-2.5-flash-lite" },
  "cashflow-risk":        { provider: "openai", model: "gpt-4.1-mini" },
  "narrative-synthesis":  { provider: "google", model: "gemini-2.5-flash" },
  "action-planning":      { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "financial-qa-review":  { provider: "openai", model: "gpt-4.1-mini" },
};

// Fallback quando provider primário falha. Modelos maiores aparecem só em fallback/retry.
const FALLBACK_ROUTES: Partial<Record<LlmTask, RouteConfig>> = {
  // Pipeline legado.
  "classification":       { provider: "anthropic", model: "claude-haiku-4-5" },
  "classification-judge": { provider: "openai", model: "gpt-4o-mini" },
  "dre-narrative":        { provider: "anthropic", model: "claude-sonnet-4-6" },
  "action-plan":          { provider: "anthropic", model: "claude-sonnet-4-6" },
  "eval-judge":           { provider: "anthropic", model: "claude-sonnet-4-6" },
  "dre-extraction":       { provider: "anthropic", model: "claude-haiku-4-5" },

  // Pipeline agentic/LangGraph.
  "normalization":        { provider: "openai", model: "gpt-4.1-mini" },
  "clarity-judge":        { provider: "openai", model: "gpt-4.1-mini" },
  "dre-classification":   { provider: "anthropic", model: "claude-haiku-4-5" },
  "anomaly-detection":    { provider: "openai", model: "gpt-4.1-mini" },
  "margin-diagnosis":     { provider: "openai", model: "gpt-4.1-mini" },
  "cashflow-risk":        { provider: "anthropic", model: "claude-haiku-4-5" },
  "narrative-synthesis":  { provider: "anthropic", model: "claude-sonnet-4-6" },
  "action-planning":      { provider: "anthropic", model: "claude-sonnet-4-6" },
  "financial-qa-review":  { provider: "anthropic", model: "claude-haiku-4-5" },
};

export function resolveRoute(task: LlmTask, useFallback = false): RouteConfig {
  if (useFallback) return FALLBACK_ROUTES[task] ?? TASK_ROUTES[task];
  return TASK_ROUTES[task];
}
