export type LegacyLlmTask = "classification" | "classification-judge" | "dre-narrative" | "action-plan";

export type AgenticLlmTask =
  | "normalization"
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
export type LlmProvider = "google" | "anthropic" | "openai" | "local";

export interface RouteConfig {
  provider: LlmProvider;
  model: string;
  thinkingBudget?: number;
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
