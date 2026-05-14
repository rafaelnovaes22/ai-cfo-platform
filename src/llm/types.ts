export type LlmTask = "classification" | "dre-narrative" | "action-plan";
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
