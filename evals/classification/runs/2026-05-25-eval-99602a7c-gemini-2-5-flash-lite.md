---
module: classification
eval_method: exact_match_category
prompt_hash: 99602a7c
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-25T12:39:13.390Z
finished_at: 2026-05-25T12:39:42.749Z
total_cases: 32
attempted_cases: 32
passed: 31
failed: 1
pass_rate: 96.9%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 31
total_cost_brl: 0.3100
total_latency_ms: 29346
---

# Eval Run — classification — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 96.9% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `99602a7c` |
| Cases tentados | 32 / 32 |
| Passaram | 31 |
| Falharam | 1 |
| Custo total | R$ 0.3100 |
| Latência total | 29.3s |
| Latência média | 917ms |

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
| classification-0017 | ledger_classified | synthetic | — | — | — | llm_error: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.95 | 2300 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.98 | 914 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 1010 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 784 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.95 | 1004 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.98 | 1013 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.92 | 820 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.95 | 1319 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 876 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.98 | 688 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.98 | 761 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 631 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.95 | 1115 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 774 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.95 | 1766 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.85 | 965 | 1 |
| classification-0017 | ledger_classified | synthetic | ❌ | — | — | 523 | 0 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.95 | 912 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.90 | 679 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.99 | 705 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 688 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.88 | 713 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.48 | 704 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 748 | 1 |
| classification-0025 | classification_confidence_low | real | ✅ | nao_classificado | 0.50 | 824 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 811 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 840 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ✅ | outras_despesas | 0.65 | 1173 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 855 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_pessoal | 0.65 | 744 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.45 | 773 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 914 | 1 |

</details>
