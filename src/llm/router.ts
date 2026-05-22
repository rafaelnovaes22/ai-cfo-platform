import type { LlmTask, RouteConfig } from "@/llm/types.js";

// Roteamento por tarefa — único lugar que define qual provider/modelo usar.
// Para trocar modelo de uma tarefa: editar aqui, sem tocar nos nós LangGraph/agentes.
//
// Todos os providers são Google (Vertex AI southamerica-east1) para conformidade LGPD:
// dados não saem do Brasil e não são usados para treino de modelos externos.
// `eval-judge` usa Anthropic por independência de provider (C4 — avaliador ≠ gerador).
const TASK_ROUTES: Record<LlmTask, RouteConfig> = {
  // Pipeline legado — compatibilidade.
  "classification":       { provider: "google", model: "gemini-2.5-flash-lite" },
  "classification-judge": { provider: "google", model: "gemini-2.5-flash-lite" },
  "dre-narrative":        { provider: "google", model: "gemini-2.5-flash" },
  "action-plan":          { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "eval-judge":           { provider: "anthropic", model: "claude-haiku-4-5" },
  "dre-extraction":       { provider: "google", model: "gemini-2.5-flash" },

  // Pipeline agentic/LangGraph — SLM first.
  "normalization":        { provider: "google", model: "gemini-2.5-flash-lite" },
  "clarity-judge":        { provider: "google", model: "gemini-2.5-flash-lite" },
  "dre-classification":   { provider: "google", model: "gemini-2.5-flash-lite" },
  "anomaly-detection":    { provider: "google", model: "gemini-2.5-flash-lite" },
  "margin-diagnosis":     { provider: "google", model: "gemini-2.5-flash-lite" },
  "cashflow-risk":        { provider: "google", model: "gemini-2.5-flash-lite" },
  "narrative-synthesis":  { provider: "google", model: "gemini-2.5-flash" },
  "action-planning":      { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "financial-qa-review":  { provider: "google", model: "gemini-2.5-flash" },
};

// Fallback quando provider primário falha — tudo em Vertex AI (LGPD).
const FALLBACK_ROUTES: Partial<Record<LlmTask, RouteConfig>> = {
  // Pipeline legado.
  "classification":       { provider: "google", model: "gemini-2.5-flash" },
  "classification-judge": { provider: "google", model: "gemini-2.5-flash" },
  "dre-narrative":        { provider: "google", model: "gemini-2.5-flash" },
  "action-plan":          { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "eval-judge":           { provider: "google", model: "gemini-2.5-flash" },
  "dre-extraction":       { provider: "google", model: "gemini-2.5-flash" },

  // Pipeline agentic/LangGraph.
  "normalization":        { provider: "google", model: "gemini-2.5-flash" },
  "clarity-judge":        { provider: "google", model: "gemini-2.5-flash" },
  "dre-classification":   { provider: "google", model: "gemini-2.5-flash" },
  "anomaly-detection":    { provider: "google", model: "gemini-2.5-flash" },
  "margin-diagnosis":     { provider: "google", model: "gemini-2.5-flash" },
  "cashflow-risk":        { provider: "google", model: "gemini-2.5-flash" },
  "narrative-synthesis":  { provider: "google", model: "gemini-2.5-flash" },
  "action-planning":      { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "financial-qa-review":  { provider: "google", model: "gemini-2.5-flash" },
};

export function resolveRoute(task: LlmTask, useFallback = false): RouteConfig {
  if (useFallback) return FALLBACK_ROUTES[task] ?? TASK_ROUTES[task];
  return TASK_ROUTES[task];
}
