# ADR-010 — OpenAI gpt-4.1-mini como fallback de provider (pós-DPA)

**Status:** aceito  
**Data:** 2026-05-25  
**Autores:** Rafael Novaes (CEO/decisor)

---

## Contexto

A migração para Google Vertex AI (`southamerica-east1`) em mai/2026 (ADR-009, PRs #51–55) eliminou todos os providers não-LGPD. Com isso, o `FALLBACK_ROUTES` em `src/llm/router.ts` passou a apontar também para modelos Google — tornando o fallback inútil em falhas de infraestrutura do provider (ex: 503 de sobrecarga).

O Google Vertex AI tem apresentado picos intermitentes de indisponibilidade (503 `UNAVAILABLE`) que causam falhas nos evals e potencialmente em produção. Retry com backoff exponencial (implementado em `src/llm/adapters/google.ts`) mitiga erros transitórios, mas não cobre indisponibilidades prolongadas.

## Decisão

Usar **OpenAI `gpt-4.1-mini`** como fallback universal para todos os tasks do router, ativado após esgotamento dos retries no Google Vertex AI.

**Proteção LGPD:** DPA (Data Processing Agreement) com OpenAI assinado em 2026-05-25. O adapter já passa `store: false` em todas as chamadas, garantindo que inputs/outputs não são retidos para treino de modelos. Dados trafegam para servidores OpenAI (EUA) apenas em situação de fallback — não no caminho primário.

## Alternativas descartadas

| Alternativa | Motivo da rejeição |
|---|---|
| Segundo modelo Google como fallback | Inútil — falhas de infraestrutura Google afetam todos os modelos simultaneamente |
| Groq como fallback | Não oferece DPA equivalente; modelos open-source com menor qualidade para narrativas |
| Manter só retry no Google | Não cobre indisponibilidades prolongadas (>30s) |

## Mapeamento de modelos

| Task (primário Google) | Modelo primário | Fallback OpenAI |
|---|---|---|
| `classification`, `classification-judge` | `gemini-2.5-flash-lite` | `gpt-4.1-mini` |
| `dre-narrative`, `narrative-synthesis` | `gemini-2.5-flash` | `gpt-4.1-mini` |
| `action-plan`, `action-planning` | `gemini-2.5-flash` (thinking 2048) | `gpt-4.1-mini` (sem thinking) |
| `eval-judge` | `gemini-2.5-flash` | `gpt-4.1-mini` |
| demais tasks agentic | `gemini-2.5-flash-lite` | `gpt-4.1-mini` |

**Nota:** `thinkingBudget` não é suportado pela API OpenAI — o fallback de `action-plan` opera sem raciocínio estendido. Qualidade pode ser inferior; aceitável para evento de fallback.

## Impacto em custo (C3)

Fallback é raro (acionado apenas após 3 retries falharem). Impacto esperado < 0,1% do volume total de tokens.

| Modelo | Input (USD/M tok) | Output (USD/M tok) |
|---|---|---|
| `gemini-2.5-flash-lite` (primário) | $0,10 | $0,40 |
| `gpt-4.1-mini` (fallback) | $0,40 | $1,60 |

Custo do fallback é ~4× maior por token, mas dado o volume esperado de acionamento, não compromete C3 (custo ≤ 25% do preço).

## Consequências

- **Positivas:** Resiliência real a falhas de infraestrutura Google; fallback com provider diferente
- **Negativas:** Dados trafegam para EUA em situação de fallback (mitigado pelo DPA)
- **Requer:** `OPENAI_API_KEY` configurada no Railway (já existia de antes da migração LGPD)
- **Requer:** Monitorar no Langfuse o volume de calls com `provider=openai` para detectar degradação prolongada do Google

## Referências

- ADR-009 — Migração para Vertex AI (LGPD)
- ADR-005 — OpenAI como provider de classification (histórico)
- `src/llm/router.ts` — FALLBACK_ROUTES
- `src/llm/adapters/google.ts` — retry com backoff exponencial
