---
name: shadow-mode-runner
description: Coordena modo SHADOW (C4) — agente roda em paralelo com humano, output do agente NUNCA é entregue/cobrado, mede-se concordância humano/agente, gera relatório de promoção. Skill Tier 3 — implementa C4 (mínimo 14 dias, sem exceção), C6 (todo run com trace), e bloqueia promoção SHADOW → ASSISTED se thresholds pré-contratados não atingidos. Output do agente fica isolado em runs/{client}/shadow/.
tier: 3
vocabulary_aliases: [L2, Operational, Micro]
linked_principles: [C4, C6]
helper_pattern: none
cache_strategy: none
reads_from_tier: [1, 2, 3]
must_not_read: []
requires_helper:
  - skill: offerings-loader
    field: offerings
    optional: false
version: 0.1.0
activation:
  paths:
    - runs/*/shadow/*.json
    - runs/*/shadow/report-*.md
    - docs/specs/**/*.md
  keywords: [SHADOW mode, shadow run, concordância, agreement rate, promotion to ASSISTED, C4]
  explicit_invocation: "@shadow-mode-runner"
parameters_required:
  - artifact_id
  - subscription_id
  - prompt_path
  - eval_suite_path
parameters_optional:
  - shadow_window_days
  - agreement_threshold
  - latency_p95_threshold_ms
  - cost_per_outcome_threshold
---

# shadow-mode-runner — Skill Tier 3 (Operacional)

## Propósito

Executa um agente em **modo SHADOW** — em paralelo ao processo humano vigente, **sem entregar/cobrar output**, instrumentando todo run e medindo **concordância humano/agente**. SHADOW é o gate **mandatório** de C4 antes de qualquer promoção a ASSISTED ou AUTONOMOUS.

A skill enforça as regras estruturais de C4:

- Mínimo **14 dias** de SHADOW, mesmo que cliente queira pular
- Output do agente **isolado** em `runs/{client_id}/shadow/`, com flag `delivered: false` e `billing: 0` em todo trace
- Promoção SHADOW → ASSISTED só com aprovação humana **explícita** + `agreement_rate ≥ threshold` + eval suite passing + N execuções mínimas

Esta skill **não** decide promoção sozinha. Produz relatório; humano (PO Guardian / Promotion Officer) assina.

## Quando ativa

1. **Path-scoped** — turno toca arquivo em `runs/{client}/shadow/` ou spec referenciando modo SHADOW
2. **Keyword-scoped** — termo de `activation.keywords`
3. **Explícita** — `@shadow-mode-runner artifact_id=triagem-tickets-v1 subscription_id=novais-digital-001 prompt_path=prompts/.../v1.0.0/system.md eval_suite_path=evals/triagem-tickets-v1/`
4. **Slash command** — invocada por `/novais-digital:shadow-start` ou `/novais-digital:promote` (Foundry-2)

## Inputs Tier 1 (helpers)

| Helper | Por que precisa |
|---|---|
| `@offerings-loader` | Confirma `artifact_id` no catálogo + lê `lifecycle_stage` (artifact em GA não pode entrar em SHADOW retroativo, exceto pós-incidente) |

## Inputs Tier 2

| Artefato | Como usa |
|---|---|
| `docs/specs/{artifact_id}.md` | `c4_thresholds`: `agreement_rate_min`, `latency_p95_ms`, `cost_per_outcome_max`, `min_run_count`, `min_window_days` (default 14) |
| `docs/clients/{client_id}/baseline-cost-*.md` | Custo humano/outcome (referência para C3 derivado) |

## Inputs Tier 3

| Artefato | Como usa |
|---|---|
| `prompts/{artifact_id}/v{version}/system.md` | Prompt sob teste — congelado durante a janela SHADOW |
| `evals/{artifact_id}/cases/` | Suite passing antes de iniciar SHADOW (precondição) |
| `runs/{client_id}/{run_id}.json` | Cada execução paralela; trace humano + trace agente (sombra) |
| `traces/{trace_id}` | Detalhe técnico — input, output, custo, latência |

## Inputs Tier 3 (parâmetros)

Obrigatórios:

```yaml
artifact_id: <slug>
subscription_id: <slug, ex: novais-digital-001>
prompt_path: prompts/.../v.../system.md
eval_suite_path: evals/{artifact_id}/
```

Opcionais (com defaults conservadores):

```yaml
shadow_window_days: 14            # default e mínimo C4
agreement_threshold: 0.85         # default; spec pode override para mais alto
latency_p95_threshold_ms: 8000
cost_per_outcome_threshold: <derivado de baseline × C3>
min_run_count: 100                # default; pode subir conforme volume do cliente
```

## Modos de operação

A skill coordena **3 ações distintas**, declaradas via subcomando:

| Ação | O que faz |
|---|---|
| `start` | Verifica precondições, cria registro `shadow_session`, libera ingestão de runs paralelos |
| `tick` | Lê novos runs do dia, calcula métricas incrementais, atualiza `shadow-status.md` |
| `report` | Ao fim da janela: produz `shadow-report.md` + recomendação de promoção |

Default ao invocar sem subcomando: detecta estado da `shadow_session` e roda a ação apropriada.

## Precondições para `start` (todas mandatórias)

1. `artifact_id` existe no catálogo com `lifecycle_stage` ∈ {mvp, beta} ou flag `re-shadow_post_incident: true`
2. `prompt_path` existe e tem `prompt_hash` registrado
3. Eval suite atende `c4_threshold` em todas categorias (≥ 30 casos cada, suite passing)
4. `unit-economics-{artifact}.md` existe e `c3_check.status` ∈ {viable, tight}
5. `subscription.mode` atual é `none` ou anterior `SHADOW` expirado (não pode iniciar SHADOW em ASSISTED/AUTONOMOUS)
6. Aprovação registrada em `docs/clients/{client}/promotions.md` ou equivalente

Se qualquer precondição falhar → erro estruturado, **não inicia** SHADOW.

## Métricas instrumentadas em cada `tick`

```yaml
shadow_status:
  artifact_id: triagem-tickets-tier1-v1
  subscription_id: novais-digital-001
  prompt_hash: a3f9...c2e1
  started_at: 2026-04-15
  current_day: 9
  window_days: 14
  runs_total: 312
  runs_with_pair: 287       # cases onde temos output humano + output agente
  agreement:
    overall: 0.89
    by_category:
      billing: 0.92
      refund: 0.81
      escalation: 0.95
  disagreement_samples_for_review: [run_id_1, run_id_2, ...]   # top-N para humano analisar
  latency_p50_ms: 3200
  latency_p95_ms: 6900
  cost:
    avg_per_outcome: 0.18
    p95_per_outcome: 0.34
    c3_status: viable
  drift_signals:
    prompt_changed: false
    spec_changed: false
    distribution_shift_score: 0.07   # estatístico simples; vermelho se > 0.3
```

## Relatório final (`report`)

Persiste em `runs/{client_id}/shadow/report-{artifact_id}-{YYYY-MM-DD}.md`:

```markdown
---
artifact_id: <>
subscription_id: <>
shadow_window: { start, end, days }
prompt_hash: <>
recommendation: promote_to_assisted | hold_in_shadow | rollback
recommended_by: shadow-mode-runner@0.1.0
requires_human_approval: [po-guardian, promotion-officer]
---

## Sumário executivo
{2-3 linhas}

## Métricas finais vs thresholds
| métrica | observado | threshold | status |
|---|---|---|---|
| agreement_rate (geral) | 0.89 | ≥ 0.85 | PASS |
| ... | ... | ... | ... |

## Disagreements relevantes (top 10)
{tabela com run_id, categoria, output humano, output agente, análise breve}

## Custo e latência
{...}

## Drift detectado durante janela
{...}

## Recomendação
{...}

## Aprovações requeridas
- [ ] po-guardian
- [ ] promotion-officer
```

## O que entrega (return value)

```yaml
shadow_action: start | tick | report
artifact_id: <>
subscription_id: <>
status: ok | preconditions_failed | window_active | window_complete | error
metrics_snapshot: { ... }   # presente em tick e report
artifacts_written:
  - runs/{client}/shadow/shadow-status.md
  - runs/{client}/shadow/report-{artifact}-{date}.md   # só em report
recommendation: promote_to_assisted | hold_in_shadow | rollback   # só em report
preconditions_checked: { ... }   # só em start
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Cliente quer pular SHADOW, são clientes premium" | C4 sem exceção — mesmo cliente disposto precisa ≥14 dias. Bypass = receita garantida de churn pós-incidente | Bloquear `start` com erro `c4_window_below_minimum`; documentar pedido em `docs/foundry/bypass-log/` se Foundry-4 ativo |
| "Output do agente está bom, posso entregar paralelamente em casos óbvios" | Quebra a definição de SHADOW — qualquer entrega = ASSISTED, sem proteção C4 | `delivered: false` e `billing: 0` enforced em todo trace; lint detecta entrega lateral |
| "Agreement 0.85 é arbitrário, 0.75 já é bom" | Threshold é pré-contratado em spec; afrouxar = mover trave depois do gol | Threshold lido de spec; ajuste exige nova ADR + bump de spec |
| "14 dias passou, promove automaticamente" | C4 exige aprovação humana **explícita** (PO Guardian + Promotion Officer) | Skill produz **recomendação**; promoção é ação humana com assinatura |
| "Disagreement é sempre erro do agente" | Em ~10% dos casos é humano errado/inconsistente; ignorar isso enviesa avaliação | Top-N disagreements vão para review humano antes do report final |
| "Trace para amostra é suficiente, sample 10%" | Quebra C6 — todo run de produção deve ter trace | 100% dos runs em SHADOW com trace; amostragem só em AUTONOMOUS pós-Foundry-4 |
| "Drift de prompt durante SHADOW é pequeno, mantém" | Mudança no `prompt_hash` invalida métricas acumuladas; janela precisa reiniciar | Detectar `prompt_changed: true` → erro `prompt_drift_during_window`; reiniciar com nova janela |
| "Custo deu acima do threshold, mas qualidade tá boa" | C3 é hard gate; custo > 25% é go-no-go independente de qualidade | `c3_status: unviable` → `recommendation: rollback` ou `hold` para otimizar custo |

## Verification gate

### Em `start`:

- [x] Todas as 6 precondições passaram
- [x] `shadow-status.md` criado com `started_at`, `prompt_hash`, `window_days`
- [x] Subscription registrada como `mode: shadow`
- [x] Logs Langfuse/equivalente confirmam ingestão de runs com `delivered: false`

### Em `tick`:

- [x] Pelo menos 1 run novo processado desde último tick
- [x] Métricas atualizadas em `shadow-status.md`
- [x] `disagreement_samples_for_review` populados (top-N por categoria)
- [x] Drift signals calculados

### Em `report`:

- [x] `current_day >= window_days` (ou `current_day < window_days` mas precondição falhou)
- [x] `runs_total >= min_run_count` ou justificativa explícita
- [x] Comparação observado vs threshold em todas as métricas
- [x] Recomendação ∈ {promote_to_assisted, hold_in_shadow, rollback}
- [x] Disagreements de top-10 documentados com análise breve
- [x] Aprovações requeridas listadas (não auto-promove)
- [x] Arquivo `report-*.md` persistido

Se qualquer gate falhar → erro estruturado.

## C4 — regras hard implementadas

A skill enforça mecanicamente:

```
ASSERT shadow_window_days >= 14
ASSERT subscription.mode == "shadow" durante toda a janela
ASSERT every trace.delivered == false
ASSERT every trace.billing_amount == 0
ASSERT prompt_hash imutável durante a janela
ASSERT promotion_to_assisted.approver != shadow-mode-runner@*
```

Violação de qualquer uma dessas → `audit_critical` no relatório do reviewer DeepAgent.

## Saída de erro estruturada

```yaml
shadow_action: <>
status: error
error: <enum>
hint: <ação>
```

`error` ∈ `preconditions_failed` | `prompt_path_missing` | `eval_suite_below_c4_threshold` | `subscription_already_in_higher_mode` | `c4_window_below_minimum` | `prompt_drift_during_window` | `min_run_count_not_reached` | `c3_status_unviable_during_window` | `runs_dir_unwritable` | `human_approval_attempted_by_skill` (skill tentou auto-promover — bloqueio).

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@offerings-loader` | upstream (helper) | `__foundry_cache.offerings` |
| `@artifact-prompt-builder` | upstream (Tier 3) | Lê o prompt sob teste; `prompt_hash` é o âncora de imutabilidade |
| `@eval-case-author` | upstream (Tier 3) | Garante eval suite acima do threshold antes de `start` |
| `@po-guardian`, `@promotion-officer` (Guardians, Foundry-3) | downstream/reviewer | Recebem recomendação; assinam promoção |
| `@observability-guardian` (Foundry-3) | reviewer | Audita 100% dos runs com trace |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-1 onda 3 (Tier 3) |
