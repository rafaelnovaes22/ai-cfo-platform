---
module: action-plan
eval_method: llm_as_judge
prompt_hash: dbdd1a9c
provider: router
model: dre-narrative-route
started_at: 2026-05-25T19:05:52.291Z
finished_at: 2026-05-25T19:15:46.374Z
total_cases: 22
attempted_cases: 22
passed: 20
failed: 2
pass_rate: 90.9%
pass_rate_threshold: 85.0%
threshold_met: true
total_cost_cents: 44
total_cost_brl: 0.4400
total_latency_ms: 594077
---

# Eval Run — action-plan — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 90.9% vs threshold 85.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | router / `dre-narrative-route` |
| Prompt hash | `dbdd1a9c` |
| Cases tentados | 22 / 22 |
| Passaram | 20 |
| Falharam | 2 |
| Custo total | R$ 0.4400 |
| Latência total | 594.1s |
| Latência média | 27004ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| plan_generated | 20 | 22 | 90.9% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 8 | 10 | 80.0% |
| synthetic | 6 | 6 | 100.0% |
| edge | 3 | 3 | 100.0% |
| adversarial | 3 | 3 | 100.0% |

## Falhas (2)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| action-plan-0004 | plan_generated | real | {"acionabilidade":1,"impacto_plausivel":2,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: As ações propostas são todas financeiras e não abordam as ações específicas de v; impacto_plausivel=2<4: Os impactos financeiros para as ações de alongamento de vencimentos (R$20k/mês)  [violations: Regra violada: `judge_criteria.acionabilidade: "Ações específicas de varejo: liq | Regra violada: Plausibilidade do impacto (`impacto_plausivel`). Trecho do output] |
| action-plan-0008 | plan_generated | real | {"acionabilidade":5,"impacto_plausivel":2,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=2<4: O impacto financeiro das ações 'short' (R$6k, R$12k, R$8k) é significativamente  [violations: Violação da regra de impacto_plausivel: As ações de curto prazo ('Mapear divida ] |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| action-plan-0001 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 34297 | 2 |
| action-plan-0002 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 24346 | 2 |
| action-plan-0003 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 27407 | 2 |
| action-plan-0004 | plan_generated | real | ❌ | {"acionabilidade":1,"impacto_plausivel":2,"doneWhen_executavel":5} | — | 30306 | 2 |
| action-plan-0005 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 27952 | 2 |
| action-plan-0006 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23278 | 2 |
| action-plan-0007 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23912 | 2 |
| action-plan-0008 | plan_generated | real | ❌ | {"acionabilidade":5,"impacto_plausivel":2,"doneWhen_executavel":5} | — | 28991 | 2 |
| action-plan-0009 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 33943 | 2 |
| action-plan-0010 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23778 | 2 |
| action-plan-0011 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 21248 | 2 |
| action-plan-0012 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 26549 | 2 |
| action-plan-0013 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 22932 | 2 |
| action-plan-0014 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":4,"doneWhen_executavel":5} | — | 34128 | 2 |
| action-plan-0015 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23285 | 2 |
| action-plan-0016 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 21738 | 2 |
| action-plan-0017 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 36856 | 2 |
| action-plan-0018 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 29240 | 2 |
| action-plan-0019 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23776 | 2 |
| action-plan-0020 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 21313 | 2 |
| action-plan-0021 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 32344 | 2 |
| action-plan-0022 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 22458 | 2 |

</details>
