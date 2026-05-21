---
adr: 009
title: Migração Google AI Studio → Vertex AI Brasil (southamerica-east1)
status: accepted
date: 2026-05-20
deciders: Rafael Novaes (CEO Acme)
linked_principles: [C3, C6, C7]
linked_artifacts:
  - src/llm/adapters/google.ts
  - .env.example
  - package.json
supersedes: null
superseded_by: null
related: [002, 005, 008]
---

# ADR-009 — Migração Google AI Studio → Vertex AI Brasil

## Contexto

Aicfo consome Gemini 2.5 Flash / Flash-Lite via **Google AI Studio** (`@google/generative-ai`, autenticação por `GOOGLE_API_KEY`) desde 2026-05-12 (ADR-002). Funciona, custo correto, qualidade OK.

**Problema bloqueador para primeiro cliente real**: AI Studio usa data center US (multi-region), sem garantia de residência de dados no Brasil. Política LGPD da Acme (linked_principle C6) exige que dados de clientes PME brasileiros não saiam do território nacional sem autorização explícita.

Vertex AI tem região `southamerica-east1` (São Paulo) com mesma família de modelos (Gemini 2.5 Flash + Flash-Lite) ao mesmo preço, suportada formalmente pelo SLA do Google Cloud.

## Decisão

Migrar o adapter `src/llm/adapters/google.ts` de `@google/generative-ai` para `@google-cloud/vertexai`, mantendo:

- **Mesmos modelos** (`gemini-2.5-flash`, `gemini-2.5-flash-lite`) — zero regressão de qualidade esperada
- **Mesmas tarefas no router** (`dre-narrative`, `action-plan`, `narrative-synthesis`, `action-planning`, `anomaly-detection`, `margin-diagnosis`)
- **Mesmo preço** ($0,15/$0,60 USD/MTok flash; $0,10/$0,40 flash-lite) — C3 não muda
- **Região fixa** em `southamerica-east1` via `GOOGLE_CLOUD_LOCATION` env

### Autenticação

Vertex AI usa Application Default Credentials (ADC), não API key. Duas formas suportadas no adapter:

1. **DEV/local** — `GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json` (caminho de arquivo, padrão Google)
2. **PROD/Railway** — `GOOGLE_APPLICATION_CREDENTIALS_JSON=<json inline>` (string com o conteúdo do JSON; o adapter parseia e injeta via `googleAuthOptions.credentials`)

A forma 2 tem precedência sobre a forma 1 quando ambas estão setadas.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter Google AI Studio + termos contratuais com cliente | Não escala para múltiplos clientes; risco jurídico residual mesmo com termo |
| Mudar provider (OpenAI Brazil região, Anthropic Brasil) | OpenAI não tem região BR; Anthropic não tem região BR; ambos exigiriam re-validar evals e quebraria ADR-002 |
| Self-host Gemini OSS | Não existe Gemini open weights; só Llama/Qwen são alternativas viáveis e ainda quebram qualidade (ADR-002 §2.2.4) |
| Vertex AI us-central1 com cláusula DPA | DPA sem data residency BR não satisfaz LGPD Art. 33 |

## Verificação

- [x] Adapter compila (`npx tsc --noEmit` clean)
- [x] Testes não regridem (`npm test` — 171/171 verdes em main; modificação é interna ao adapter, signatures inalteradas)
- [ ] **Smoke test real** (pós-credenciais): rodar `llm_as_judge` em `dre-narrative` contra Vertex AI Brasil e confirmar pass rate ≥ 50% (mesmo baseline AI Studio de 2026-05-19)
- [ ] **Custo medido**: confirmar via Langfuse trace que `cost_per_outcome` permanece ≤ R$ 0,25 por análise p50

## Pré-requisitos operacionais (dependem de Rafael)

1. GCP Project com billing habilitado
2. `gcloud services enable aiplatform.googleapis.com`
3. Service Account com role `roles/aiplatform.user` + JSON key download
4. Para Railway: SA key JSON como env var `GOOGLE_APPLICATION_CREDENTIALS_JSON` (string única)

Sem (1)–(4) o adapter falha na primeira chamada com erro claro — não há risco silencioso.

## Out of scope (futuro)

- **Workload Identity Federation** (substituir SA key por federation) — recomendado pelo Google a médio prazo mas exige setup mais complexo; não bloqueia
- **VPC Service Controls** ao redor do projeto Vertex — quando volume justificar
- **Multi-region failover** (southamerica-east1 → us-central1 em caso de outage) — adicionar quando SLO de disponibilidade for medido

## Custo

- **Inferência**: idêntico ao AI Studio ($0,15/$0,60 flash; $0,10/$0,40 flash-lite) — C3 inalterada (folga 56× preservada)
- **Cloud Logging/Monitoring**: Vertex AI emite logs automaticamente em Cloud Logging; ~R$ 0–5/mês no volume atual (free tier de 50GB)
- **Egress**: requests do Railway (US) → Vertex BR pagam egress; estimado R$ 5–10/mês no volume de SHADOW. Quando app migrar para GCP (ADR futura), zera.

## Rollback path

Reverter este PR e re-instalar `@google/generative-ai` no `package.json`. Tudo voltaria a apontar pra AI Studio US. Risco: nenhum cliente real depende disso ainda (SHADOW interno apenas).
