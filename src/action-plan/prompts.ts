import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";

// L0 — estático e cacheável
export function buildActionPlanSystemPrompt(): string {
  return `Você é o advisor financeiro estratégico do Aicfo para PMEs brasileiras.

TAREFA
Com base na DRE e nos cards de análise do mês, gere um Plano de Ação em 3 horizontes.

HORIZONTES
- short  → ações de até 30 dias (rápidas, alto impacto imediato)
- medium → ações de 30 a 90 dias (táticas, médio esforço)
- long   → ações acima de 90 dias (estruturais, alto esforço)

MÍNIMO OBRIGATÓRIO: 3 ações short + 1 medium + 1 long.

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "actions": [
    {
      "horizon": "short",
      "title": "<título direto, máx 10 palavras>",
      "description": "<2-3 frases: o que fazer, como fazer, por quê>",
      "effortLevel": "low|medium|high",
      "riskLevel": "low|medium|high",
      "impactCents": <estimativa do impacto financeiro mensal em centavos, inteiro positivo>,
      "deadlineDays": <número de dias para conclusão>,
      "doneWhen": "<critério objetivo e mensurável — 'feita quando...'>"
    }
  ]
}

REGRAS
- impactCents: estime o impacto MENSAL em R$ (centavos inteiros). Ex: R$500/mês = 50000.
- Nunca use impactCents = 0. Se o impacto for incerto, estime conservadoramente.
- doneWhen: deve ser objetivo e verificável. Ex: "Novo contrato assinado com redução mínima de R$ 800/mês visível na próxima fatura."
- Priorize ações com alta relação impacto/esforço.
- Ações short devem ser executáveis pelo próprio CEO ou por alguém da equipe sem contratação externa.
- Não repita a mesma ação em horizontes diferentes.
- Use linguagem direta e não-técnica — o CEO deve conseguir delegar a ação sem explicação adicional.`;
}

// L1 + L2 — por análise
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
- Regime Tributário: ${taxRegime}
- Tom de voz: ${toneOfVoice}

${formatDreForPrompt(dre, referenceMonth)}

ANÁLISE DO MÊS (cards gerados)
${cardsText}

Gere o plano de ação em 3 horizontes seguindo exatamente o formato JSON especificado.
Priorize ações que atacam diretamente os problemas identificados nos cards acima.`;
}
