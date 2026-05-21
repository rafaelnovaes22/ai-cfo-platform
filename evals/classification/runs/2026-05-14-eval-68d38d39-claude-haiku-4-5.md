---
module: classification
eval_method: exact_match_category
prompt_hash: 68d38d39
provider: anthropic
model: claude-haiku-4-5
started_at: 2026-05-14T14:30:16.444Z
finished_at: 2026-05-14T14:30:49.455Z
total_cases: 32
attempted_cases: 32
passed: 26
failed: 6
pass_rate: 81.3%
pass_rate_threshold: 95.0%
threshold_met: false
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 32996
---

# Eval Run — classification — 2026-05-14

**Veredito**: ❌ REPROVADO — pass rate 81.3% vs threshold 95.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | anthropic / `claude-haiku-4-5` |
| Prompt hash | `68d38d39` |
| Cases tentados | 32 / 32 |
| Passaram | 26 |
| Falharam | 6 |
| Custo total | R$ 0.3200 |
| Latência total | 33.0s |
| Latência média | 1031ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| ledger_classified | 22 | 22 | 100.0% |
| classification_confidence_low | 4 | 10 | 40.0% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 17 | 20 | 85.0% |
| synthetic | 7 | 8 | 87.5% |
| edge | 0 | 2 | 0.0% |
| adversarial | 2 | 2 | 100.0% |

## Falhas (6)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0024 | classification_confidence_low | real | prolabore | prolabore | 0.92 | confidence_out_of_range: 0.92 — above max 0.69 |
| classification-0025 | classification_confidence_low | real | despesas_administrativas | despesas_administrativas | 0.72 | confidence_out_of_range: 0.72 — above max 0.69 |
| classification-0027 | classification_confidence_low | real | despesas_administrativas | despesas_administrativas | 0.98 | confidence_out_of_range: 0.98 — above max 0.69 |
| classification-0028 | classification_confidence_low | synthetic | outras_despesas | despesas_pessoal | 0.72 | confidence_out_of_range: 0.72 — above max 0.69 |
| classification-0029 | classification_confidence_low | edge | despesas_financeiras | despesas_financeiras | 0.85 | confidence_out_of_range: 0.85 — above max 0.69 |
| classification-0030 | classification_confidence_low | edge | despesas_juridicas | despesas_juridicas | 0.72 | confidence_out_of_range: 0.72 — above max 0.6999 |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.92 | 1024 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.92 | 1168 | 1 |
| classification-0003 | ledger_classified | real | ✅ | prolabore | 0.98 | 914 | 1 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.98 | 955 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.98 | 1092 | 1 |
| classification-0006 | ledger_classified | real | ✅ | despesas_ti | 0.98 | 1029 | 1 |
| classification-0007 | ledger_classified | real | ✅ | despesas_financeiras | 0.95 | 997 | 1 |
| classification-0008 | ledger_classified | real | ✅ | receita_financeira | 0.98 | 984 | 1 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 903 | 1 |
| classification-0010 | ledger_classified | real | ✅ | emprestimos_entrada | 0.98 | 1003 | 1 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.98 | 886 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.98 | 1052 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.98 | 1089 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.96 | 1055 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 983 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.82 | 1101 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 984 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.94 | 1104 | 1 |
| classification-0019 | ledger_classified | synthetic | ✅ | outras_receitas | 0.92 | 959 | 1 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.98 | 1041 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 1098 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.85 | 912 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | nao_classificado | 0.45 | 1043 | 1 |
| classification-0024 | classification_confidence_low | real | ❌ | prolabore | 0.92 | 846 | 1 |
| classification-0025 | classification_confidence_low | real | ❌ | despesas_administrativas | 0.72 | 1048 | 1 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.35 | 964 | 1 |
| classification-0027 | classification_confidence_low | real | ❌ | despesas_administrativas | 0.98 | 1506 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | outras_despesas | 0.72 | 887 | 1 |
| classification-0029 | classification_confidence_low | edge | ❌ | despesas_financeiras | 0.85 | 1040 | 1 |
| classification-0030 | classification_confidence_low | edge | ❌ | despesas_juridicas | 0.72 | 1261 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ✅ | nao_classificado | 0.30 | 1059 | 1 |
| classification-0032 | classification_confidence_low | adversarial | ✅ | despesas_juridicas | 0.58 | 1009 | 1 |

</details>
