---
module: classification
eval_method: exact_match_category
prompt_hash: 145a8065
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-06-15T15:47:33.393Z
finished_at: 2026-06-15T15:48:01.268Z
total_cases: 39
attempted_cases: 39
passed: 38
failed: 1
pass_rate: 97.4%
pass_rate_threshold: 80.0%
threshold_met: true
total_cost_cents: 39
total_cost_brl: 0.3900
total_latency_ms: 27864
---

# Eval Run — classification — 2026-06-15

**Veredito**: ✅ APROVADO — pass rate 97.4% vs threshold 80.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `145a8065` |
| Cases tentados | 39 / 39 |
| Passaram | 38 |
| Falharam | 1 |
| Custo total | R$ 0.3900 |
| Latência total | 27.9s |
| Latência média | 714ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate | Threshold | Status |
|---|---|---|---|---|---|
| ledger_classified | 27 | 28 | 96.4% | 95.0% | ✅ |
| classification_confidence_low | 11 | 11 | 100.0% | 30.0% | ✅ |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 24 | 25 | 96.0% |
| synthetic | 8 | 8 | 100.0% |
| edge | 3 | 3 | 100.0% |
| adversarial | 3 | 3 | 100.0% |

## Falhas (1)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | receita_bruta | receita_bruta | 0.68 | confidence_out_of_range: 0.68 — below min 0.85 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ❌ | receita_bruta | 0.68 | 813 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.95 | 709 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.97 | 758 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 677 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.92 | 677 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.95 | 682 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.95 | 714 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.97 | 749 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.97 | 712 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.95 | 753 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.95 | 776 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.95 | 772 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.97 | 643 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 721 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.97 | 679 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.85 | 722 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 719 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.97 | 748 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.95 | 647 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.95 | 741 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 704 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.88 | 715 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.48 | 805 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.55 | 568 | 1 |
| classification-0025 | classification_confidence_low | real | ✅ | outras_despesas | 0.60 | 773 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 749 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.60 | 651 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ✅ | outras_despesas | 0.63 | 644 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | despesas_financeiras | 0.58 | 714 | 1 |
| classification-0030 | classification_confidence_low | edge | ✅ | despesas_pessoal | 0.65 | 749 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.45 | 648 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 753 | 1 |
| classification-0033 | ledger_classified | real | ✅ | simples_nacional | 0.97 | 721 | 1 |
| classification-0034 | ledger_classified | real | ✅ | despesas_administrativas | 0.90 | 682 | 1 |
| classification-0035 | ledger_classified | edge | ✅ | prolabore | 0.98 | 712 | 1 |
| classification-0036 | ledger_classified | real | ✅ | receita_bruta | 0.92 | 719 | 1 |
| classification-0037 | classification_confidence_low | adversarial | ✅ | prolabore | 0.98 | 717 | 1 |
| classification-0038 | ledger_classified | real | ✅ | receita_bruta | 0.85 | 681 | 1 |
| classification-0039 | ledger_classified | real | ✅ | custo_servicos | 0.90 | 747 | 1 |

</details>
