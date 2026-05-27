---
module: classification
eval_method: exact_match_category
prompt_hash: e75e8d09
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-25T12:36:25.209Z
finished_at: 2026-05-25T12:37:07.036Z
total_cases: 32
attempted_cases: 32
passed: 31
failed: 1
pass_rate: 96.9%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 41813
---

# Eval Run — classification — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 96.9% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `e75e8d09` |
| Cases tentados | 32 / 32 |
| Passaram | 31 |
| Falharam | 1 |
| Custo total | R$ 0.3200 |
| Latência total | 41.8s |
| Latência média | 1307ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 22 | 22 | 100.0% | 95.0% | ✅ |
| classification_confidence_low | 9 | 10 | 90.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 19 | 20 | 95.0% |
| synthetic | 8 | 8 | 100.0% |
| edge | 2 | 2 | 100.0% |
| adversarial | 2 | 2 | 100.0% |

## Falhas (1)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0025 | classification_confidence_low | real | nao_classificado | despesas_administrativas | 0.35 | confidence_out_of_range: 0.35 — below min 0.4 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.92 | 948 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.98 | 806 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 792 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 2364 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.90 | 2695 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.95 | 2171 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.95 | 1339 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.95 | 1612 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 1519 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.99 | 794 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.98 | 1915 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 1933 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.98 | 797 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.98 | 1113 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.95 | 1459 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.75 | 1655 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 1076 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.97 | 1154 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.90 | 1113 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.98 | 1437 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.98 | 1149 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.75 | 1593 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.48 | 1424 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 1976 | 1 |
| classification-0025 | classification_confidence_low | real | ❌ | nao_classificado | 0.35 | 1350 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 741 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 993 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ✅ | outras_despesas | 0.60 | 783 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 796 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_pessoal | 0.60 | 771 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.45 | 741 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 804 | 1 |

</details>
