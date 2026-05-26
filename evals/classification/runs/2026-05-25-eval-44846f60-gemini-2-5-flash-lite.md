---
module: classification
eval_method: exact_match_category
prompt_hash: 44846f60
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-25T12:27:06.228Z
finished_at: 2026-05-25T12:28:19.937Z
total_cases: 32
attempted_cases: 32
passed: 28
failed: 4
pass_rate: 87.5%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 31
total_cost_brl: 0.3100
total_latency_ms: 73694
---

# Eval Run — classification — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 87.5% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `44846f60` |
| Cases tentados | 32 / 32 |
| Passaram | 28 |
| Falharam | 4 |
| Custo total | R$ 0.3100 |
| Latência total | 73.7s |
| Latência média | 2303ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 21 | 22 | 95.5% | 95.0% | ✅ |
| classification_confidence_low | 7 | 10 | 70.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 18 | 20 | 90.0% |
| synthetic | 8 | 8 | 100.0% |
| edge | 2 | 2 | 100.0% |
| adversarial | 0 | 2 | 0.0% |

## Falhas (4)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0002 | ledger_classified | real | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |
| classification-0023 | classification_confidence_low | real | nao_classificado | receita_bruta | 0.30 | confidence_out_of_range: 0.30 — below min 0.4 |
| classification-0031 | classification_confidence_low | adversarial | despesas_administrativas | nao_classificado | 0.70 | confidence_out_of_range: 0.70 — above max 0.69 |
| classification-0032 | classification_confidence_low | adversarial | receita_bruta | despesas_juridicas | 0.78 | category_mismatch: predicted=receita_bruta expected=despesas_juridicas |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.95 | 1659 | 1 |
| classification-0002 | ledger_classified | real | ❌ | — | — | 792 | 0 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 2423 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 7577 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.97 | 12293 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.98 | 4501 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.90 | 982 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.95 | 3302 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 3160 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.95 | 1173 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.99 | 3024 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 2114 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.98 | 2968 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 1467 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.95 | 1805 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.75 | 2452 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.95 | 1780 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.95 | 2279 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.85 | 1916 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.98 | 754 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.98 | 2012 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.75 | 1371 | 1 |
| classification-0023 | classification_confidence_low | real | ❌ | nao_classificado | 0.30 | 1733 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 1245 | 1 |
| classification-0025 | classification_confidence_low | real | ✅ | nao_classificado | 0.45 | 670 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 1569 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 662 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ✅ | outras_despesas | 0.63 | 2216 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 1048 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_pessoal | 0.63 | 1087 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ❌ | despesas_administrativas | 0.70 | 854 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ❌ | receita_bruta | 0.78 | 806 | 1 |

</details>
