import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";
import type {
  ActionPlanDraft,
  Anomaly,
  CashflowRisk,
  MarginDiagnosis,
  NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";

export interface FinancialQaReviewAgentInput {
  dre: DreLines;
  anomalies: Anomaly[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  narrativeCards: NarrativeCardDraft[];
  actionPlan: ActionPlanDraft;
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
}

// L0 — papel + invariantes do auditor. Estático e cacheável.
export function buildSystemPrompt(): string {
  return `Você é o auditor financeiro do Aicfo — uma camada de QA que decide se a análise
mensal pode ser publicada para o CEO da PME. Seu trabalho é detectar incoerências entre
os artefatos gerados (cards de narrativa, plano de ação) e a base factual (DRE, anomalias,
diagnóstico de margens, risco de caixa).

VOCÊ NÃO REESCREVE conteúdo — apenas reporta issues estruturados. Quem corrige é o agente
upstream (narrative-synthesis ou action-planning) num re-run.

CHECKLIST OBRIGATÓRIO (rode TODOS os checks; um único blocker bloqueia a publicação):

1) NUMBER_MISMATCH (blocker)
   Card ou ação cita um número (R$ ou %) que não bate com a DRE ou com o impactCents de
   uma anomalia. Tolerância: ±1% para arredondamento. Se a narrativa fala "lucro de
   R$ 50k" mas DRE.lucroLiquido = R$ 38k, é blocker.

2) MISSING_DONEWHEN (blocker)
   Ação sem doneWhen mensurável. doneWhen DEVE conter (a) métrica nomeada, (b) valor-alvo
   numérico ou prazo absoluto, (c) verbo de verificação. "Cliente satisfeito" não vale;
   "Despesa de viagem cai abaixo de R$ 5.000 até 2026-07-01" vale.

3) CONTRADICTION (blocker)
   Narrativa afirma "margem saudável" / "tudo sob controle" enquanto
   marginDiagnosis.grossMarginStatus = "critical" ou cashflowRisk.status = "critical".
   Vale também o inverso: card "healthy" elogia algo que o diagnóstico marca como
   "attention" ou "critical".

4) MISSING_EVIDENCE (blocker)
   Existem anomalias com severity = "high" e o actionPlan NÃO contém NENHUMA ação cujo
   evidenceRefs cite o code dessa anomalia. Ou: card critical_gap não menciona nenhuma
   anomalia high quando elas existem.

5) UNFOUNDED_CLAIM (warning, blocker se afeta decisão de caixa)
   Narrativa faz afirmação sobre causa ("queda foi sazonal", "concorrência forte") sem
   que isso esteja respaldado por anomalia, diagnóstico, ou linha da DRE. Marque warning
   por padrão; blocker apenas se a afirmação induz o CEO a uma decisão de caixa errada.

6) STAGE_MISMATCH (blocker)
   Empresa em turnaround (DRE.lucroLiquido < 0) e o plano contém ações de expansão:
   expandir canais, contratar equipe de vendas, aumentar marketing, investir em crescimento,
   lançar novo produto/canal, abrir filial ou campanha de captação/aquisição.
   Em turnaround o plano DEVE focar exclusivamente em cortar, renegociar, cobrar recebíveis
   e preservar caixa. Marque cada ação expansionista como blocker individual.

FORMATO DE SAÍDA (JSON puro, sem markdown, sem campos extras):
{
  "publishable": <boolean>,
  "issues": [
    {
      "severity": "blocker" | "warning",
      "code": "NUMBER_MISMATCH" | "MISSING_DONEWHEN" | "CONTRADICTION" | "MISSING_EVIDENCE" | "UNFOUNDED_CLAIM" | "STAGE_MISMATCH",
      "message": "<frase curta explicando o problema, citando o trecho ofensor>",
      "evidenceRef": "<métrica DRE | code de anomalia | id estável do card/ação | opcional>"
    }
  ],
  "retryTargets": ["narrative-synthesis" | "action-planning"]
}

REGRAS DURAS DE SAÍDA
- publishable = false se houver pelo menos um issue com severity = "blocker".
- publishable = true e issues = [] quando tudo está coerente.
- retryTargets deve listar:
    * "narrative-synthesis" se houver blocker em algum card (NUMBER_MISMATCH/CONTRADICTION/MISSING_EVIDENCE em card, UNFOUNDED_CLAIM-blocker).
    * "action-planning" se houver blocker em alguma ação (MISSING_DONEWHEN, NUMBER_MISMATCH em ação, MISSING_EVIDENCE no plano, STAGE_MISMATCH).
    * Se não houver blocker, retryTargets = [].
- NUNCA invente issues sem evidência. Se está em dúvida entre warning e blocker, prefira warning.
- NUNCA reescreva o conteúdo dos agentes — você só audita.`;
}

function formatAnomalies(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "  (nenhuma anomalia detectada)";
  return anomalies
    .map((a) => {
      const impact = a.impactCents !== undefined ? ` impactCents=${a.impactCents}` : "";
      return `  - code=${a.code} | severity=${a.severity} | ${a.title} :: evidence=${a.evidenceMetric}${impact}`;
    })
    .join("\n");
}

function formatMarginDiagnosis(diag: MarginDiagnosis): string {
  const drivers = diag.mainDrivers
    .map((d) => `    * ${d.driver} (severity=${d.severity}, evidence=${d.evidenceMetric}, impactCents=${d.impactCents})`)
    .join("\n");
  return `  grossMarginStatus=${diag.grossMarginStatus}
  operatingMarginStatus=${diag.operatingMarginStatus}
  mainDrivers:
${drivers}`;
}

function formatCashflowRisk(risk: CashflowRisk): string {
  const reasons = risk.reasons.map((r) => `    - ${r}`).join("\n");
  const limitations = risk.limitations.length
    ? "\n  limitations:\n" + risk.limitations.map((l) => `    - ${l}`).join("\n")
    : "";
  return `  status=${risk.status}
  reasons:
${reasons}${limitations}`;
}

function formatNarrativeCards(cards: NarrativeCardDraft[]): string {
  return cards
    .map((c, i) => {
      const refs = c.evidenceRefs.join(", ");
      return `  [card#${i + 1} type=${c.type}]
    title: ${c.title}
    body:  ${c.body}
    evidenceRefs: [${refs}]`;
    })
    .join("\n");
}

function formatActionPlan(plan: ActionPlanDraft): string {
  return plan.actions
    .map((a, i) => {
      const refs = a.evidenceRefs.join(", ");
      const deadline = a.deadlineDays !== undefined ? ` deadlineDays=${a.deadlineDays}` : "";
      return `  [action#${i + 1} horizon=${a.horizon} effort=${a.effortLevel} risk=${a.riskLevel}]
    title: ${a.title}
    description: ${a.description}
    impactCents: ${a.impactCents}${deadline}
    doneWhen: ${a.doneWhen}
    evidenceRefs: [${refs}]
    confidence: ${a.confidence}`;
    })
    .join("\n");
}

// L1 + L2 — dados do tenant + diagnóstico + artefatos a auditar.
export function buildUserPrompt(input: FinancialQaReviewAgentInput): string {
  const referenceMonth = input.referenceMonth ?? "(mês não informado)";
  const segment = input.segment ?? "(não informado)";
  const taxRegime = input.taxRegime ?? "simples";

  return `CONTEXTO DA EMPRESA
- Segmento: ${segment}
- Regime Tributário: ${taxRegime}

${formatDreForPrompt(input.dre, referenceMonth)}

ANOMALIAS DETECTADAS
${formatAnomalies(input.anomalies)}

DIAGNÓSTICO DE MARGENS
${formatMarginDiagnosis(input.marginDiagnosis)}

RISCO DE CAIXA
${formatCashflowRisk(input.cashflowRisk)}

NARRATIVA GERADA (3 cards)
${formatNarrativeCards(input.narrativeCards)}

PLANO DE AÇÃO GERADO
${formatActionPlan(input.actionPlan)}

Audite os artefatos acima contra a base factual (DRE + anomalias + diagnóstico + risco de caixa).
Retorne o JSON do QaReview seguindo exatamente o formato especificado.`;
}
