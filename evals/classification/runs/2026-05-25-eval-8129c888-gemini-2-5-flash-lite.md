---
module: classification
eval_method: exact_match_category
prompt_hash: 8129c888
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-25T12:37:44.882Z
finished_at: 2026-05-25T12:38:16.924Z
total_cases: 32
attempted_cases: 32
passed: 31
failed: 1
pass_rate: 96.9%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 32021
---

# Eval Run — classification — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 96.9% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `8129c888` |
| Cases tentados | 32 / 32 |
| Passaram | 31 |
| Falharam | 1 |
| Custo total | R$ 0.3200 |
| Latência total | 32.0s |
| Latência média | 1001ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 21 | 22 | 95.5% | 95.0% | ✅ |
| classification_confidence_low | 10 | 10 | 100.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 20 | 20 | 100.0% |
| synthetic | 7 | 8 | 87.5% |
| edge | 2 | 2 | 100.0% |
| adversarial | 2 | 2 | 100.0% |

## Falhas (1)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0022 | ledger_classified | synthetic | outras_despesas | outras_despesas | 0.65 | confidence_out_of_range: 0.65 — below min 0.75 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.92 | 1297 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.95 | 1189 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.95 | 919 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.99 | 1315 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.95 | 1077 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.95 | 721 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.98 | 816 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.98 | 841 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.95 | 1442 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.97 | 1204 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.99 | 691 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 773 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.97 | 2406 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 1363 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 784 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.92 | 700 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.99 | 812 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.95 | 792 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.95 | 706 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.98 | 878 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 967 | 1 |
| classification-0022 | ledger_classified | synthetic | ❌ | outras_despesas | 0.65 | 940 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.48 | 929 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 717 | 1 |
| classification-0025 | classification_confidence_low | real | ✅ | nao_classificado | 0.50 | 674 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 950 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 1053 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ✅ | outras_despesas | 0.63 | 1372 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 921 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_pessoal | 0.65 | 1015 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.45 | 998 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 759 | 1 |

</details>
