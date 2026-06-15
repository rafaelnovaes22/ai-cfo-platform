import type { DreLines } from "@/dre-narrative/aggregator.js";
import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";
import type {
  ActionPlanDraft,
  AgentCost,
  AgentError,
  AgentTrace,
  Anomaly,
  CashflowRisk,
  ClarityResult,
  DreClassificationResult,
  MarginDiagnosis,
  NarrativeCardDraft,
  NormalizedLedgerEntry,
  QaReview,
} from "@/monthly-analysis/schemas/agents.js";
import type { TenantMemoryContext } from "@/learning/tenant-context.js";


// Estado canônico do grafo LangGraph do SKU monthly-analysis.
// Aditivo ao pipeline BullMQ atual — coexistência até promoção SHADOW→default.
export type QaGateDecision = "narrative_synthesis" | "action_planning" | "finalize";

export interface MonthlyAnalysisState {
  analysisId: string;
  tenantId: string;
  traceId?: string;
  segment?: string;
  taxRegime?: string;
  toneOfVoice?: string;

  tenantMemory?: TenantMemoryContext;
  openingBalance?: number;
  previousDre?: DreLines;
  // últimos 12 meses fechados, ordenados do mais antigo ao mais recente (sem o mês atual)
  historicalDre?: DreLines[];
  rawEntries?: RawLedgerEntry[];

  normalizedEntries?: NormalizedLedgerEntry[];
  clarityResults?: ClarityResult[];
  classifiedEntries?: DreClassificationResult[];

  dre?: DreLines;
  // DRE em run-rate mensal por categoria (mês típico) — alimenta narrativa/plano,
  // que raciocinam em termos mensais; o `dre` acima é o total do período (exibido).
  monthlyDre?: DreLines;
  anomalies?: Anomaly[];
  marginDiagnosis?: MarginDiagnosis;
  cashflowRisk?: CashflowRisk;

  narrativeCards?: NarrativeCardDraft[];
  actionPlan?: ActionPlanDraft;
  qaReview?: QaReview;
  needsReview?: boolean;
  retryCount?: {
    narrative: number;
    actionPlan: number;
  };
  qaGateDecision?: QaGateDecision;

  costs: AgentCost[];
  traces: AgentTrace[];
  errors: AgentError[];
}

export function createInitialMonthlyAnalysisState(input: {
  analysisId: string;
  tenantId: string;
  traceId?: string;
}): MonthlyAnalysisState {
  return {
    analysisId: input.analysisId,
    tenantId: input.tenantId,
    traceId: input.traceId,
    costs: [],
    traces: [],
    errors: [],
  };
}
