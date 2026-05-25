import type { LlmTask, RouteConfig } from "@/llm/types.js";

// Roteamento por tarefa — único lugar que define qual provider/modelo usar.
// Para trocar modelo de uma tarefa: editar aqui, sem tocar nos nós LangGraph/agentes.
//
// Todos os providers são Google (Vertex AI southamerica-east1) para conformidade LGPD:
// dados não saem do Brasil e não são usados para treino de modelos externos.
// `eval-judge` usa gemini-2.5-flash (modelo maior) para independência de modelo em relação
// aos geradores (gemini-2.5-flash-lite) — independência de modelo satisfaz C4 sem DPA Anthropic.
const TASK_ROUTES: Record<LlmTask, RouteConfig> = {
  // Pipeline legado — compatibilidade.
  "classification":       { provider: "google", model: "gemini-2.5-flash-lite" },
  "classification-judge": { provider: "google", model: "gemini-2.5-flash-lite" },
  "dre-narrative":        { provider: "google", model: "gemini-2.5-flash" },
  "action-plan":          { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048 },
  "eval-judge":           { provider: "google", model: "gemini-2.5-flash" },
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

// Fallback quando provider primário (Google Vertex AI) falha.
// Provider: OpenAI gpt-4.1-mini — DPA assinado em 2026-05-25 (ADR-010).
// store: false no adapter garante que dados não são retidos para treino (LGPD).
// thinkingBudget omitido — não suportado pela API OpenAI.
const FALLBACK_ROUTES: Partial<Record<LlmTask, RouteConfig>> = {
  // Pipeline legado.
  "classification":       { provider: "openai", model: "gpt-4.1-mini" },
  "classification-judge": { provider: "openai", model: "gpt-4.1-mini" },
  "dre-narrative":        { provider: "openai", model: "gpt-4.1-mini" },
  "action-plan":          { provider: "openai", model: "gpt-4.1-mini" },
  "eval-judge":           { provider: "openai", model: "gpt-4.1-mini" },
  "dre-extraction":       { provider: "openai", model: "gpt-4.1-mini" },

  // Pipeline agentic/LangGraph.
  "normalization":        { provider: "openai", model: "gpt-4.1-mini" },
  "clarity-judge":        { provider: "openai", model: "gpt-4.1-mini" },
  "dre-classification":   { provider: "openai", model: "gpt-4.1-mini" },
  "anomaly-detection":    { provider: "openai", model: "gpt-4.1-mini" },
  "margin-diagnosis":     { provider: "openai", model: "gpt-4.1-mini" },
  "cashflow-risk":        { provider: "openai", model: "gpt-4.1-mini" },
  "narrative-synthesis":  { provider: "openai", model: "gpt-4.1-mini" },
  "action-planning":      { provider: "openai", model: "gpt-4.1-mini" },
  "financial-qa-review":  { provider: "openai", model: "gpt-4.1-mini" },
};

export function resolveRoute(task: LlmTask, useFallback = false): RouteConfig {
  if (useFallback) return FALLBACK_ROUTES[task] ?? TASK_ROUTES[task];
  return TASK_ROUTES[task];
}
