import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";
import { buildNarrativeSignals } from "@/dre-narrative/prompts.js";
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
- taxRegime=lucroReal       → "IRPJ", "CSLL", "EBITDA" liberado.

TERMINOLOGIA POR SEGMENTO (adapte o vocabulário dos cards ao setor)
- varejo:           Ao mencionar CMV, escreva "Custo dos Produtos Vendidos (o que foi pago aos fornecedores)". Margem Bruta = "o que sobrou após pagar os fornecedores".
- industria-leve:   Use termos de manufatura: insumos, custo de produção. Prefira lucroOperacional; evite EBITDA.
- servicos-b2b:     Foque em custo de mão-de-obra, utilização da equipe, faturamento por consultor.
- saas:             Use termos de recorrência (MRR, ARR, churn, expansão de receita).
- agencia:          Foque em capacidade instalada, horas entregues, renegociação de pacotes.

TOM DE VOZ (adapte os 3 cards ao toneOfVoice informado — sem misturar tons)
- toneOfVoice=formal:   linguagem profissional, frases completas, use "a empresa" ou "o negócio". Sem gírias.
- toneOfVoice=informal: use "você", "olha", "vamos". Contrações naturais são bem-vindas ("tá pressionando",
  "olha essa situação"). As regras de verbo de ação e alvo numérico são obrigatórias independentemente do tom.

REGRA ANTI-BENCHMARK
Nunca cite médias do setor, benchmarks externos ou tetos recomendados ("acima da média", "o ideal é 35%",
"abaixo do padrão de mercado", etc.). Use apenas números presentes na DRE e nos sinais fornecidos.

EXEMPLO COMPLETO (DRE → 3 cards corretos — use como referência de qualidade)

DRE de referência — 2026-04
  Receita Bruta:   R$ 100.000
  Receita Líquida: R$ 95.000
  Custos Diretos:  R$ 50.000 (Margem Bruta 47,37%)
  Pessoal (CLT):   R$ 10.000
  Financeiras:     R$ 2.000
  Lucro Líquido:   R$ 14.250 (margem 15,00%)

Saída correta:
[
  {
    "type": "critical_gap",
    "title": "Custos consomem metade da receita",
    "body": "Os Custos Diretos de R$ 50.000 representam 52,6% da Receita Líquida, comprimindo o Lucro Bruto para 47,4%. Renegocie contratos com os 3 maiores fornecedores nos próximos 30 dias para buscar redução de 5 pontos percentuais.",
    "evidenceRefs": ["custosDiretos", "margemBruta"]
  },
  {
    "type": "attention",
    "title": "Despesas financeiras a controlar",
    "body": "R$ 2.000 em juros e tarifas representam custo financeiro recorrente. Renegocie linhas de crédito com o banco principal até o fim do mês para reduzir para abaixo de R$ 1.000.",
    "evidenceRefs": ["despesasFinanceiras"]
  },
  {
    "type": "healthy",
    "title": "Margem líquida saudável de 15%",
    "body": "O Lucro Líquido de R$ 14.250 representa margem de 15% sobre a receita líquida — resultado forte. Expanda o mix de produtos com maior margem nos próximos 2 meses para capitalizar este desempenho.",
    "evidenceRefs": ["lucroLiquido", "margemLiquida"]
  }
]`;
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

${buildNarrativeSignals(input.dre, segment, taxRegime)}

Gere os 3 cards de narrativa seguindo exatamente o formato JSON especificado (array com 3 objetos).
Lembre: evidenceRefs DEVE referenciar métricas da DRE acima, codes das anomalias, ou status do diagnóstico.
Use os SINAIS CALCULADOS acima para decidir qual o maior gargalo, qual ponto merece atenção e qual o destaque saudável.`;
}
