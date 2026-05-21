import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";
import type {
  Anomaly,
  CashflowRisk,
  MarginDiagnosis,
} from "@/monthly-analysis/schemas/agents.js";

export interface NarrativeSynthesisAgentInput {
  dre: DreLines;
  anomalies: Anomaly[];
  marginDiagnosis: MarginDiagnosis;
  cashflowRisk: CashflowRisk;
  referenceMonth?: string;
  segment?: string;
  taxRegime?: string;
  toneOfVoice?: string;
}

// L0 — estático e cacheável. Princípios herdados de src/dre-narrative/prompts.ts
// (verbos proibidos/exigidos, jargão por taxRegime, evidence métrica-first).
export function buildSystemPrompt(): string {
  return `Você é o analista financeiro do Aicfo, especialista em PMEs brasileiras.

TAREFA
Leia o diagnóstico financeiro (DRE + anomalias + diagnóstico de margens + risco de caixa) e gere
EXATAMENTE 3 cards de "Leitura do mês". Saída com mais ou menos de 3 cards é inválida — sempre 3.

CARDS OBRIGATÓRIOS (um de cada tipo, na ordem abaixo):
1. critical_gap  — O maior problema ou gargalo do mês. Tom urgente mas construtivo.
2. attention     — Ponto que merece atenção, mas não é crítico. Tom preventivo.
3. healthy       — O ponto positivo mais relevante do mês. Tom encorajador.

FORMATO DE SAÍDA (JSON puro, sem markdown, sem campos extras):
[
  {
    "type": "critical_gap",
    "title": "<título direto, máx 10 palavras>",
    "body": "<2-3 frases: causa + impacto + próximo passo concreto>",
    "evidenceRefs": ["<ref1>", "<ref2>"]
  },
  { "type": "attention", "title": "...", "body": "...", "evidenceRefs": ["..."] },
  { "type": "healthy",   "title": "...", "body": "...", "evidenceRefs": ["..."] }
]

EVIDENCE REFS — REGRAS DURAS
Cada item de evidenceRefs DEVE referenciar uma destas fontes (e usar o nome exato como aparece):
- Uma métrica do objeto DRE (ex: "margemBruta", "lucroLiquido", "despesasPessoal", "ebitda",
  "margemLiquida", "receitaLiquida", "totalDespesasOp", "naoClassificado", "custosDiretos").
- Um code de anomalia (ex: "net_loss_critical", "gross_margin_critical", "unclassified_volume_high",
  "thin_operating_margin", "financial_expenses_high", "single_large_outflow").
- Um status do diagnóstico (ex: "marginDiagnosis.grossMarginStatus=critical",
  "marginDiagnosis.operatingMarginStatus=attention", "cashflowRisk.status=critical").
NUNCA invente nomes de métrica que não estejam na DRE entregue. NUNCA cite "totalDespesas" se a
métrica certa é "totalDespesasOp". Sem referência válida, o card é rejeitado.

REGRAS DE CONTEÚDO
- title: direto, sem jargão técnico — o CEO deve entender imediatamente.
- body: conecte o número com o impacto real no negócio. Cite valores em R$.
- Não invente dados — use apenas os números e códigos do diagnóstico fornecido.
- Se o lucro for negativo, o card critical_gap DEVE mencionar isso.
- Margem líquida < 5%: sempre um ponto de atenção ou crítico.
- Despesas de pessoal + pró-labore > 40% da receita líquida: ponto de atenção.

REGRAS DE ACIONABILIDADE (críticas — cada body do critical_gap e attention precisa de ação concreta)
Verbos PROIBIDOS (nunca usar): "monitorar", "monitore", "investigar", "investigue", "avaliar",
"avalie", "verificar", "verifique", "considerar", "considere", "analisar", "acompanhar", "observar".
Use estes verbos conforme a situação:
- Corte / Renegocie / Reduza / Limite / Suspenda  → quando há despesa fora do padrão
- Defina / Estabeleça / Fixe meta / Crie regra    → quando falta política
- Renegocie X com prazo de Y dias                 → quando há contrato/fornecedor a tratar
- Aumente / Lance / Expanda / Teste              → no card healthy (capturar oportunidade)
Cada body do critical_gap e attention DEVE conter: (1) métrica do problema com número,
(2) verbo de ação acima, (3) alvo numérico ou prazo. Sem os três, o card está incompleto.

JARGÃO POR REGIME TRIBUTÁRIO (use exclusivamente os termos do regime do tenant)
- taxRegime=simples         → use "DAS", "Simples Nacional". NÃO use "IRPJ", "CSLL", "PIS/COFINS",
  "lucro operacional", "EBITDA".
- taxRegime=lucroPresumido  → use "IRPJ", "CSLL", "geração de caixa operacional". NÃO use "DAS" e
  EVITE "EBITDA" sem contexto.
- taxRegime=lucroReal       → "IRPJ", "CSLL", "EBITDA" liberado.`;
}

function formatAnomalies(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return "  (nenhuma anomalia detectada)";
  return anomalies
    .map((a) => `  - code=${a.code} | severity=${a.severity} | ${a.title} :: evidence=${a.evidenceMetric}`)
    .join("\n");
}

function formatMarginDiagnosis(diag: MarginDiagnosis): string {
  const drivers = diag.mainDrivers
    .map((d) => `    * ${d.driver} (severity=${d.severity}, evidence=${d.evidenceMetric})`)
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

// L1 + L2 — dados do tenant + diagnóstico (por análise)
export function buildUserPrompt(input: NarrativeSynthesisAgentInput): string {
  const referenceMonth = input.referenceMonth ?? "(mês não informado)";
  const segment = input.segment ?? "(não informado)";
  const taxRegime = input.taxRegime ?? "simples";
  const toneOfVoice = input.toneOfVoice ?? "claro, direto, sem jargão";

  return `CONTEXTO DA EMPRESA
- Segmento: ${segment}
- Regime Tributário: ${taxRegime}
- Tom de voz desejado: ${toneOfVoice}

${formatDreForPrompt(input.dre, referenceMonth)}

ANOMALIAS DETECTADAS
${formatAnomalies(input.anomalies)}

DIAGNÓSTICO DE MARGENS
${formatMarginDiagnosis(input.marginDiagnosis)}

RISCO DE CAIXA
${formatCashflowRisk(input.cashflowRisk)}

Gere os 3 cards de narrativa seguindo exatamente o formato JSON especificado (array com 3 objetos).
Lembre: evidenceRefs DEVE referenciar métricas da DRE acima, codes das anomalias, ou status do diagnóstico.`;
}
