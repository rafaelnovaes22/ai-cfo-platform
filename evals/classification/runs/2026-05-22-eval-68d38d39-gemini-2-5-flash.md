---
module: classification
eval_method: exact_match_category
prompt_hash: 68d38d39
provider: google
model: gemini-2.5-flash
started_at: 2026-05-22T21:00:44.782Z
finished_at: 2026-05-22T21:01:36.267Z
total_cases: 32
attempted_cases: 32
passed: 17
failed: 15
pass_rate: 53.1%
pass_rate_threshold: 80.0%
threshold_met: false
total_cost_cents: 17
total_cost_brl: 0.1700
total_latency_ms: 51471
---

# Eval Run — classification — 2026-05-22

**Veredito**: ❌ REPROVADO — pass rate 53.1% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash` |
| Prompt hash | `68d38d39` |
| Cases tentados | 32 / 32 |
| Passaram | 17 |
| Falharam | 15 |
| Custo total | R$ 0.1700 |
| Latência total | 51.5s |
| Latência média | 1608ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 17 | 22 | 77.3% | 95.0% | ❌ |
| classification_confidence_low | 0 | 10 | 0.0% | 30.0% | ❌ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 15 | 20 | 75.0% |
| synthetic | 2 | 8 | 25.0% |
| edge | 0 | 2 | 0.0% |
| adversarial | 0 | 2 | 0.0% |

## Falhas (15)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0018 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0019 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0020 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0021 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0022 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0023 | classification_confidence_low | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0024 | classification_confidence_low | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0025 | classification_confidence_low | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0026 | classification_confidence_low | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0027 | classification_confidence_low | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0028 | classification_confidence_low | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0029 | classification_confidence_low | edge | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0030 | classification_confidence_low | edge | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0031 | classification_confidence_low | adversarial | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0032 | classification_confidence_low | adversarial | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.95 | 1577 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.98 | 2660 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.99 | 1492 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.99 | 1380 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.98 | 1339 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.95 | 1260 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.98 | 1558 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.98 | 1560 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 1444 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.98 | 1554 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.98 | 1344 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.98 | 1504 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.98 | 1435 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.98 | 1536 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 2529 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.95 | 2343 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 1674 | 1 |
| classification-0018 | ledger_classified | synthetic | ❌ | — | — | 728 | 0 |
| classification-0019 | ledger_classified | synthetic | ❌ | — | — | 856 | 0 |
| classification-0020 | ledger_classified | synthetic | ❌ | — | — | 1555 | 0 |
| classification-0021 | ledger_classified | synthetic | ❌ | — | — | 1387 | 0 |
| classification-0022 | ledger_classified | synthetic | ❌ | — | — | 778 | 0 |
| classification-0023 | classification_confidence_low | real | ❌ | — | — | 682 | 0 |
| classification-0024 | classification_confidence_low | real | ❌ | — | — | 905 | 0 |
| classification-0025 | classification_confidence_low | real | ❌ | — | — | 1228 | 0 |
| classification-0026 | classification_confidence_low | real | ❌ | — | — | 875 | 0 |
| classification-0027 | classification_confidence_low | real | ❌ | — | — | 948 | 0 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | — | — | 2044 | 0 |
| classification-0029 | classification_confidence_low | edge | ❌ | — | — | 6510 | 0 |
| classification-0030 | classification_confidence_low | edge | ❌ | — | — | 760 | 0 |
| classification-0031 | classification_confidence_low | adversarial | ❌ | — | — | 3066 | 0 |
| classification-0032 | classification_confidence_low | adversarial | ❌ | — | — | 960 | 0 |

</details>
