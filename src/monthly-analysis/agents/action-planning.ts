import { callLlm } from "@/llm/index.js";
import type { LlmResponse } from "@/llm/types.js";
import {
  ActionPlanDraftSchema,
  type ActionPlanDraft,
  type Anomaly,
  type CashflowRisk,
  type MarginDiagnosis,
  type NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/monthly-analysis/agents/prompts/action-planning.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";

export interface ActionPlanningAgentInput {
  dre: DreLines;
  anomalies: Anomaly[];
  narrativeCards: NarrativeCardDraft[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
  toneOfVoice?: string;
}

const EFFORT_SCORE: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };
const RISK_SCORE: Record<"low" | "medium" | "high", number> = { low: 1, medium: 2, high: 3 };

export function sortShortsByRoi(plan: ActionPlanDraft): ActionPlanDraft {
  const shorts = plan.actions.filter((a) => a.horizon === "short");
  const rest = plan.actions.filter((a) => a.horizon !== "short");

  const sorted = [...shorts].sort((a, b) => {
    const roiA = a.impactCents / (EFFORT_SCORE[a.effortLevel] ?? 2);
    const roiB = b.impactCents / (EFFORT_SCORE[b.effortLevel] ?? 2);
    if (roiB !== roiA) return roiB - roiA;
    return (RISK_SCORE[a.riskLevel] ?? 2) - (RISK_SCORE[b.riskLevel] ?? 2);
  });

  return { ...plan, actions: [...sorted, ...rest] };
}

export async function runActionPlanningAgent(
  input: ActionPlanningAgentInput,
  options: MonthlyAgentRunOptions,
): Promise<ActionPlanDraft> {
  const { data } = await runActionPlanningAgentWithTelemetry(input, options);
  return data;
}

// Reforço enviado na 2ª tentativa quando o 1º plano não bate o mínimo do schema
// (< 5 ações ou faltando horizonte). Re-chamar SÓ o agente é muito mais barato que
// deixar a exceção derrubar o grafo e o worker reprocessar a análise inteira (~50s+).
const PLAN_REINFORCE = `\n\nIMPORTANTE: o plano anterior foi REJEITADO por ter menos de 5 ações ou faltar um horizonte. Gere OBRIGATORIAMENTE no mínimo 5 ações — pelo menos 2 short, 1 medium e 1 long. Esta empresa, mesmo saudável, tem alavancas de CFO suficientes: complete com ações OFENSIVAS materiais (reserva/runway, diversificação de receita, reinvestimento, precificação, eficiência fiscal). Não é enchimento — é alocação de capital.`;

export async function runActionPlanningAgentWithTelemetry(
  input: ActionPlanningAgentInput,
  options: MonthlyAgentRunOptions,
): Promise<{ data: ActionPlanDraft; response: LlmResponse; latencyMs: number }> {
  const start = Date.now();
  const systemPrompt = buildSystemPrompt();
  const baseUserPrompt = buildUserPrompt(input);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await callLlm({
      task: "action-planning",
      systemPrompt,
      userPrompt: attempt === 0 ? baseUserPrompt : baseUserPrompt + PLAN_REINFORCE,
      tenantId: options.tenantId,
      traceId: options.traceId,
      jsonMode: true,
    });
    try {
      const data = sortShortsByRoi(parseAgentJson(response.content, ActionPlanDraftSchema));
      return { data, response, latencyMs: Date.now() - start };
    } catch (err) {
      lastErr = err;
    }
  }
  // Esgotou o retry local: propaga para o tratamento de erro do grafo (mantém o
  // contrato — um plano que insiste em vir incompleto não é entregue silenciosamente).
  throw lastErr;
}
