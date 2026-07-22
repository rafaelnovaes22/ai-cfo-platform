---
module: classification
eval_method: exact_match_category
prompt_hash: 68d38d39
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-14T14:43:01.418Z
finished_at: 2026-05-14T14:43:42.474Z
total_cases: 32
attempted_cases: 32
passed: 21
failed: 11
pass_rate: 65.6%
pass_rate_threshold: 95.0%
threshold_met: false
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 41042
---

# Eval Run — classification — 2026-05-14

**Veredito**: ❌ REPROVADO — pass rate 65.6% vs threshold 95.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `68d38d39` |
| Cases tentados | 32 / 32 |
| Passaram | 21 |
| Falharam | 11 |
| Custo total | R$ 0.3200 |
| Latência total | 41.0s |
| Latência média | 1283ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| ledger_classified | 15 | 22 | 68.2% |
| classification_confidence_low | 6 | 10 | 60.0% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 14 | 20 | 70.0% |
| synthetic | 5 | 8 | 62.5% |
| edge | 1 | 2 | 50.0% |
| adversarial | 1 | 2 | 50.0% |

## Falhas (11)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0005 | ledger_classified | real | despesas_administrativas | despesas_administrativas | 0.65 | confidence_out_of_range: 0.65 (llm=0.95) — below min 0.85 [heur:short_desc_no_anchor] |
| classification-0006 | ledger_classified | real | despesas_ti | despesas_ti | 0.65 | confidence_out_of_range: 0.65 (llm=0.98) — below min 0.9 [heur:short_desc_no_anchor] |
| classification-0007 | ledger_classified | real | despesas_financeiras | despesas_financeiras | 0.65 | confidence_out_of_range: 0.65 (llm=0.85) — below min 0.85 [heur:short_desc_no_anchor] |
| classification-0008 | ledger_classified | real | receita_financeira | receita_financeira | 0.65 | confidence_out_of_range: 0.65 (llm=0.98) — below min 0.9 [heur:short_desc_no_anchor] |
| classification-0012 | ledger_classified | real | despesas_comerciais | despesas_comerciais | 0.65 | confidence_out_of_range: 0.65 (llm=0.98) — below min 0.9 [heur:short_desc_no_anchor] |
| classification-0019 | ledger_classified | synthetic | outras_receitas | outras_receitas | 0.65 | confidence_out_of_range: 0.65 (llm=0.85) — below min 0.8 [heur:short_desc_no_anchor] |
| classification-0021 | ledger_classified | synthetic | transferencia_interna | transferencia_interna | 0.60 | confidence_out_of_range: 0.60 (llm=0.99) — below min 0.9 [heur:ambiguity_keyword] |
| classification-0025 | classification_confidence_low | real | despesas_comerciais | despesas_administrativas | 0.65 | category_mismatch: predicted=despesas_comerciais expected=despesas_administrativas |
| classification-0028 | classification_confidence_low | synthetic | outras_receitas | despesas_pessoal | 0.60 | category_mismatch: predicted=outras_receitas expected=despesas_pessoal |
| classification-0030 | classification_confidence_low | edge | despesas_pessoal | despesas_juridicas | 0.85 | confidence_out_of_range: 0.85 (llm=0.85) — above max 0.6999 |
| classification-0031 | classification_confidence_low | adversarial | nao_classificado | nao_classificado | 0.10 | confidence_out_of_range: 0.10 (llm=0.10) — below min 0.3 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.85 | 1170 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.98 | 704 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 1281 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.99 | 1332 | 1 |
| classification-0005 | ledger_classified | real | ❌ | despesas_administrativas | 0.65 | 897 | 1 |
| classification-0006 | ledger_classified | real | ❌ | despesas_ti | 0.65 | 1082 | 1 |
| classification-0007 | ledger_classified | real | ❌ | despesas_financeiras | 0.65 | 1083 | 1 |
| classification-0008 | ledger_classified | real | ❌ | receita_financeira | 0.65 | 844 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.99 | 1867 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.99 | 2813 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.95 | 3340 | 1 |
| classification-0012 | ledger_classified | real | ❌ | despesas_comerciais | 0.65 | 1572 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.95 | 725 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.95 | 780 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 1086 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.85 | 856 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 1682 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.95 | 923 | 1 |
| classification-0019 | ledger_classified | synthetic | ❌ | outras_receitas | 0.65 | 647 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 1.00 | 840 | 1 |
| classification-0021 | ledger_classified | synthetic | ❌ | transferencia_interna | 0.60 | 990 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.85 | 1505 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.61 | 801 | 1 |
| classification-0024 | classification_confidence_low | real | ✅ | prolabore | 0.65 | 1055 | 1 |
| classification-0025 | classification_confidence_low | real | ❌ | despesas_comerciais | 0.65 | 2803 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | transferencia_interna | 0.65 | 765 | 1 |
| classification-0027 | classification_confidence_low | real | ✅ | despesas_administrativas | 0.65 | 2042 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | outras_receitas | 0.60 | 765 | 1 |
| classification-0029 | classification_confidence_low | edge | ✅ | outras_receitas | 0.60 | 1794 | 1 |
| classification-0030 | classification_confidence_low | edge | ❌ | despesas_pessoal | 0.85 | 802 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ❌ | nao_classificado | 0.10 | 763 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_administrativas | 0.65 | 1433 | 1 |

</details>
