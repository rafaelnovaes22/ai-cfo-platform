import { callLlm } from "@/llm/index.js";
import { parseAgentJson, type MonthlyAgentRunOptions } from "@/monthly-analysis/agents/classification.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type FinancialQaReviewAgentInput,
} from "@/monthly-analysis/agents/prompts/financial-qa-review.js";
import { QaReviewSchema, type ActionPlanItemDraft, type NarrativeCardDraft, type QaReview } from "@/monthly-analysis/schemas/agents.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";

export type { FinancialQaReviewAgentInput } from "@/monthly-analysis/agents/prompts/financial-qa-review.js";

export interface FinancialQaReviewRunOptions extends MonthlyAgentRunOptions {
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
}

/**
 * Audita a análise mensal antes da publicação. Detecta number_mismatch, missing_doneWhen,
 * contradiction (narrativa vs. diagnóstico), missing_evidence (anomalia high sem ação) e
 * unfounded_claim. Não reescreve conteúdo — apenas emite issues estruturados e retryTargets.
 *
 * Falha rápido se o LLM devolver JSON malformado ou inválido contra QaReviewSchema.
 */
export async function runFinancialQaReviewAgent(
  state: Pick<
    MonthlyAnalysisState,
    "dre" | "anomalies" | "marginDiagnosis" | "cashflowRisk" | "narrativeCards" | "actionPlan"
  >,
  options: FinancialQaReviewRunOptions,
): Promise<QaReview> {
  if (
    !state.dre ||
    !state.anomalies ||
    !state.marginDiagnosis ||
    !state.cashflowRisk ||
    !state.narrativeCards ||
    !state.actionPlan
  ) {
    throw new Error(
      "financial-qa-review: estado incompleto — exige dre, anomalies, marginDiagnosis, cashflowRisk, narrativeCards e actionPlan.",
    );
  }

  const deterministicReview = runDeterministicFinancialQaReview(state);
  if (!deterministicReview.publishable) {
    return deterministicReview;
  }

  const input: FinancialQaReviewAgentInput = {
    dre: state.dre,
    anomalies: state.anomalies,
    marginDiagnosis: state.marginDiagnosis,
    cashflowRisk: state.cashflowRisk,
    narrativeCards: state.narrativeCards,
    actionPlan: state.actionPlan,
    referenceMonth: options.referenceMonth,
    segment: options.segment,
    taxRegime: options.taxRegime,
  };

  const response = await callLlm({
    task: "financial-qa-review",
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
    tenantId: options.tenantId,
    traceId: options.traceId,
    jsonMode: true,
  });

  return parseAgentJson(response.content, QaReviewSchema);
}

type QaIssue = QaReview["issues"][number];
type RetryTarget = QaReview["retryTargets"][number];

const QA_CODES = {
  numberMismatch: "NUMBER_MISMATCH",
  missingDoneWhen: "MISSING_DONEWHEN",
  contradiction: "CONTRADICTION",
  missingEvidence: "MISSING_EVIDENCE",
  unfoundedClaim: "UNFOUNDED_CLAIM",
  stageMismatch: "STAGE_MISMATCH",
} as const;

export function runDeterministicFinancialQaReview(
  state: Pick<
    MonthlyAnalysisState,
    "dre" | "anomalies" | "marginDiagnosis" | "cashflowRisk" | "narrativeCards" | "actionPlan"
  >,
): QaReview {
  if (!state.dre || !state.anomalies || !state.marginDiagnosis || !state.cashflowRisk || !state.narrativeCards || !state.actionPlan) {
    throw new Error("financial-qa-review deterministic: estado incompleto.");
  }

  const dre = state.dre;
  const issues: QaIssue[] = [];
  const retryTargets = new Set<RetryTarget>();

  const addIssue = (issue: QaIssue, target: RetryTarget): void => {
    issues.push(issue);
    if (issue.severity === "blocker") retryTargets.add(target);
  };

  const cards = state.narrativeCards;
  const actions = state.actionPlan.actions;
  const allCardText = cards.map((card) => `${card.title} ${card.body}`).join("\n").toLowerCase();

  for (const [idx, card] of cards.entries()) {
    const mismatch = findNarrativeNumberMismatch(card, dre);
    if (mismatch) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.numberMismatch,
        message: `card#${idx + 1} cita ${mismatch.found}, mas ${mismatch.metric} = ${mismatch.expected}.`,
        evidenceRef: mismatch.metric,
      }, "narrative-synthesis");
    }
  }

  for (const [idx, action] of actions.entries()) {
    if (!isDoneWhenMeasurable(action.doneWhen)) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.missingDoneWhen,
        message: `action#${idx + 1} tem doneWhen vazio ou sem metrica, numero/prazo e criterio verificavel.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
    if (!Array.isArray(action.evidenceRefs) || action.evidenceRefs.length === 0) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.missingEvidence,
        message: `action#${idx + 1} nao possui evidenceRefs rastreaveis.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
    if (isImpactImplausible(action, dre.receitaBruta)) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.unfoundedClaim,
        message: `action#${idx + 1} promete impacto mensal acima de 20% da receita sem evidencia explicita.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
    if (isIrreversiblePeopleAction(action) && hasSevereOrContradictorySignal(state)) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.unfoundedClaim,
        message: `action#${idx + 1} recomenda acao irreversivel de pessoal com dados severos/contraditorios sem revisao humana.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
    if (isTaxOverreach(action)) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.unfoundedClaim,
        message: `action#${idx + 1} trata economia tributaria ou troca de regime como certeza sem validacao do contador.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
    if (isTurnaround(dre) && isExpansionAction(action)) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.stageMismatch,
        message: `action#${idx + 1} recomenda expansão ("${action.title}") em cenário de turnaround (lucroLiquido < 0). Foque em cortar, renegociar, cobrar recebíveis e preservar caixa.`,
        evidenceRef: `action#${idx + 1}`,
      }, "action-planning");
    }
  }

  if (dre.margemLiquida < 0 && cards.some((card) => isHealthyPraise(card))) {
    addIssue({
      severity: "blocker",
      code: QA_CODES.contradiction,
      message: "Narrativa elogia mes lucrativo/saudavel apesar de margemLiquida negativa.",
      evidenceRef: "margemLiquida",
    }, "narrative-synthesis");
  }

  if (
    state.marginDiagnosis?.grossMarginStatus === "critical" &&
    cards.some((card) => card.type === "healthy" && /margem bruta|custos diretos|custo direto|fornecedor/.test(`${card.title} ${card.body}`.toLowerCase()) && isHealthyPraise(card))
  ) {
    addIssue({
      severity: "blocker",
      code: QA_CODES.contradiction,
      message: "Card healthy contradiz diagnostico critico de margem.",
      evidenceRef: "marginDiagnosis.grossMarginStatus",
    }, "narrative-synthesis");
  }

  if (
    state.cashflowRisk?.status === "critical" &&
    cards.some((card) => card.type === "healthy" && /caixa|liquidez|capital de giro/.test(`${card.title} ${card.body}`.toLowerCase()) && isHealthyPraise(card))
  ) {
    addIssue({
      severity: "blocker",
      code: QA_CODES.contradiction,
      message: "Card healthy contradiz risco critico de caixa.",
      evidenceRef: "cashflowRisk.status",
    }, "narrative-synthesis");
  }

  const highAnomalies = (state.anomalies ?? []).filter((anomaly) => anomaly.severity === "high");
  for (const anomaly of highAnomalies) {
    const cardCovers = cards.some((card) => card.evidenceRefs.includes(anomaly.code));
    const actionCovers = actions.some((action) => action.evidenceRefs.includes(anomaly.code));
    if (!cardCovers) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.missingEvidence,
        message: `Anomalia high ${anomaly.code} nao aparece em evidenceRefs da narrativa.`,
        evidenceRef: anomaly.code,
      }, "narrative-synthesis");
    }
    if (!actionCovers) {
      addIssue({
        severity: "blocker",
        code: QA_CODES.missingEvidence,
        message: `Anomalia high ${anomaly.code} nao possui acao correspondente no plano.`,
        evidenceRef: anomaly.code,
      }, "action-planning");
    }
  }

  if (hasFraudOverclaim(cards, state.anomalies ?? [])) {
    addIssue({
      severity: "blocker",
      code: QA_CODES.unfoundedClaim,
      message: "Narrativa afirma fraude comprovada quando a base indica apenas suspeita/anomalia.",
      evidenceRef: "fraud_overclaim",
    }, "narrative-synthesis");
  }

  if (hasMaterialUnclassifiedData(dre) && !mentionsDataQuality(allCardText)) {
    addIssue({
      severity: "blocker",
      code: QA_CODES.missingEvidence,
      message: "naoClassificado material nao foi mencionado como limitacao de confiabilidade nos cards.",
      evidenceRef: "naoClassificado",
    }, "narrative-synthesis");
  }

  const uniqueTargets = [...retryTargets];
  return {
    publishable: issues.every((issue) => issue.severity !== "blocker"),
    issues,
    retryTargets: uniqueTargets,
  };
}

function findNarrativeNumberMismatch(
  card: NarrativeCardDraft,
  dre: NonNullable<MonthlyAnalysisState["dre"]>,
): { metric: string; found: string; expected: string } | null {
  const text = `${card.title} ${card.body}`;
  const checks: Array<{ metric: keyof typeof dre; label: string; expected: number; unit: "%" | "R$" }> = [
    { metric: "margemBruta", label: "margem bruta", expected: dre.margemBruta, unit: "%" },
    { metric: "margemLiquida", label: "margem liquida", expected: dre.margemLiquida, unit: "%" },
  ];

  for (const check of checks) {
    const value = extractNumberNearLabel(text, check.label, check.unit);
    if (value === null) continue;
    const tolerance = Math.max(Math.abs(check.expected) * 0.01, check.unit === "%" ? 0.2 : 100);
    if (Math.abs(value - check.expected) > tolerance) {
      return {
        metric: String(check.metric),
        found: check.unit === "%" ? `${value}%` : `R$ ${value}`,
        expected: check.unit === "%" ? `${check.expected}%` : `R$ ${check.expected}`,
      };
    }
  }
  return null;
}

function extractNumberNearLabel(text: string, label: string, unit: "%" | "R$"): number | null {
  const escaped = label.replace(/\s+/g, "\\s+");
  const labelThenNumber = new RegExp(`${escaped}.{0,40}?${unit === "R$" ? "R\\$\\s*" : ""}(-?\\d+(?:[.,]\\d+)?)\\s*${unit === "%" ? "%" : ""}`, "i");
  const numberThenLabel = new RegExp(`${unit === "R$" ? "R\\$\\s*" : ""}(-?\\d+(?:[.,]\\d+)?)\\s*${unit === "%" ? "%" : ""}.{0,40}?${escaped}`, "i");
  const match = text.match(labelThenNumber) ?? text.match(numberThenLabel);
  if (!match?.[1]) return null;
  const value = parseHumanNumber(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseHumanNumber(raw: string): number {
  const text = raw.trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) {
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  return Number(text.replace(",", "."));
}

function isDoneWhenMeasurable(doneWhen: string): boolean {
  const text = doneWhen.trim().toLowerCase();
  if (text.length < 8) return false;
  if (/cliente satisfeito|feito|ok|concluido|acompanhar|melhorar/.test(text) && !/\d|r\$|%|>=|<=/.test(text)) {
    return false;
  }
  const hasNumberOrDeadline = /\d|r\$|%|>=|<=/.test(text);
  const hasVerification = /assinado|registrad|medid|publicad|reduzid|abaixo|acima|até|ate|conclu|homologad|aprovad|comparad|cai|recuperad|recebimento/.test(text);
  return hasNumberOrDeadline && hasVerification;
}

function isImpactImplausible(action: ActionPlanItemDraft, receitaBruta: number): boolean {
  if (receitaBruta <= 0) return false;
  return action.impactCents > Math.round(receitaBruta * 0.2);
}

function isHealthyPraise(card: NarrativeCardDraft): boolean {
  const text = `${card.title} ${card.body}`.toLowerCase();
  return /saudavel|saudável|lucrativo|excelente|sob controle|solida|sólida/.test(text);
}

function hasSevereOrContradictorySignal(
  state: Pick<MonthlyAnalysisState, "anomalies" | "marginDiagnosis" | "cashflowRisk">,
): boolean {
  return (
    (state.anomalies ?? []).some((anomaly) => anomaly.severity === "high") ||
    state.marginDiagnosis?.grossMarginStatus === "critical" ||
    state.marginDiagnosis?.operatingMarginStatus === "critical" ||
    state.cashflowRisk?.status === "critical"
  );
}

function isIrreversiblePeopleAction(action: ActionPlanItemDraft): boolean {
  const text = `${action.title} ${action.description} ${action.doneWhen}`.toLowerCase();
  return /demitir|demissao|demissão|desligar|cortar\s+\d+%?\s+da\s+equipe|reduzir\s+\d+%?\s+da\s+equipe/.test(text);
}

function hasFraudOverclaim(cards: NarrativeCardDraft[], anomalies: NonNullable<MonthlyAnalysisState["anomalies"]>): boolean {
  const hasSuspectAnomaly = anomalies.some((anomaly) => /suspect|suspeit|duplicate|duplic/i.test(`${anomaly.code} ${anomaly.title} ${anomaly.description}`));
  if (!hasSuspectAnomaly) return false;
  return cards.some((card) => /fraude comprovada|fraude confirmada|desvio comprovado/i.test(`${card.title} ${card.body}`));
}

function hasMaterialUnclassifiedData(dre: NonNullable<MonthlyAnalysisState["dre"]>): boolean {
  if (dre.receitaBruta <= 0) return false;
  return dre.naoClassificado / dre.receitaBruta >= 0.2;
}

function mentionsDataQuality(text: string): boolean {
  return /naoclassificado|nao classificado|não classificado|confiabilidade|qualidade dos dados|classificacao|classificação/.test(text);
}

function isTurnaround(dre: NonNullable<MonthlyAnalysisState["dre"]>): boolean {
  return dre.lucroLiquido < 0;
}

function isExpansionAction(action: ActionPlanItemDraft): boolean {
  const text = `${action.title} ${action.description} ${action.doneWhen}`.toLowerCase();
  return (
    /\bexpandir\b/.test(text) ||
    /\bcontratar\s+(?:equipe|time|vendedor|representante|funcionário|funcionarios)\b/.test(text) ||
    /\baumentar\s+(?:equipe|time|marketing|verba)\b/.test(text) ||
    /\binvestir\s+em\s+crescimento\b/.test(text) ||
    /\blançar\s+(?:novo|nova|novos|novas)\s+(?:produto|canal|serviço|linha)\b/.test(text) ||
    /\babrir\s+(?:filial|loja|nova\s+unidade)\b/.test(text) ||
    /\bcampanha\s+de\s+(?:captação|aquisição|marketing)\b/.test(text)
  );
}

function isTaxOverreach(action: ActionPlanItemDraft): boolean {
  const text = `${action.title} ${action.description} ${action.doneWhen}`.toLowerCase();
  const taxPromise = /reduzir\s+\d+%?\s+(do\s+)?imposto|economia\s+tributaria|economia\s+tributária|trocar\s+regime|mudanca\s+de\s+regime|mudança\s+de\s+regime/.test(text);
  const hasCaveat = /contador|contabil|contábil|simulacao|simulação|validar|parecer/.test(text);
  return taxPromise && !hasCaveat;
}
