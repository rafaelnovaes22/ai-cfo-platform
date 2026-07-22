---
module: classification
eval_method: exact_match_category
prompt_hash: 68d38d39
provider: google
model: gemini-2.5-flash
started_at: 2026-05-14T14:29:03.462Z
finished_at: 2026-05-14T14:30:07.304Z
total_cases: 32
attempted_cases: 32
passed: 18
failed: 14
pass_rate: 56.3%
pass_rate_threshold: 95.0%
threshold_met: false
total_cost_cents: 23
total_cost_brl: 0.2300
total_latency_ms: 63831
---

# Eval Run — classification — 2026-05-14

**Veredito**: ❌ REPROVADO — pass rate 56.3% vs threshold 95.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash` |
| Prompt hash | `68d38d39` |
| Cases tentados | 32 / 32 |
| Passaram | 18 |
| Falharam | 14 |
| Custo total | R$ 0.2300 |
| Latência total | 63.8s |
| Latência média | 1995ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| ledger_classified | 16 | 22 | 72.7% |
| classification_confidence_low | 2 | 10 | 20.0% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 12 | 20 | 60.0% |
| synthetic | 6 | 8 | 75.0% |
| edge | 0 | 2 | 0.0% |
| adversarial | 0 | 2 | 0.0% |

## Falhas (14)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| classification-0003 | ledger_classified | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0006 | ledger_classified | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0007 | ledger_classified | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0008 | ledger_classified | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0010 | ledger_classified | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0019 | ledger_classified | synthetic | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0024 | classification_confidence_low | real | prolabore | prolabore | 0.98 | confidence_out_of_range: 0.98 — above max 0.69 |
| classification-0025 | classification_confidence_low | real | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0027 | classification_confidence_low | real | despesas_administrativas | despesas_administrativas | 0.98 | confidence_out_of_range: 0.98 — above max 0.69 |
| classification-0028 | classification_confidence_low | synthetic | outras_despesas | despesas_pessoal | 0.85 | confidence_out_of_range: 0.85 — above max 0.69 |
| classification-0029 | classification_confidence_low | edge | outras_receitas | despesas_financeiras | 0.95 | confidence_out_of_range: 0.95 — above max 0.69 |
| classification-0030 | classification_confidence_low | edge | despesas_administrativas | despesas_juridicas | 0.92 | confidence_out_of_range: 0.92 — above max 0.6999 |
| classification-0031 | classification_confidence_low | adversarial | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |
| classification-0032 | classification_confidence_low | adversarial | — | — | — | llm_error: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| classification-0001 | ledger_classified | real | ✅ | receita_bruta | 0.95 | 1596 | 1 |
| classification-0002 | ledger_classified | real | ✅ | despesas_pessoal | 0.98 | 2347 | 1 |
| classification-0003 | ledger_classified | real | ❌ | — | — | 856 | 0 |
| classification-0004 | ledger_classified | real | ✅ | simples_nacional | 0.99 | 1423 | 1 |
| classification-0005 | ledger_classified | real | ✅ | despesas_administrativas | 0.98 | 2183 | 1 |
| classification-0006 | ledger_classified | real | ❌ | — | — | 7173 | 0 |
| classification-0007 | ledger_classified | real | ❌ | — | — | 1147 | 0 |
| classification-0008 | ledger_classified | real | ❌ | — | — | 1027 | 0 |
| classification-0009 | ledger_classified | real | ✅ | capex | 0.98 | 1462 | 1 |
| classification-0010 | ledger_classified | real | ❌ | — | — | 934 | 0 |
| classification-0011 | ledger_classified | real | ✅ | amortizacao_dividas | 0.98 | 1545 | 1 |
| classification-0012 | ledger_classified | real | ✅ | despesas_comerciais | 0.98 | 1505 | 1 |
| classification-0013 | ledger_classified | real | ✅ | despesas_juridicas | 0.98 | 1496 | 1 |
| classification-0014 | ledger_classified | real | ✅ | despesas_viagem | 0.98 | 1416 | 1 |
| classification-0015 | ledger_classified | real | ✅ | cpv_cmv | 0.98 | 1670 | 1 |
| classification-0016 | ledger_classified | synthetic | ✅ | custo_servicos | 0.95 | 1959 | 1 |
| classification-0017 | ledger_classified | synthetic | ✅ | irpj_csll | 0.98 | 1475 | 1 |
| classification-0018 | ledger_classified | synthetic | ✅ | deducoes_receita | 0.98 | 1506 | 1 |
| classification-0019 | ledger_classified | synthetic | ❌ | — | — | 627 | 0 |
| classification-0020 | ledger_classified | synthetic | ✅ | depreciacao | 0.99 | 1131 | 1 |
| classification-0021 | ledger_classified | synthetic | ✅ | transferencia_interna | 0.99 | 1328 | 1 |
| classification-0022 | ledger_classified | synthetic | ✅ | outras_despesas | 0.90 | 2856 | 1 |
| classification-0023 | classification_confidence_low | real | ✅ | receita_bruta | 0.61 | 2403 | 1 |
| classification-0024 | classification_confidence_low | real | ❌ | prolabore | 0.98 | 1551 | 1 |
| classification-0025 | classification_confidence_low | real | ❌ | — | — | 1064 | 0 |
| classification-0026 | classification_confidence_low | real | ✅ | nao_classificado | 0.40 | 3269 | 1 |
| classification-0027 | classification_confidence_low | real | ❌ | despesas_administrativas | 0.98 | 1468 | 1 |
| classification-0028 | classification_confidence_low | synthetic | ❌ | outras_despesas | 0.85 | 4776 | 1 |
| classification-0029 | classification_confidence_low | edge | ❌ | outras_receitas | 0.95 | 3423 | 1 |
| classification-0030 | classification_confidence_low | edge | ❌ | despesas_administrativas | 0.92 | 2283 | 1 |
| classification-0031 | classification_confidence_low | adversarial | ❌ | — | — | 1258 | 0 |
| classification-0032 | classification_confidence_low | adversarial | ❌ | — | — | 3674 | 0 |

</details>
