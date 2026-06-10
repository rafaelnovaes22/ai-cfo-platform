---
module: classification
eval_method: exact_match_category
prompt_hash: 96f545a4
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-06-10T16:21:08.944Z
finished_at: 2026-06-10T16:28:12.721Z
total_cases: 35
attempted_cases: 35
passed: 32
failed: 3
pass_rate: 91.4%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 35
total_cost_brl: 0.3500
total_latency_ms: 423764
---

# Eval Run — classification — 2026-06-10

**Veredito**: ✅ APROVADO — pass rate 91.4% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `96f545a4` |
| Cases tentados | 35 / 35 |
| Passaram | 32 |
| Falharam | 3 |
| Custo total | R$ 0.3500 |
| Latência total | 423.8s |
| Latência média | 12108ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 24 | 25 | 96.0% | 95.0% | ✅ |
| classification_confidence_low | 8 | 10 | 80.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 20 | 22 | 90.9% |
| synthetic | 7 | 8 | 87.5% |
| edge | 3 | 3 | 100.0% |
| adversarial | 2 | 2 | 100.0% |

## Falhas (3)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | receita_bruta | receita_bruta | 0.48 | confidence_out_of_range: 0.48 — below min 0.85 |
| classification-0025 | classification_confidence_low | real | cpv_cmv | despesas_administrativas | 0.90 | category_mismatch: predicted=cpv_cmv expected=despesas_administrativas |
| classification-0028 | classification_confidence_low | synthetic | nao_classificado | despesas_pessoal | 0.60 | category_mismatch: predicted=nao_classificado expected=despesas_pessoal |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ❌ | receita_bruta | 0.48 | 9814 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.95 | 9375 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.95 | 10086 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 9302 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.85 | 9290 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.90 | 9291 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.95 | 9174 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.95 | 9352 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.95 | 9487 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.95 | 9410 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.95 | 9388 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 9376 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.95 | 9230 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 9490 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.95 | 9125 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.90 | 9141 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.97 | 10380 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.95 | 9781 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.90 | 9391 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.95 | 9197 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 1.00 | 9211 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.88 | 93520 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.48 | 9628 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 9656 | 1 |
| classification-0025 | classification_confidence_low | real | ❌ | cpv_cmv | 0.90 | 10180 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 9381 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 9702 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | nao_classificado | 0.60 | 15934 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 12158 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_juridicas | 0.60 | 9259 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.45 | 9224 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 9186 | 1 |
| classification-0033 | ledger_classified | real | ✅ | simples_nacional | 0.97 | 9146 | 1 |
| classification-0034 | ledger_classified | real | ✅ | despesas_administrativas | 0.90 | 9320 | 1 |
| classification-0035 | ledger_classified | edge | ✅ | prolabore | 0.95 | 9179 | 1 |

</details>
