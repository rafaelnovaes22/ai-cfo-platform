// Tasks fora do grafo LangGraph: geração standalone usada por evals (dre-narrative,
// action-plan), judge de evals e extração de PDF no ingest. As tasks da cadeia
// BullMQ legada (classification, classification-judge) foram removidas com ela.
export type LegacyLlmTask =
  | "dre-narrative"
  | "action-plan"
  | "eval-judge"
  | "dre-extraction";

export type AgenticLlmTask =
  | "normalization"
  | "business-profile"
  | "clarity-judge"
  | "dre-classification"
  | "anomaly-detection"
  | "margin-diagnosis"
  | "cashflow-risk"
  | "narrative-synthesis"
  | "action-planning"
  | "financial-qa-review";

// Mantém compatibilidade com o pipeline atual enquanto a evolução LangGraph é construída.
export type LlmTask = LegacyLlmTask | AgenticLlmTask;
export type LlmProvider = "google" | "anthropic" | "openai" | "groq" | "local";

export interface RouteConfig {
  provider: LlmProvider;
  model: string;
  thinkingBudget?: number;
  // Temperatura de amostragem. Omitido = default do provider (Gemini ≈ 1.0, alto).
  // Tarefas determinísticas (classificação, extração, diagnóstico, julgamento) usam
  // 0 para o mesmo extrato gerar sempre a mesma saída — sem isso, itens ambíguos
  // oscilam entre reingestões e o saldo do caixa muda.
  temperature?: number;
}

export interface LlmRequest {
  task: LlmTask;
  systemPrompt: string;
  userPrompt: string;
  tenantId: string;
  traceId?: string;
  jsonMode?: boolean;
}

export interface LlmResponse {
  content: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  traceId: string | null;
}
