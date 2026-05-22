import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";
import type {
  Anomaly,
  CashflowRisk,
  MarginDiagnosis,
  NarrativeCardDraft,
} from "@/monthly-analysis/schemas/agents.js";

export interface ActionPlanningPromptInput {
  dre: DreLines;
  anomalies: Anomaly[];
  narrativeCards: NarrativeCardDraft[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  referenceMonth?: string;
}

// L0 — estático, cacheável
export function buildSystemPrompt(): string {
  return `Você é o advisor financeiro estratégico do Aicfo para PMEs brasileiras.

TAREFA
Gere um Plano de Ação em 3 horizontes (short / medium / long) consumindo:
- DRE Facilitado do mês
- Anomalias detectadas (com código, severidade, evidenceMetric)
- Cards narrativos (critical_gap | attention | healthy) com evidenceRefs
- Diagnóstico de margem (bruta e operacional)
- Risco de fluxo de caixa (status: healthy | attention | critical | insufficient_data)

HORIZONTES
- short  → até 30 dias (executáveis pelo CEO sem contratação externa)
- medium → 30 a 90 dias (táticas, médio esforço)
- long   → acima de 90 dias (estruturais)

MÍNIMO OBRIGATÓRIO: 3 ações short + 3 medium + 3 long (total >= 9).

PRIORIZAÇÃO POR RISCO
- Se cashflowRisk.status == "critical" OU existir anomalia com severity == "high":
  favoreça FORTEMENTE o horizonte SHORT (preserve caixa, reduza saída imediata,
  acelere recebíveis). Mínimo 5 short nesse cenário crítico, mas mantenha ao
  menos 2 medium e 2 long.
- Se margens estiverem "critical", inclua ao menos 1 short que ataque o driver
  principal listado em mainDrivers.

REGRAS DE EVIDÊNCIA (OBRIGATÓRIO)
- Toda ação DEVE citar pelo menos 1 evidenceRef em evidenceRefs[] usando uma
  das fontes:
  * código de anomalia (ex: "anomaly:MARGIN_DROP_HIGH")
  * métrica da DRE (ex: "dre:margemBruta", "dre:despesasPessoal")
  * referência de card narrativo (ex: "card:critical_gap:<title>")
  * driver de margem (ex: "driver:custo_pessoal")
- evidenceRefs NÃO PODE ser vazio. Não invente evidências — use apenas o que
  está no contexto fornecido.

CRITÉRIO DE "FEITO" (OBRIGATÓRIO)
- doneWhen deve ser objetivo, verificável e mensurável.
  Bom: "Novo contrato assinado com redução >= R$ 800/mês visível na fatura de junho/2026."
  Ruim: "Reduzir custos" / "Renegociar fornecedor".

FORMATO DE SAÍDA (JSON puro, sem markdown, sem comentários):
{
  "actions": [
    {
      "horizon": "short",
      "title": "<máx 10 palavras, direto>",
      "description": "<2-3 frases: o que, como, por quê>",
      "effortLevel": "low|medium|high",
      "riskLevel": "low|medium|high",
      "impactCents": <inteiro positivo, impacto MENSAL em centavos>,
      "deadlineDays": <inteiro positivo>,
      "doneWhen": "<critério mensurável>",
      "evidenceRefs": ["<ref1>", "<ref2>"],
      "assumptions": ["<premissa opcional>"],
      "confidence": <0.0..1.0>
    }
  ]
}

REGRAS NUMÉRICAS
- impactCents > 0 sempre. Estime conservador se incerto, nunca 0.
- confidence em [0,1]. Use <= 0.6 quando depender de premissas não validadas
  e a anomalia/card de origem tiver severity "low" ou status "insufficient_data".
- Não repita a mesma ação em horizontes diferentes.
- Linguagem direta, em português do Brasil, não-técnica.`;
}

function formatAnomalies(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "(nenhuma anomalia detectada)";
  return anomalies
    .map((a) =>
      `- [${a.severity.toUpperCase()}] ${a.code} — ${a.title}
  ${a.description}
  evidenceMetric: ${a.evidenceMetric}${a.impactCents !== undefined ? ` | impactCents: ${a.impactCents}` : ""}`,
    )
    .join("\n");
}

function formatNarrativeCards(cards: NarrativeCardDraft[]): string {
  if (cards.length === 0) return "(sem cards)";
  return cards
    .map((c) =>
      `[${c.type.toUpperCase()}] ${c.title}
  ${c.body}
  evidenceRefs: ${c.evidenceRefs.join(", ")}`,
    )
    .join("\n\n");
}

function formatMarginDiagnosis(diag: MarginDiagnosis): string {
  const drivers = diag.mainDrivers
    .map((d) => `  - driver:${d.driver} [${d.severity}] impactCents=${d.impactCents} evidence=${d.evidenceMetric}`)
    .join("\n");
  return `Margem Bruta: ${diag.grossMarginStatus}
Margem Operacional: ${diag.operatingMarginStatus}
Main drivers:
${drivers}`;
}

function formatCashflowRisk(risk: CashflowRisk): string {
  const reasons = risk.reasons.length > 0 ? risk.reasons.map((r) => `  - ${r}`).join("\n") : "  (sem motivos listados)";
  const limits = risk.limitations.length > 0
    ? `\nLimitações dos dados:\n${risk.limitations.map((l) => `  - ${l}`).join("\n")}`
    : "";
  return `Status: ${risk.status}
Motivos:
${reasons}${limits}`;
}

// L1 + L2 — por análise
export function buildUserPrompt(input: ActionPlanningPromptInput): string {
  const referenceMonth = input.referenceMonth ?? "mês de referência";

  return `${formatDreForPrompt(input.dre, referenceMonth)}

ANOMALIAS DETECTADAS
${formatAnomalies(input.anomalies)}

DIAGNÓSTICO DE MARGEM
${formatMarginDiagnosis(input.marginDiagnosis)}

RISCO DE FLUXO DE CAIXA
${formatCashflowRisk(input.cashflowRisk)}

CARDS NARRATIVOS DO MÊS
${formatNarrativeCards(input.narrativeCards)}

Gere o plano de ação em 3 horizontes seguindo EXATAMENTE o formato JSON especificado.
Toda ação DEVE conter evidenceRefs não-vazio citando uma fonte do contexto acima.
Se houver risco crítico de caixa ou anomalia de severidade alta, concentre o plano em ações SHORT.`;
}
