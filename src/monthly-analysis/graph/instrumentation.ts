import { createHash } from "node:crypto";
import type { LlmResponse } from "@/llm/types.js";
import type { AgentCost, AgentName, AgentTrace } from "@/monthly-analysis/schemas/agents.js";

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

// Sentinela usada quando o agente decide pular a chamada LLM (input vazio etc.).
// Permite que o nó ainda emita um AgentTrace sem custo, mantendo o pipeline auditável.
export const NOOP_LLM_RESPONSE: LlmResponse = {
  content: "",
  provider: "local",
  model: "noop",
  inputTokens: 0,
  outputTokens: 0,
  costCents: 0,
  traceId: null,
};

// Builder para traces de nós rule-based (sem LLM). Não emite AgentCost.
export function buildRuleBasedTrace(input: {
  agent: AgentName;
  inputPayload: unknown;
  outputPayload: unknown;
}): { costs: AgentCost[]; traces: AgentTrace[] } {
  return {
    costs: [],
    traces: [
      {
        agent: input.agent,
        inputHash: hashPayload(input.inputPayload),
        outputHash: hashPayload(input.outputPayload),
        schemaPassed: true,
        retryCount: 0,
      },
    ],
  };
}

export function buildAgentTelemetry(input: {
  agent: AgentName;
  response: LlmResponse;
  inputPayload: unknown;
  outputPayload: unknown;
  latencyMs: number;
  schemaPassed?: boolean;
  retryCount?: number;
}): { costs: AgentCost[]; traces: AgentTrace[] } {
  return {
    costs: [
      {
        agent: input.agent,
        provider: input.response.provider,
        model: input.response.model,
        inputTokens: input.response.inputTokens,
        outputTokens: input.response.outputTokens,
        costCents: input.response.costCents,
        latencyMs: input.latencyMs,
        traceId: input.response.traceId,
      },
    ],
    traces: [
      {
        agent: input.agent,
        inputHash: hashPayload(input.inputPayload),
        outputHash: hashPayload(input.outputPayload),
        schemaPassed: input.schemaPassed ?? true,
        retryCount: input.retryCount ?? 0,
      },
    ],
  };
}
