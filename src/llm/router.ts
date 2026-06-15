import type { LlmTask, RouteConfig } from "@/llm/types.js";

// Roteamento por tarefa — único lugar que define qual provider/modelo usar.
// Para trocar modelo de uma tarefa: editar aqui, sem tocar nos nós LangGraph/agentes.
//
// Todos os providers são Google (Vertex AI). Região us-central1 (ADR-019: o Gemini
// 2.5 não está em southamerica-east1; transferência internacional amparada por SCCs
// do Google DPA — Art. 33 LGPD; Vertex não usa os dados para treino).
// `eval-judge` usa gemini-2.5-flash (modelo maior) para independência de modelo em relação
// aos geradores (gemini-2.5-flash-lite) — independência de modelo satisfaz C4 sem DPA Anthropic.
// temperature: 0 nas tarefas determinísticas (extração, classificação, diagnóstico,
// julgamento) — o mesmo extrato deve gerar sempre a mesma saída; sem isso, itens
// ambíguos oscilam entre reingestões e o saldo muda. Geração de texto (narrativa,
// plano) usa 0.3 — baixa variância sem robotizar o texto.
const TASK_ROUTES: Record<LlmTask, RouteConfig> = {
  // Fora do grafo — geração standalone usada por evals + extração de PDF do ingest.
  "dre-narrative":        { provider: "google", model: "gemini-2.5-flash", temperature: 0.3 },
  "action-plan":          { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048, temperature: 0.3 },
  "eval-judge":           { provider: "google", model: "gemini-2.5-flash", temperature: 0 },
  "dre-extraction":       { provider: "google", model: "gemini-2.5-flash", temperature: 0 },

  // Pipeline agentic/LangGraph — SLM first.
  "normalization":        { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "business-profile":     { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "clarity-judge":        { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "dre-classification":   { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "anomaly-detection":    { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "margin-diagnosis":     { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "cashflow-risk":        { provider: "google", model: "gemini-2.5-flash-lite", temperature: 0 },
  "narrative-synthesis":  { provider: "google", model: "gemini-2.5-flash", temperature: 0.3 },
  "action-planning":      { provider: "google", model: "gemini-2.5-flash", thinkingBudget: 2048, temperature: 0.3 },
  "financial-qa-review":  { provider: "google", model: "gemini-2.5-flash", temperature: 0 },
};

// Fallback quando provider primário (Google Vertex AI) falha.
// Provider: OpenAI gpt-4.1-mini — DPA assinado em 2026-05-25 (ADR-010).
// store: false no adapter garante que dados não são retidos para treino (LGPD).
// thinkingBudget omitido — não suportado pela API OpenAI.
const FALLBACK_ROUTES: Partial<Record<LlmTask, RouteConfig>> = {
  // Fora do grafo.
  "dre-narrative":        { provider: "openai", model: "gpt-4.1-mini", temperature: 0.3 },
  "action-plan":          { provider: "openai", model: "gpt-4.1-mini", temperature: 0.3 },
  "eval-judge":           { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "dre-extraction":       { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },

  // Pipeline agentic/LangGraph.
  "normalization":        { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "business-profile":     { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "clarity-judge":        { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "dre-classification":   { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "anomaly-detection":    { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "margin-diagnosis":     { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "cashflow-risk":        { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
  "narrative-synthesis":  { provider: "openai", model: "gpt-4.1-mini", temperature: 0.3 },
  "action-planning":      { provider: "openai", model: "gpt-4.1-mini", temperature: 0.3 },
  "financial-qa-review":  { provider: "openai", model: "gpt-4.1-mini", temperature: 0 },
};

export function resolveRoute(task: LlmTask, useFallback = false): RouteConfig {
  if (useFallback) return FALLBACK_ROUTES[task] ?? TASK_ROUTES[task];
  return TASK_ROUTES[task];
}
