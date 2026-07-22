---
module: monthly-analysis
eval_method: assertion_shape
gate_strategy: rota_6c_delegate_to_financial_qa_review
prompt_hash: 0fcd35f0
provider: none
model: none
started_at: 2026-05-25T20:30:00.000Z
finished_at: 2026-05-25T20:30:00.010Z
total_cases: 10
attempted_cases: 10
passed: 10
failed: 0
pass_rate: 100.0%
pass_rate_threshold: 95.0%
threshold_met: true
total_cost_cents: 0
total_cost_brl: 0.0000
total_latency_ms: 4
delegate_source_run: "evals/monthly-analysis/financial-qa-review/runs/2026-05-25-eval-0fcd35f0-none.md"
manifest_source: "evals/monthly-analysis/manifest.json"
gate_purpose: "shadow_promotion_gate_only"
---

# Eval Run — monthly-analysis (SKU-level) — 2026-05-25

**Veredito**: ✅ APROVADO — pass rate 100.0% vs threshold 95.0%

**Tipo**: gate report SKU-level via **rota 6c** (delegação ao `financial-qa-review`). Não é eval E2E completo. Reflete o resultado do guardião determinístico do pipeline.

---

## 1. Sobre este relatório

Este arquivo existe para satisfazer o **Gate 4 do `/novais-digital:promote start_shadow`**, que exige:

> `evals/{artifact_id}/runs/` com run recente (≤ 7 dias) e `status: pass`

Conforme `evals/monthly-analysis/manifest.json` (estratégia `delegate_to_financial_qa_review`), o gate de promoção para SHADOW do SKU `monthly-analysis` é satisfeito por:

- O `financial-qa-review` é o auditor determinístico do output do pipeline E2E
- Detecta 10 categorias adversariais de erro (number_mismatch, missing_doneWhen, contradiction, missing_evidence, unfounded_claim, fraud_overclaim, tax_overreach, implausible_impact, omission, review_need)
- Em 100% dos cases adversariais, o auditor detecta corretamente o problema e marca a análise como `publishable: false` com `retryTargets` corretos
- O case "approve_clean_state" (0009) também passa, confirmando que outputs limpos não geram falsos positivos

**O que isto comprova para SHADOW**: dado qualquer output do pipeline `ingest → classification → dre-narrative → action-plan`, regressões conhecidas serão capturadas pelo `financial-qa-review` **antes** de chegar no humano que audita SHADOW (e portanto, nunca no cliente).

**O que isto NÃO comprova** (e está fora de escopo desta sessão):
- Qualidade narrativa absoluta dos cards (cobertura: `narrative-synthesis` sub-agente, 15 cases, runner SKIPa por enquanto)
- Qualidade absoluta do plano de ação (`action-planning` sub-agente, 15 cases, idem)
- Acurácia de normalização de descrições (`normalization` sub-agente, 10 cases, idem)

Esses gates serão exigidos para **promoção SHADOW → ASSISTED** (próxima sessão).

---

## 2. Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | none / `none` (assertion_shape determinístico) |
| Prompt hash | `0fcd35f0` |
| Cases tentados | 10 / 10 |
| Passaram | 10 |
| Falharam | 0 |
| Custo total | R$ 0,0000 |
| Latência total | 0,0s |
| Latência média | 0ms |

## 3. Pass rate por outcome (do auditor)

| Outcome adversarial | Passados | Total | Pass rate |
|---|---|---|---|
| detect_metric_mismatch | 1 | 1 | 100,0% |
| detect_schema_gap | 1 | 1 | 100,0% |
| detect_evidence_gap | 1 | 1 | 100,0% |
| detect_contradiction | 1 | 1 | 100,0% |
| detect_review_need | 1 | 1 | 100,0% |
| detect_overclaim | 1 | 1 | 100,0% |
| detect_omission | 1 | 1 | 100,0% |
| detect_implausible_impact | 1 | 1 | 100,0% |
| approve_clean_state | 1 | 1 | 100,0% |
| detect_tax_overreach | 1 | 1 | 100,0% |

## 4. Mapeamento dos outcomes do auditor → outcome_categories da spec

O auditor `financial-qa-review` valida indiretamente os 4 outcome_categories cobráveis da spec:

| outcome_categories (spec) | Outcomes do auditor que protegem |
|---|---|
| `dre_classified` | detect_schema_gap, detect_evidence_gap, detect_omission |
| `narrative_generated` | detect_metric_mismatch, detect_contradiction, detect_overclaim |
| `action_plan_generated` | detect_evidence_gap, detect_implausible_impact, detect_tax_overreach, detect_review_need |
| `analysis_delivered` | approve_clean_state (gate final que decide publishable=true) |

`report_exported` é outcome de UI/export, fora do pipeline de geração — não é candidato a gate eval.

## 5. Referência ao run original do sub-agente

Este relatório é uma **vista SKU-level** sobre o run real:

[evals/monthly-analysis/financial-qa-review/runs/2026-05-25-eval-0fcd35f0-none.md](../financial-qa-review/runs/2026-05-25-eval-0fcd35f0-none.md)

Mesmo `prompt_hash` (`0fcd35f0`), mesmos 10/10 cases passing, mesmo `total_cost: R$ 0`.

## 6. Próximo gate eval (SHADOW → ASSISTED)

Para promover de SHADOW para ASSISTED, exigir-se-á:

- Conectar runner de `assertion_shape` para outcomes de `normalization` (clean_normalize, flag_noise, preserve_amount_date)
- Conectar runner de `llm_as_judge` para `narrative-synthesis` (three_card_synthesis, risk_synthesis, margin_synthesis, contradiction_handling, anomaly_synthesis, insufficient_evidence)
- Conectar runner de `schema_validation` + `llm_as_judge` para `action-planning` (plan_by_horizon, cash_recovery_plan, margin_plan, risk_mitigation_plan, qa_sensitive_plan, needs_review_plan)
- Re-rodar todos os 4 sub-agentes (total: 50 cases ativos) e exigir pass rate ≥ 85% por sub-agente
- Substituir este relatório de delegação por um eval agregado real

## 7. Auditoria

- [x] Run original existe e é reproduzível (`npx tsx evals/run-llm.ts --module=monthly-analysis/financial-qa-review --method=assertion_shape` reproduz `prompt_hash:0fcd35f0`, `pass_rate:100%`)
- [x] Delegação explícita em `evals/monthly-analysis/manifest.json` `gate_strategy.shadow_gate: delegate_to_financial_qa_review`
- [x] Limitações declaradas com transparência (3 sub-agentes têm runner stub; aceito apenas para SHADOW)
- [x] Próximo nível (ASSISTED) tem checklist concreto
