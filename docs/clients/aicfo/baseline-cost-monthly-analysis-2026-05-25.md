---
artifact_id: "monthly-analysis"
client_id: "aicfo"
document_type: "baseline-cost"
linked_principle: "C3"
linked_spec: "docs/specs/monthly-analysis.md"
linked_unit_economics_source: "docs/onda-0/unit_economics.md"
linked_adrs: ["002-llm-model-strategy", "005-openai-provider", "010-google-vertex-fallback"]
forge_command_version: "unit-economics@0.1.0"
created_at: "2026-05-25"
recalc_at: "2026-05-25"
last_recalculated_reason: "consolidação de premissas pós-migração LGPD (ADR-010) + criação do arquivo canônico Forge"
recalc_unit_economics_required: false
prompt_hash_at_recalc: "spec_v0.2.0 + dre_narrative_4437e0e3 + classification_8129c888 + action_plan_dbdd1a9c"
approved_by: "CEO Acme"
approved_at: "2026-05-25"
c3_check:
  status: "viable"
  cost_per_outcome_cents: 9
  cost_per_outcome_brl: 0.088
  price_per_outcome_cents: 9900
  price_per_outcome_brl: 99.00
  ratio_pct: 0.089
  threshold_pct: 25.0
  margin_to_threshold: "280×"
  evaluated_outcome: "analysis_delivered"
  evaluated_plan: "Aicfo Lite"
  evaluated_at: "2026-05-25"
  blended_with_fallback:
    primary_share: 0.95
    primary_cost_brl: 0.088
    fallback_share: 0.05
    fallback_cost_brl: 0.222
    blended_cost_brl: 0.0947
    blended_ratio_pct: 0.0956
human_cost_per_unit_cents: 30000
human_cost_per_unit_brl: 300.00
human_cost_per_unit_source: "Contador externo médio: R$ 250-400 por DRE gerencial mensal de PME — usado em sla_threshold como baseline humano"
---

# Baseline Cost — `monthly-analysis` (Aicfo)

> Arquivo canônico Forge derivado de `docs/onda-0/unit_economics.md` (D5 — múltiplos recálculos). Função: alimentar `/acme:promote` Gate 2 (C3) com `c3_check.status` e `cost_per_outcome`. **Fonte de verdade do cálculo continua em [`docs/onda-0/unit_economics.md`](../../onda-0/unit_economics.md)**; este arquivo consolida o estado vigente em formato Forge-compatible.

---

## 1. Estado atual dos modelos (pós-migração LGPD ADR-010)

| Etapa | Modelo primário (LGPD: Google Vertex AI) | Modelo fallback (ADR-010) | Custo por análise (primário) |
|---|---|---|---|
| `ingest` | parser determinístico | — | R$ 0 |
| `classification` (8 batches × 20 lançamentos) | Gemini 2.5 Flash-Lite (Vertex BR) | OpenAI GPT-4.1-mini (US) | R$ 0,036 |
| `dre-narrative.aggregator` | regra determinística | — | R$ 0 |
| `dre-narrative.narrator` (1 call) | Gemini 2.5 Flash (Vertex BR) | GPT-4.1-mini | R$ 0,014 |
| `action-plan.generator` (1 call) | Gemini 2.5 Flash (Vertex BR) | GPT-4.1-mini | R$ 0,020 |
| `financial-qa-review` (determinístico → LLM se passa) | Gemini 2.5 Flash (Vertex BR) | GPT-4.1-mini | R$ 0,003 (≤30% das análises chega no LLM) |
| Overhead retry/QA gate (+25%) | — | — | R$ 0,018 |
| **Total p50 por análise** | — | — | **R$ 0,088** |

Premissas: cliente mediano com 142 lançamentos, taxa de fallback histórica <5% (após retry backoff do PR #58), câmbio USD 1 = BRL 5,00.

---

## 2. Razão custo/preço (C3 check)

```yaml
c3_check:
  status: viable                # ∈ {viable, tight, unviable}
  cost_per_outcome_brl: 0.088
  price_per_outcome_brl: 99.00  # plano Lite, 1 análise/mês
  ratio_pct: 0.089
  threshold_pct: 25.0           # constante constitucional C3
  margin_to_threshold: "280×"   # ratio_pct é 280× MENOR que threshold — folga estrutural
```

**Status `viable`** porque a razão (0,089%) está **280× abaixo** do threshold (25%). Mesmo com fallback completo para OpenAI gpt-4.1-mini, a razão sobe para ~0,22% — ainda 113× abaixo do threshold.

### 2.1. Razão por plano

| Plano | Custo p50/mês | ARPU | Razão | Status C3 |
|---|---|---|---|---|
| **Lite** (1 análise) | R$ 0,088 | R$ 99 | **0,089%** | ✅ viable |
| Pro (3 análises) | R$ 0,264 | R$ 249 | **0,11%** | ✅ viable |
| Business (10 análises) | R$ 0,880 | R$ 599 | **0,15%** | ✅ viable |

### 2.2. Blended cost (com taxa real de fallback)

Tomando a taxa de fallback observada (~5% das chamadas roteiam para OpenAI por LGPD-fallback ADR-010):

```yaml
blended:
  primary_share: 0.95
  primary_cost_brl: 0.088
  fallback_share: 0.05
  fallback_cost_brl: 0.222
  blended_cost_brl: 0.0947
  blended_ratio_pct: 0.0956    # ainda < 0.1% — folga ~260×
```

---

## 3. Baseline humano (comparação obrigatória para C4 Gate 3)

```yaml
human_cost_per_unit_brl: 300.00
source: "Contador externo médio cobra R$ 250-400 por DRE gerencial mensal de uma PME (5-150 funcionários, 100-300 lançamentos)"
ratio_human_vs_ai: "3,408×"
```

A IA custa **3.408× menos** que o substituto humano comparável. Isso satisfaz com folga gigante o requisito `c4_thresholds.cost_per_outcome_max <= human_cost_per_unit` do gate 3 de `/acme:promote`.

---

## 4. Sensibilidades

| Cenário | Razão estimada | Status |
|---|---|---|
| Fallback total OpenAI (Gemini fora do ar 1 mês inteiro) | ~0,22% | ✅ ainda viável |
| Eval automático em CI a cada PR (10 evals/PR × 20 PRs/mês) | ~0,5% | ✅ ainda viável |
| Migração para Gemini 2.5 Pro (action-plan ganhar reasoning premium) | ~0,8% | ✅ ainda viável |
| Plano Lite com 1.000 lançamentos importados (uso fora do limite contratado) | ~0,3% | ✅ ainda viável (e cobre cliente fora-do-plano) |
| Customização de prompt por tenant (proibido por C8, mas se quebrasse) | ~3-5% (escala linear no nº de variantes) | ⚠️ ainda viável mas anti-Forge |

**Razão estrutural**: a folga 280× existe porque o custo de inferência LLM caiu 95-99% entre 2023 (GPT-4) e 2026 (Gemini Flash). C3 deixou de ser binding constraint do produto Aicfo.

---

## 5. Triggers de recálculo (per ADR-002 §2.2.1 + Forge `unit-economics-recalc` hook)

Este `c3_check.status` será recalculado automaticamente quando:

- [ ] Cost-per-outcome real medido (Langfuse/LangSmith trace) > 1.3× projetado em 2 meses consecutivos
- [ ] Provider mudar de Vertex AI para outro
- [ ] `prompt_hash` mudar em qualquer um dos módulos do pipeline (`/acme:eval` deve ter `prompt_hash_at_recalc` matching ou disparar gate failure)
- [ ] Wave 2+ habilitada com módulos novos no pipeline (decision-engine, scenarios — podem requerer Gemini Pro)

Hook automatizado: `hooks/post-prompt-edit/unit-economics-recalc.sh` (cobertura parcial — só dispara em mudanças em `prompts/`, não em `router.ts`).

---

## 6. Aprovação

- [x] Premissas conferidas contra runs de eval reais (`evals/dre-narrative/runs/2026-05-25-eval-7e8c6af9-none.md` para narrative, runs gemini-2-5-flash-lite para classification)
- [x] C3 verificado em todos os 3 planos: razão segue <0,2%
- [x] Comparação com substituto humano (contador externo) demonstrada (3.408× mais barato)
- [x] CEO ciente do estado atual via spec migrada (`docs/specs/monthly-analysis.md` v0.2.0)
- [ ] Validação empírica via SHADOW de 14 dias com 5-10 PMEs (pendente — bloqueio do gate 4 do /acme:promote, **não** do gate 2)

**Aprovado para Gate 2 do `/acme:promote start_shadow`**: ✅ `c3_check.status: viable`.

---

## 7. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-25 | Arquivo canônico criado consolidando 3 recálculos de `docs/onda-0/unit_economics.md` (2026-05-12 Gemini migration, 2026-05-14 v1 Flash-Lite, 2026-05-14 v2 gpt-4.1-mini, 2026-05-22+ Vertex AI LGPD migration, 2026-05-25 OpenAI fallback ADR-010) |
