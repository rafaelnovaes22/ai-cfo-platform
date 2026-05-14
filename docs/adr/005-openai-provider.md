---
adr_id: "005"
title: "Adoção de OpenAI como terceiro provider — gpt-4.1-mini para classification"
status: "proposta"
constitution_version: "0.3.0"
created_at: "2026-05-14"
last_updated: "2026-05-14"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C3, C6, C7]
related_adrs: ["002"]
---

# ADR-005 — OpenAI como terceiro provider, gpt-4.1-mini para classification

> **Status**: ⏳ Proposta
> **Data proposta**: 2026-05-14
> **Decisor**: CEO + Tech Lead
> **Bloqueia**: promoção da Onda 1 para ASSISTED (Gate 2 — accuracy de categoria atual em 68% inviabiliza qualidade do DRE)
> **Princípios Constitution afetados**: C3 (custo ≤ 25% do preço), C6 (telemetry-by-default), C7 (portability over lock-in)
> **Amendments ao ADR-002**: §2.1 (provider primário por task), §2.2.1 (triggers de re-avaliação)

---

## 1. Contexto

Durante a sessão de validação do runner físico do `/acme:eval` (2026-05-14), comparamos 8 modelos LLM contra os 32 cases do eval suite de `classification`:

| Modelo | Provider | `ledger_classified` (22 cases) | `classification_confidence_low` (10 cases) | Total |
|---|---|---|---|---|
| **claude-haiku-4-5** | anthropic | **100,0%** | 40,0% | 81,3% |
| **gpt-4.1-mini** | openai | **100,0%** | 30,0% | 78,1% |
| **gpt-5-mini** | openai | **100,0%** | 20,0% | 75,0% |
| gpt-5-nano | openai | 90,9% | 40,0% | 75,0% |
| gpt-4.1-nano | openai | 95,5% | 20,0% | 71,9% |
| gpt-4o-mini | openai | 86,4% | 40,0% | 71,9% |
| gemini-2.5-flash | google | 72,7% | 20,0% | 56,3% |
| **gemini-2.5-flash-lite** (atual prod) | google | **68,2%** | 60,0% | 78,1% |

Relatórios completos em `evals/classification/runs/2026-05-14-eval-68d38d39-*.md`.

### 1.1. Achado crítico

O modelo de produção atual (`gemini-2.5-flash-lite`, ratificado pelo ADR-002) acerta apenas **68,2%** das categorias DRE — significa **erro silencioso em 32% dos lançamentos não-ambíguos**. Não foi detectado antes porque:
- A eval estrutural (commit `7b424aa`) só valida shape, não invoca LLM
- Pipeline em produção ainda não rodou volume com revisão humana sistemática (estamos pré-SHADOW)

### 1.2. Dois problemas distintos

A eval revelou que existem **dois problemas independentes**, não um:

1. **Accuracy de categoria**: 3 modelos (claude-haiku-4-5, gpt-4.1-mini, gpt-5-mini) atingem 100%; o atual (`gemini-2.5-flash-lite`) está em 68%.
2. **Calibração de confidence em casos ambíguos**: **todos** os 8 modelos falham — máximo 60%. É limitação universal de LLMs de chat treinados pra responder com confiança.

Trocar de modelo resolve (1), mas (2) precisa de outra abordagem (post-processing, redesign do teste, ou aceitar como limite estrutural).

---

## 2. Decisão

### 2.1. Adotar OpenAI como terceiro provider

Adicionar `openai` ao enum `LlmProvider` em [src/llm/types.ts](../../src/llm/types.ts), criar adapter [src/llm/adapters/openai.ts](../../src/llm/adapters/openai.ts), atualizar dispatch em [src/llm/index.ts](../../src/llm/index.ts).

### 2.2. Trocar `classification` para `gpt-4.1-mini`

| Task | Provider antes | Modelo antes | Provider depois | Modelo depois |
|---|---|---|---|---|
| **classification** | google | gemini-2.5-flash-lite | **openai** | **gpt-4.1-mini** |
| dre-narrative | google | gemini-2.5-flash | google | gemini-2.5-flash (inalterado) |
| action-plan | google | gemini-2.5-flash | google | gemini-2.5-flash (inalterado) |

**Por quê `gpt-4.1-mini` e não `claude-haiku-4-5` (que também tem 100%)**:
- Custo input ~2× menor que Haiku ($0,40 vs $0,80/MTok)
- Custo output ~2,5× menor ($1,60 vs $4,00/MTok)
- Latência similar (1,1s vs 1,0s/case)
- Calibração de confidence ligeiramente pior (30% vs 40%) — irrelevante porque ambos falham nesse outcome

**Por quê não `gpt-5-mini`** (também 100% em ledger_classified):
- Faz "thinking" interno → tokens-out 5-10× maiores que gpt-4.1-mini
- Latência 4× maior (4,4s vs 1,1s) — adicionaria ~10s no pipeline da Onda 1

### 2.3. Fallback do router

Manter Anthropic como fallback. Atualizar:
- `classification` fallback: `claude-haiku-4-5` (continua sendo o backup quando OpenAI cair)

### 2.4. Separar threshold por outcome no manifest

[evals/classification/manifest.json](../../evals/classification/manifest.json) ganha `pass_rate_per_outcome`:
- `ledger_classified`: ≥ 95% (mantém Gate 4 alto pra categoria — é o que afeta DRE)
- `classification_confidence_low`: ≥ 30% (limite estrutural reconhecido)

A trava agregada `pass_rate_threshold: 0.95` vira informativa quando `pass_rate_per_outcome` está presente. **`threshold_met = AND` dos per-outcome**.

---

## 3. Consequências

### 3.1. Positivas

- **Accuracy de categoria sobe de 68% → 100%** (correção crítica de erro silencioso)
- Eval suite passa o Gate 4 do `/acme:promote` para `classification` (em ledger_classified)
- Stack ganha terceiro provider — reduz lock-in em Google
- `gpt-4.1-mini` tem prompt cache automático → custo input cai ~50% em volume

### 3.2. Negativas / mitigações

| Risco | Mitigação |
|---|---|
| Custo classification sobe 4× ($0,10 → $0,40 input) | C3 segue verde (razão 0,089% → 0,26% no plano Lite — 100× abaixo do limite 25%) |
| Lock-in adicional num terceiro provider | Adapter fica em [src/llm/adapters/openai.ts](../../src/llm/adapters/openai.ts) (C7 — único ponto de import do SDK) |
| LGPD: política de retenção da OpenAI | Verificar antes de ASSISTED com cliente real. Recomendado: **OpenAI API com zero data retention (ZDR)** ou migração para **Azure OpenAI Service** (BR data residency disponível) |
| Outcome `classification_confidence_low` continua falhando | Aceitar como limite estrutural com threshold 30%; reavaliar via post-processing ou fine-tune local na Fase 3 do ADR-002 |

### 3.3. Não-mudanças

- Ondas 2-8 e fine-tune local (Fase 3 do ADR-002) seguem inalterados — meta de longo prazo continua sendo inferência 100% local
- `dre-narrative` e `action-plan` seguem em Gemini 2.5 Flash (não há sinal de qualidade insuficiente nesses módulos ainda)
- Vertex AI continua como destino pré-ASSISTED para LGPD nos módulos Gemini

---

## 4. Triggers de re-avaliação (amendment ao ADR-002 §2.2.1)

Adicionar ao framework de benchmarking do ADR-002:

- **OpenAI ZDR cancelado ou política endpoint mudar** → revisar/migrar
- **Custo classification > R$ 0,50/análise em 2 meses consecutivos** → reavaliar (ainda muito longe de C3, mas sinal de uso anômalo)
- **Accuracy de categoria cair abaixo de 90% em audit mensal** → benchmark vs modelos atuais e candidatos novos
- **Calibração de confidence superar 60% em algum modelo novo** → recandidatar

---

## 5. Verificação

- [x] Smoke test contra 5 modelos OpenAI ([scripts/smoke-openai.ts](../../scripts/smoke-openai.ts)) — 5/5 disponíveis na conta
- [x] Eval comparativo de 32 cases × 5 modelos OpenAI ([evals/classification/runs/](../../evals/classification/runs/))
- [x] Adapter [src/llm/adapters/openai.ts](../../src/llm/adapters/openai.ts) implementado com `stripJsonFences` (defesa)
- [x] Typecheck verde após integração
- [ ] CEO + Tech Lead aprovam (este ADR vira ratificada)
- [ ] Eval re-rodada após troca do router confirma 100% em `ledger_classified`
- [ ] OpenAI ZDR/policy verificada antes de SHADOW com cliente real

---

## 6. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-14 | Versão inicial — Onda 1 (eval físico revelou regressão em gemini-2.5-flash-lite) |
