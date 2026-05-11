import type { DreLines } from "@/dre-narrative/aggregator.js";
import { formatDreForPrompt } from "@/dre-narrative/aggregator.js";

// L0 — estático e cacheável
export function buildNarrativeSystemPrompt(): string {
  return `Você é o analista financeiro do Aicfo, especialista em PMEs brasileiras.

TAREFA
Leia a DRE Facilitada da empresa e gere exatamente 3 cards de "Leitura da história" do mês.

CARDS OBRIGATÓRIOS (um de cada tipo):
1. critical_gap  — O maior problema ou gargalo do mês. Tom urgente mas construtivo.
2. attention     — Ponto que merece atenção, mas não é crítico. Tom preventivo.
3. healthy       — O ponto positivo mais relevante do mês. Tom encorajador.

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "cards": [
    {
      "type": "critical_gap",
      "title": "<título direto, máx 10 palavras>",
      "body": "<2-3 frases explicando causa + impacto, no tom de voz solicitado>",
      "evidence": [
        { "metric": "<nome da métrica>", "value": <centavos inteiro>, "unit": "R$" },
        { "metric": "<percentual>", "value": <inteiro ex: 3450 = 34.50%>, "unit": "%" }
      ]
    },
    { "type": "attention", ... },
    { "type": "healthy", ... }
  ]
}

REGRAS
- title: direto, sem jargão técnico — o CEO deve entender imediatamente.
- body: conecte o número com o impacto real no negócio. Cite valores em R$.
- evidence: mínimo 1, máximo 3 itens por card. Valores em centavos (inteiros).
- Não invente dados — use apenas os números da DRE fornecida.
- Se o lucro for negativo, o card critical_gap DEVE mencionar isso.
- Margem líquida < 5%: sempre um ponto de atenção ou crítico.
- Despesas de pessoal + pró-labore > 40% da receita líquida: ponto de atenção.`;
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

Gere os 3 cards de narrativa seguindo exatamente o formato JSON especificado.`;
}
