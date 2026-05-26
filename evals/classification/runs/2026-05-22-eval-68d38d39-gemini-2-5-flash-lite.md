---
module: classification
eval_method: exact_match_category
prompt_hash: 68d38d39
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-22T21:01:50.167Z
finished_at: 2026-05-22T21:02:51.888Z
total_cases: 32
attempted_cases: 32
passed: 25
failed: 7
pass_rate: 78.1%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 61703
---

# Eval Run — classification — 2026-05-22

**Veredito**: ✅ APROVADO — pass rate 78.1% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `68d38d39` |
| Cases tentados | 32 / 32 |
| Passaram | 25 |
| Falharam | 7 |
| Custo total | R$ 0.3200 |
| Latência total | 61.7s |
| Latência média | 1928ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 22 | 22 | 100.0% | 95.0% | ✅ |
| classification_confidence_low | 3 | 10 | 30.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 17 | 20 | 85.0% |
| synthetic | 7 | 8 | 87.5% |
| edge | 0 | 2 | 0.0% |
| adversarial | 1 | 2 | 50.0% |

## Falhas (7)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0024 | classification_confidence_low | real | prolabore | prolabore | 0.98 | confidence_out_of_range: 0.98 — above max 0.69 |
| classification-0026 | classification_confidence_low | real | transferencia_interna | nao_classificado | 0.85 | confidence_out_of_range: 0.85 — above max 0.69 |
| classification-0027 | classification_confidence_low | real | despesas_administrativas | despesas_administrativas | 0.98 | confidence_out_of_range: 0.98 — above max 0.69 |
| classification-0028 | classification_confidence_low | synthetic | outras_receitas | despesas_pessoal | 0.75 | category_mismatch: predicted=outras_receitas expected=despesas_pessoal |
| classification-0029 | classification_confidence_low | edge | receita_financeira | despesas_financeiras | 0.80 | confidence_out_of_range: 0.80 — above max 0.69 |
| classification-0030 | classification_confidence_low | edge | despesas_pessoal | despesas_juridicas | 0.85 | confidence_out_of_range: 0.85 — above max 0.6999 |
| classification-0032 | classification_confidence_low | adversarial | despesas_administrativas | despesas_juridicas | 0.85 | confidence_out_of_range: 0.85 — above max 0.69 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.85 | 2728 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.95 | 1907 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 3970 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 5730 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.98 | 3011 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.98 | 2290 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.98 | 3699 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.98 | 3986 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 911 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.98 | 1414 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.97 | 1068 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.97 | 4186 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.95 | 2038 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 1244 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 786 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.95 | 1134 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 654 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.98 | 1887 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.90 | 1159 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 1.00 | 1626 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 1723 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.75 | 1110 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.61 | 4690 | 1 |
| classification-0024 | classification_confidence_low | real | ❌ | prolabore | 0.98 | 651 | 1 |
| classification-0025 | classification_confidence_low | real | ✅ | nao_classificado | 0.50 | 1355 | 1 |
| classification-0026 | classification_confidence_low | real | ❌ | transferencia_interna | 0.85 | 658 | 1 |
| classification-0027 | classification_confidence_low | real | ❌ | despesas_administrativas | 0.98 | 1306 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | outras_receitas | 0.75 | 1101 | 1 |
| classification-0029 | classification_confidence_low | edge | ❌ | receita_financeira | 0.80 | 885 | 1 |
| classification-0030 | classification_confidence_low | edge | ❌ | despesas_pessoal | 0.85 | 733 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | outras_despesas | 0.50 | 865 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ❌ | despesas_administrativas | 0.85 | 1198 | 1 |

</details>
