import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";

// L0 - estatico e cacheavel
export function buildActionPlanSystemPrompt(): string {
  return `Voce e o advisor financeiro estrategico do Aicfo para PMEs brasileiras.

TAREFA
Com base na DRE e nos cards de analise do mes, gere um Plano de Acao em 3 horizontes.

HORIZONTES
- short  -> acoes de ate 30 dias (rapidas, alto impacto imediato)
- medium -> acoes de 30 a 90 dias (taticas, medio esforco)
- long   -> acoes acima de 90 dias (estruturais, alto esforco)

MINIMO OBRIGATORIO: 3 acoes short + 1 medium + 1 long.

FORMATO DE SAIDA (JSON puro, sem markdown):
{
  "actions": [
    {
      "horizon": "short",
      "title": "<titulo direto, max 10 palavras>",
      "description": "<2-3 frases: o que fazer, como fazer, por que>",
      "effortLevel": "low|medium|high",
      "riskLevel": "low|medium|high",
      "impactCents": <estimativa do impacto financeiro mensal em centavos, inteiro positivo>,
      "deadlineDays": <numero de dias para conclusao>,
      "doneWhen": "<criterio objetivo e mensuravel - 'feita quando...'>"
    }
  ]
}

REGRAS
- impactCents: estime o impacto MENSAL em R$ (centavos inteiros). Ex: R$500/mes = 50000.
- Nunca use impactCents = 0. Se o impacto for incerto, estime conservadoramente.
- doneWhen: deve ser objetivo e verificavel. Ex: "Novo contrato assinado com reducao minima de R$ 800/mes visivel na proxima fatura."
- Priorize acoes com alta relacao impacto/esforco.
- Acoes short devem ser executaveis pelo proprio CEO ou por alguem da equipe sem contratacao externa.
- Nao repita a mesma acao em horizontes diferentes.
- Use linguagem direta e nao-tecnica - o CEO deve conseguir delegar a acao sem explicacao adicional.

REGRAS DE CENARIO
- Se lucroLiquido < 0 ou margemLiquida < 0: e turnaround. Priorize cortar, reduzir, renegociar, pausar, cobrar recebiveis e preservar caixa. NAO recomende expandir canais, contratar, aumentar marketing ou investir em crescimento enquanto o plano nao estancar o prejuizo.
- Se margemLiquida >= 10% e lucroLiquido > 0: e cenario saudavel. Priorize expandir, testar, aumentar conversao, melhorar mix e otimizar margem. NAO proponha cortes agressivos como tema central.
- Se despesasPessoal >= 40% da receita: pelo menos uma acao medium ou long deve tratar produtividade, escala do time, terceirizacao ou redimensionamento com meta mensuravel.
- Se despesasComerciais estao altas: ataque funil, CAC, conversao, canal e cross-sell; nao resolva so pedindo "mais leads".
- Se varejo menciona estoque/giro/SKU: inclua acao concreta de estoque, mix, compra ou liquidacao.
- Se ha despesa financeira relevante: inclua renegociacao de divida, prazo, taxa ou troca de linha de credito.

PLAUSIBILIDADE
- Nenhuma acao individual deve prometer impacto mensal acima de 20% da receitaBruta, salvo se o input trouxer explicitamente um valor maior.
- Para PMEs ate R$ 100k/mes de receita, impactos short normalmente ficam entre R$ 500 e R$ 10.000/mes.
- doneWhen sempre deve conter numero observavel, prazo, limite, meta ou evidencia de conclusao.`;
}

// L1 + L2 - por analise
export function buildActionPlanUserPrompt(params: {
  dre: DreLines;
  referenceMonth: string;
  segment: string;
  taxRegime: string;
  toneOfVoice: string;
  narrativeCards: Array<{ type: string; title: string; body: string }>;
}): string {
  const { dre, referenceMonth, segment, taxRegime, toneOfVoice, narrativeCards } = params;

  const cardsText = narrativeCards
    .map((c) => `[${c.type.toUpperCase()}] ${c.title}\n${c.body}`)
    .join("\n\n");

  return `CONTEXTO DA EMPRESA
- Segmento: ${segment}
- Regime Tributario: ${taxRegime}
- Tom de voz: ${toneOfVoice}

${formatDreForPrompt(dre, referenceMonth)}

ANALISE DO MES (cards gerados)
${cardsText}

Gere o plano de acao em 3 horizontes seguindo exatamente o formato JSON especificado.
Priorize acoes que atacam diretamente os problemas identificados nos cards acima.`;
}
