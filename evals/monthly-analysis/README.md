# Evals — monthly-analysis agent seeds

Seeds iniciais para avaliar agentes do SKU `monthly-analysis` sem tocar no core do grafo em `src/monthly-analysis/graph`. Os casos são L2/operacionais, em Markdown com frontmatter compatível com o loader genérico existente (`case_id`, `module`, `outcome`, `source_mode`).

## Cobertura inicial

- `normalization/cases`: 10 cases cobrindo preservação de valor/data, limpeza de descrição, tipo documental, duplicidade suspeita, contraparte desconhecida e valores arredondados.
- `narrative-synthesis/cases`: 15 cases cobrindo exatamente 3 cards, evidências numéricas, cenários saudáveis, riscos, contradições lucro/caixa, baixa confiabilidade e anomalias.
- `action-planning/cases`: 15 cases cobrindo plano 3 horizontes (>=3 short, >=1 medium, >=1 long), doneWhen, evidenceRefs, impacto plausível e needs_review.
- `financial-qa-review/cases`: 10 cases adversariais cobrindo mismatch numérico, schema gap, contradição narrativa, excesso tributário/fraude, impacto implausível e um estado limpo publicável.

## Como usar no runner futuro

1. Carregar `evals/monthly-analysis/<agent>/manifest.json`.
2. Ler os `.md` em `cases/` e validar frontmatter.
3. Enviar o bloco `## Input` para o agente correspondente.
4. Avaliar contra `## Ground truth` via schema/assertions determinísticas e, quando indicado, LLM-as-judge.

Estes seeds são deliberadamente independentes do grafo LangGraph: servem como contrato de qualidade para promoção SHADOW -> ASSISTED conforme C4/C6.
