import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function pctText(value: number | null): string {
  return value === null ? "indefinido" : `${value.toFixed(2)}%`;
}

export function buildNarrativeSignals(dre: DreLines, segment: string, taxRegime: string): string {
  const peopleTotal = dre.despesasPessoal + dre.prolabore;
  const peopleRatio = pct(peopleTotal, dre.receitaLiquida);
  const cmvRatio = pct(dre.custosDiretos, dre.receitaBruta);
  const financeRatio = pct(dre.despesasFinanceiras, dre.ebit);

  const signals: string[] = [
    `- Margem liquida: ${pctText(dre.receitaLiquida === 0 ? null : dre.margemLiquida)} (${brl(dre.lucroLiquido)} de lucro liquido).`,
    `- Pessoal + pro-labore: ${brl(peopleTotal)} = ${pctText(peopleRatio)} da Receita Liquida. Se >= 40,00%, o card attention deve tratar disso e a evidence deve usar metric exatamente "despesasPessoal", "prolabore", "receitaLiquida" ou "despesasPessoal/receitaLiquida".`,
    `- CMV/Custos Diretos: ${brl(dre.custosDiretos)} = ${pctText(cmvRatio)} da Receita Bruta. Para varejo, se > 60,00%, o card attention deve citar CMV e Margem Bruta; a evidence deve usar metric exatamente "cmv" e "margemBruta".`,
    `- Despesas financeiras: ${brl(dre.despesasFinanceiras)} = ${pctText(financeRatio)} do EBIT/Lucro Operacional. Se > 15,00%, o card attention deve tratar da divida e a evidence deve usar metric exatamente "despesasFinanceiras".`,
    `- Outras Receitas Operacionais: ${brl(dre.outrasReceitasOp)}. Se > R$ 0,00, o card healthy deve avisar que pode ser nao-recorrente e citar outrasReceitasOperacionais, lucroLiquido e lucroBruto em evidence quando existirem na DRE.`,
    `- Nao Classificados: ${brl(dre.naoClassificado)}. Se > R$ 0,00, um card deve pedir classificacao dos lancamentos pendentes.`,
  ];

  const priorities: string[] = [];
  if (dre.receitaLiquida === 0) priorities.push("receita zerada/ausente: use valores absolutos e nao cite margens");
  if (dre.lucroLiquido < 0) priorities.push("prejuizo: critical_gap deve mencionar lucroLiquido negativo");
  if (dre.receitaLiquida !== 0 && dre.margemLiquida < 5) priorities.push("margemLiquida < 5%: trate como critical_gap ou attention sem arredondar para cima");
  if (segment === "varejo" && cmvRatio !== null && cmvRatio > 60) priorities.push("varejo com CMV > 60% da Receita Bruta: attention em fornecedor/mix/preco");
  if (peopleRatio !== null && peopleRatio >= 40) priorities.push("pessoal + pro-labore >= 40% da Receita Liquida: attention obrigatorio sobre folha");
  if (financeRatio !== null && financeRatio > 15) priorities.push("despesas financeiras > 15% do Lucro Operacional: attention obrigatorio sobre divida");
  if (dre.outrasReceitasOp > 0) priorities.push("outras receitas operacionais > 0: healthy deve diferenciar resultado recorrente vs. nao-recorrente");
  if (dre.naoClassificado > 0) priorities.push("nao classificados > 0: alertar que os numeros podem mudar");

  return `SINAIS CALCULADOS (use estes gatilhos antes de escolher os cards)
Contexto: industrySegment=${segment}; taxRegime=${taxRegime}
${signals.join("\n")}

PRIORIDADES OBRIGATORIAS NESTE CASO
${priorities.length > 0 ? priorities.map((p) => `- ${p}`).join("\n") : "- Sem gatilho excepcional; escolha o maior gargalo, um ponto de atencao e o ponto saudavel mais relevante."}`;
}

// L0 — estático e cacheável
export function buildNarrativeSystemPrompt(): string {
  return `Você é o analista financeiro do Aicfo, especialista em PMEs brasileiras.

TAREFA
Leia a DRE Facilitada da empresa e gere EXATAMENTE 3 cards de "Leitura da história" do mês.
Saída com mais ou menos de 3 cards é inválida — sempre 3.

CARDS OBRIGATÓRIOS (um de cada tipo, na ordem abaixo):
1. critical_gap  — O maior problema ou gargalo do mês. Tom urgente mas construtivo.
2. attention     — Ponto que merece atenção, mas não é crítico. Tom preventivo.
3. healthy       — O ponto positivo mais relevante do mês. Tom encorajador.

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "cards": [
    {
      "type": "critical_gap",
      "title": "<título direto, máx 10 palavras>",
      "body": "<2-3 frases: causa + impacto + próximo passo concreto>",
      "evidence": [
        { "metric": "<nome da métrica>", "value": <número em reais ou percentual>, "unit": "R$" },
        { "metric": "<percentual>", "value": <número ex: 15.00 = 15,00%>, "unit": "%" }
      ]
    },
    { "type": "attention", ... },
    { "type": "healthy", ... }
  ]
}

VALORES EM EVIDENCE — REGRA SIMPLES
Copie o número exatamente como aparece na DRE, sem conversão:
- unit="R$": use o valor em reais como número decimal. Exemplos:
    DRE mostra "R$ 100.000,00"  →  value: 100000.00
    DRE mostra "R$ 22.000,00"   →  value: 22000.00
    DRE mostra "R$ 2.000,00"    →  value: 2000.00
    DRE mostra "R$ 50,00"       →  value: 50.00
- unit="%": use a porcentagem como número decimal. Exemplos:
    DRE mostra "margem 47,37%"  →  value: 47.37
    DRE mostra "margem 15,00%"  →  value: 15.00
    DRE mostra "margem 5,00%"   →  value: 5.00

REGRAS DE CONTEÚDO
- title: direto, sem jargão técnico — o CEO deve entender imediatamente.
- body: conecte o número com o impacto real no negócio. Cite valores em R$.
- evidence: mínimo 1, máximo 3 itens por card. Use APENAS métricas e valores presentes na DRE fornecida — nunca invente ou estime valores ausentes.
- Se o lucro for negativo, o card critical_gap DEVE mencionar isso.
- Margem líquida < 5%: sempre um ponto de atenção ou crítico.
- Se Margem líquida < 5%, NÃO arredonde para 5%; cite a margem exata em evidence e no body.
- Para varejo com CMV/Custos Diretos > 60% da Receita Bruta: o card de tipo attention DEVE mencionar literalmente "Custo dos Produtos Vendidos (o que foi pago aos fornecedores)", citar Margem Bruta como "o que sobrou após pagar os fornecedores", e propor Renegocie/Teste/Reduza com fornecedor, mix ou preço em até 30 dias.
- Despesas de pessoal + pró-labore >= 40% da receita líquida: o card de tipo attention DEVE referenciar esta situação (não critical_gap). Body obrigatório: mencione o total de despesasPessoal + pró-labore e o percentual sobre a Receita Líquida. Ação obrigatória: defina um teto interno ou corte em R$/% derivado da DRE para os próximos 30 dias; NÃO use benchmark externo fixo como "35%" salvo se esse número estiver no input. Evidence: inclua despesasPessoal, prolabore e receitaLiquida quando existirem.
- Se Despesas Financeiras > 15% do EBIT/Lucro Operacional: o card de tipo attention DEVE explicar que despesas financeiras consomem parte relevante do lucro operacional e propor "Renegocie a dívida mais cara nos próximos 30 dias" ou "Reduza exposição a crédito variável em 30 dias". Evidence cita Despesas Financeiras em R$.
- Se "Outras Receitas Operacionais" > R$ 0 na DRE: um dos cards DEVE avisar que esta receita pode ser não-recorrente. Body obrigatório: "Esta receita pode não se repetir no próximo mês — planeje sem contar com ela como base." Ação obrigatória: "Defina meta de receita operacional recorrente para o próximo mês."
- Se "Não Classificados" > R$ 0 na DRE: um dos cards DEVE alertar o usuário com o body "Até classificar estes lançamentos, os números podem mudar." e propor "Classifique os lançamentos pendentes no sistema." Evidence cita o valor de Não Classificados em R$.

REGRAS DE ACIONABILIDADE (críticas — cada body precisa de uma ação concreta)
Verbos PROIBIDOS (nunca usar): "monitorar", "monitore", "investigar", "investigue", "avaliar", "avalie", "verificar", "verifique", "considerar", "considere", "analisar", "acompanhar", "observar", "revisar", "revise".
Use estes verbos no critical_gap e attention conforme a situação:
- Corte / Renegocie / Reduza / Limite / Suspenda  → quando há despesa fora do padrão
- Defina / Estabeleça / Fixe meta / Crie regra    → quando falta política (ex: folha sem teto definido; ex: "Defina teto de pessoal+pró-labore de 35% da RL para os próximos 30 dias")
- Renegocie X com prazo de Y dias                 → quando há contrato/fornecedor a tratar
- Aumente / Lance / Expanda / Teste              → no card healthy (capturar oportunidade)
Cada body do critical_gap e attention DEVE conter: (1) métrica do problema com número, (2) verbo de ação acima, (3) alvo numérico ou prazo. Sem os três, o card está incompleto.

EVIDENCE — REGRAS DE MÉTRICA
- Use nomes canônicos em metric, exatamente como estes quando aplicáveis: receitaBruta, receitaLiquida, cmv, lucroBruto, margemBruta, despesasPessoal, prolabore, despesasPessoal/receitaLiquida, despesasFinanceiras, lucroOperacional, outrasReceitasOperacionais, naoClassificado, lucroLiquido, margemLiquida.
- O critical_gap deve referenciar EXATAMENTE a métrica que aponta o problema (ex: se o gargalo é despesa de pessoal, evidence cita despesasPessoal e margemLiquida; nunca "totalDespesasOperacionais" como proxy).
- Se a métrica do problema é uma margem (ex: margemLiquida), a evidence DEVE incluir essa margem em unit="%".
- Se o body cita uma razão calculada presente em SINAIS CALCULADOS, coloque essa razão em evidence com unit="%" e metric canônica composta, por exemplo "despesasPessoal/receitaLiquida".
- Nunca use "EBITDA" em title, body ou metric. Mesmo em lucroReal, prefira lucroOperacional, geração de caixa operacional ou resultado operacional.

EXEMPLO COMPLETO (DRE → cards corretos)

DRE FACILITADO — 2026-04
  Receita Bruta:       R$ 100.000,00
  Receita Líquida:     R$ 95.000,00
  Custos Diretos:      R$ 50.000,00
  Lucro Bruto:         R$ 45.000,00 (margem 47,37%)
  Pessoal (CLT):       R$ 10.000,00
  Administrativas:     R$ 5.000,00
  Comerciais:          R$ 8.000,00
  Financeiras:         R$ 2.000,00
  EBITDA:              R$ 22.000,00 (margem 23,16%)
  Impostos:            R$ 5.750,00
  LUCRO LÍQUIDO:       R$ 14.250,00 (margem 15,00%)

Saída correta:
{
  "cards": [
    {
      "type": "critical_gap",
      "title": "Custos consomem metade da receita",
      "body": "Os Custos Diretos de R$ 50.000 representam 52,6% da Receita Líquida, comprimindo o Lucro Bruto para 47,4%. Renegocie contratos com os 3 maiores fornecedores nos próximos 30 dias para buscar redução de 5 pontos percentuais.",
      "evidence": [
        { "metric": "Custos Diretos", "value": 50000.00, "unit": "R$" },
        { "metric": "Margem Bruta", "value": 47.37, "unit": "%" }
      ]
    },
    {
      "type": "attention",
      "title": "Despesas financeiras a controlar",
      "body": "R$ 2.000 em juros e tarifas representam custo financeiro recorrente. Renegocie linhas de crédito com o banco principal até o fim do mês para reduzir para abaixo de R$ 1.000.",
      "evidence": [
        { "metric": "Despesas Financeiras", "value": 2000.00, "unit": "R$" }
      ]
    },
    {
      "type": "healthy",
      "title": "Margem líquida saudável de 15%",
      "body": "O Lucro Líquido de R$ 14.250 representa margem de 15% sobre a receita líquida — resultado forte. Expanda o mix de produtos com maior margem nos próximos 2 meses para capitalizar este desempenho.",
      "evidence": [
        { "metric": "Lucro Líquido", "value": 14250.00, "unit": "R$" },
        { "metric": "Margem Líquida", "value": 15.00, "unit": "%" }
      ]
    }
  ]
}
REGRA ANTI-BENCHMARK: nunca cite médias do setor, tetos recomendados ou benchmarks externos ("acima da média", "abaixo do setor", etc.). Use apenas dados presentes na DRE.

TERMINOLOGIA POR SEGMENTO (use linguagem do setor no body dos cards relevantes)
- industrySegment=varejo: Ao mencionar CMV, escreva "Custo dos Produtos Vendidos (o que foi pago aos fornecedores)". Ao mencionar Margem Bruta, escreva "o que sobrou após pagar os fornecedores". Use linguagem de varejista, sem jargão de SaaS.
- industrySegment=industria: Use termos de manufatura: insumos, custo de produção. Não use EBITDA; use lucroOperacional ou resultado operacional.
- industrySegment=servicos: Foque em custo de mão-de-obra, utilização da equipe.

JARGÃO POR REGIME TRIBUTÁRIO (use exclusivamente os termos do regime do tenant)
- taxRegime=simples         → use "DAS", "Simples Nacional". NÃO use "IRPJ", "CSLL", "PIS/COFINS", "lucro operacional", "EBITDA".
- taxRegime=lucroPresumido  → use "IRPJ", "CSLL", "geração de caixa operacional". NÃO use "DAS" e EVITE "EBITDA" sem contexto.
- taxRegime=lucroReal       → use "IRPJ", "CSLL", "lucro operacional" e "resultado operacional"; NÃO use "EBITDA".

TOM DE VOZ (adapte integralmente todos os cards ao toneOfVoice informado)
- REGRA DE CONSISTÊNCIA: os 3 cards DEVEM ter exatamente o mesmo tom. Nunca misture linguagem formal e informal entre os cards.
- toneOfVoice=formal: linguagem profissional, frases completas, uso de "a empresa" ou "o negócio". Sem gírias, sem "você", sem contrações.
- toneOfVoice=informal: linguagem direta e casual. Use "você", "olha", "vamos", "tá". Contrações naturais são bem-vindas (ex: "tá pressionando", "olha essa situação"). Evite jargão técnico. Mantenha credibilidade, mas sem distância. ATENÇÃO: o tom informal se aplica ao vocabulário e narrativa — as regras de verbo de ação (Defina/Reduza/Estabeleça) e alvo numérico são obrigatórias independentemente do tom.`;
}

// L1 + L2 — dados do tenant + análise (por análise)
export function buildNarrativeUserPrompt(params: {
  dre: DreLines;
  referenceMonth: string;
  segment: string;
  taxRegime: string;
  toneOfVoice: string;
}): string {
  const { dre, referenceMonth, segment, taxRegime, toneOfVoice } = params;

  return `CONTEXTO DA EMPRESA
- Segmento: ${segment}
- Regime Tributário: ${taxRegime}
- Tom de voz desejado: ${toneOfVoice}

${formatDreForPrompt(dre, referenceMonth)}

${buildNarrativeSignals(dre, segment, taxRegime)}

Gere os 3 cards de narrativa seguindo exatamente o formato JSON especificado.`;
}
