---
module: monthly-analysis/action-planning
eval_method: assertion_shape
prompt_hash: f4f3d6ba
provider: none
model: none
started_at: 2026-06-03T18:08:30.387Z
finished_at: 2026-06-03T18:12:17.204Z
total_cases: 15
attempted_cases: 15
passed: 15
failed: 0
pass_rate: 100.0%
pass_rate_threshold: 85.0%
threshold_met: true
total_cost_cents: 0
total_cost_brl: 0.0000
total_latency_ms: 226813
---

# Eval Run — monthly-analysis/action-planning — 2026-06-03

**Veredito**: ✅ APROVADO — pass rate 100.0% vs threshold 85.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | none / `none` |
| Prompt hash | `f4f3d6ba` |
| Cases tentados | 15 / 15 |
| Passaram | 15 |
| Falharam | 0 |
| Custo total | R$ 0.0000 |
| Latência total | 226.8s |
| Latência média | 15121ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| plan_by_horizon | 1 | 1 | 100.0% |
| cash_recovery_plan | 2 | 2 | 100.0% |
| margin_plan | 1 | 1 | 100.0% |
| qa_sensitive_plan | 1 | 1 | 100.0% |
| risk_mitigation_plan | 2 | 2 | 100.0% |
| seasonality_plan | 1 | 1 | 100.0% |
| data_quality_plan | 1 | 1 | 100.0% |
| opex_plan | 1 | 1 | 100.0% |
| loss_recovery_plan | 1 | 1 | 100.0% |
| tax_review_plan | 1 | 1 | 100.0% |
| operating_cadence_plan | 1 | 1 | 100.0% |
| needs_review_plan | 1 | 1 | 100.0% |
| trend_plan | 1 | 1 | 100.0% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 4 | 4 | 100.0% |
| synthetic | 6 | 6 | 100.0% |
| adversarial | 3 | 3 | 100.0% |
| edge | 2 | 2 | 100.0% |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| action-planning-0001 | plan_by_horizon | real | ✅ | 5 ações: short=3 medium=1 long=1 | — | 13976 | 0 |
| action-planning-0002 | cash_recovery_plan | real | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16495 | 0 |
| action-planning-0003 | margin_plan | synthetic | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16455 | 0 |
| action-planning-0004 | qa_sensitive_plan | adversarial | ✅ | 6 ações: short=3 medium=2 long=1 | — | 14552 | 0 |
| action-planning-0005 | risk_mitigation_plan | synthetic | ✅ | 6 ações: short=3 medium=2 long=1 | — | 14124 | 0 |
| action-planning-0006 | seasonality_plan | real | ✅ | 5 ações: short=3 medium=1 long=1 | — | 14329 | 0 |
| action-planning-0007 | data_quality_plan | edge | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16668 | 0 |
| action-planning-0008 | opex_plan | synthetic | ✅ | 5 ações: short=3 medium=1 long=1 | — | 12724 | 0 |
| action-planning-0009 | loss_recovery_plan | adversarial | ✅ | 5 ações: short=3 medium=1 long=1 | — | 15034 | 0 |
| action-planning-0010 | risk_mitigation_plan | synthetic | ✅ | 6 ações: short=3 medium=2 long=1 | — | 14908 | 0 |
| action-planning-0011 | tax_review_plan | real | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16290 | 0 |
| action-planning-0012 | cash_recovery_plan | edge | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16457 | 0 |
| action-planning-0013 | operating_cadence_plan | synthetic | ✅ | 6 ações: short=3 medium=2 long=1 | — | 14346 | 0 |
| action-planning-0014 | needs_review_plan | adversarial | ✅ | 6 ações: short=3 medium=2 long=1 | — | 16243 | 0 |
| action-planning-0015 | trend_plan | synthetic | ✅ | 5 ações: short=3 medium=1 long=1 | — | 14212 | 0 |

</details>
