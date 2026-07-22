---
module: dre-narrative
eval_method: llm_as_judge
prompt_hash: 4437e0e3
provider: router
model: dre-narrative-route
started_at: 2026-05-25T17:03:06.045Z
finished_at: 2026-05-25T17:12:32.672Z
total_cases: 16
attempted_cases: 16
passed: 15
failed: 1
pass_rate: 93.8%
pass_rate_threshold: 90.0%
threshold_met: true
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 566618
---

# Eval Run — dre-narrative — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 93.8% vs threshold 90.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | router / `dre-narrative-route` |
| Prompt hash | `4437e0e3` |
| Cases tentados | 16 / 16 |
| Passaram | 15 |
| Falharam | 1 |
| Custo total | R$ 0.3200 |
| Latência total | 566.6s |
| Latência média | 35414ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| dre_narrated | 15 | 16 | 93.8% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 6 | 7 | 85.7% |
| edge | 2 | 2 | 100.0% |
| synthetic | 3 | 3 | 100.0% |
| adversarial | 4 | 4 | 100.0% |

## Falhas (1)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| dre-narrative-0019 | dre_narrated | real | {"clareza":5,"acionabilidade":3,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | acionabilidade=3<4: O card 'healthy' utiliza o verbo 'Aumente', que não está na lista de verbos perm [violations: Violação de acionabilidade: O verbo 'Aumente' no card de tipo 'healthy' não está] |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| dre-narrative-0017 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 31360 | 2 |
| dre-narrative-0018 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 29984 | 2 |
| dre-narrative-0019 | dre_narrated | real | ❌ | {"clareza":5,"acionabilidade":3,"factualidade":5} | — | 43386 | 2 |
| dre-narrative-0020 | dre_narrated | edge | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 31620 | 2 |
| dre-narrative-0021 | dre_narrated | edge | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 28586 | 2 |
| dre-narrative-0022 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 40703 | 2 |
| dre-narrative-0023 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 39854 | 2 |
| dre-narrative-0024 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 23238 | 2 |
| dre-narrative-0025 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 34518 | 2 |
| dre-narrative-0026 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 45460 | 2 |
| dre-narrative-0027 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 48543 | 2 |
| dre-narrative-0028 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 32168 | 2 |
| dre-narrative-0029 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 31480 | 2 |
| dre-narrative-0030 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 28920 | 2 |
| dre-narrative-0031 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 33668 | 2 |
| dre-narrative-0032 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 43130 | 2 |

</details>
