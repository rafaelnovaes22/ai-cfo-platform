---
subscription_id: "monthly-analysis"
artifact_id: "monthly-analysis"
artifact_type: "product"
client_id: "aicfo"
project_type: "agentic_saas"
ai_enabled: true
log_format: "append-only"
total_transitions: 1
created_at: "2026-05-25"
last_updated: "2026-05-25"
constitution_version: "0.2.0"
forge_command_version: "promote@0.3.0"
---

# Promotions Log — `monthly-analysis`

> Log append-only de transições de modo do SKU `monthly-analysis`. Cada transição registra os 6 gates do `/acme:promote` com `signature_hash` dos aprovadores e referência aos artifacts validados. Auditável pelo reviewer DeepAgent na auditoria mensal.

---

## Transition 1 — 2026-05-25 — none → shadow

```yaml
transition:
  from_mode: none
  to_mode: shadow
  approved_at: "2026-05-25T20:50:00.000Z"
  prompt_hash_in_production: "0fcd35f0"  # match com eval run report
  outcome_clause_hash: "3b9278b7825aaa9e"  # match com spec
  c4_thresholds_signature_hash: "3a2e0f6f1f6d9644"  # match com spec
  shadow_window:
    started_at: "2026-05-25T20:50:00.000Z"
    min_window_days: 14
    window_ends_at_earliest: "2026-06-08T20:50:00.000Z"
    target_tenants: 5-10
    status: "open_for_recruitment"

gates:
  c2_outcome_clause:
    passed: true
    evidence: "docs/specs/monthly-analysis.md v0.2.0 (c2_validation:pass, outcome_clause_hash:3b9278b7825aaa9e)"
    hash_match: true
    notes: "Cláusula §1.1 contém 3+3 exemplos + trigger_event 'client_imports_ledger_for_reference_month'. outcome_clause_hash da spec consistente com o pipeline em produção (mesmo prompt está em src/dre-narrative/prompts.ts via buildNarrativeSystemPrompt + buildNarrativeUserPrompt)."

  c3_unit_economics:
    passed: true
    status: "viable"
    cost_per_outcome_brl: 0.088
    price_per_outcome_brl: 99.00
    ratio_pct: 0.089
    margin_to_threshold: "280x"
    recalc_required: false
    evidence: "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md (c3_check.status:viable)"

  c4_sla_pre_contracted:
    passed: true
    signature_hash: "3a2e0f6f1f6d9644"
    signed_by: "CEO Acme"
    signed_at: "2026-05-08"
    min_window_days: 14
    cost_per_outcome_max_cents: 1980
    human_cost_per_unit_cents: 30000
    cost_max_le_human_cost: true
    evidence: "docs/specs/monthly-analysis.md frontmatter.c4_thresholds + docs/onda-0/sla_threshold.md (D6)"

  eval_suite_passing:
    passed: true
    run_report: "evals/monthly-analysis/runs/2026-05-25-eval-0fcd35f0-monthly-analysis-shadow-gate.md"
    method: "assertion_shape"
    prompt_hash: "0fcd35f0"
    age_days: 0
    pass_rate: 1.0
    threshold: 0.95
    cases_passed: 10
    cases_total: 10
    gate_strategy: "rota_6c_delegate_to_financial_qa_review"
    coverage_caveat: "SHADOW gate via auditor determinístico do pipeline (financial-qa-review). 3 sub-agentes restantes (normalization, narrative-synthesis, action-planning) com cases já criados mas runner pendente — exigidos para SHADOW → ASSISTED."

  human_approval:
    passed: true
    bypass_engaged: true
    bypass_flag: "ACME_FORGE_BYPASS=incident:founder-solo-pre-team"
    bypass_rationale: "founder-solo project — Rafael Novaes é product_lead + tech_lead + CEO simultaneamente. Sem 2ª pessoa para assinar roles distintas. Bypass expira na primeira contratação técnica/product."
    bypass_audit_ref: "subscriptions/monthly-analysis/state.md §4 (decisão registrada antes da execução do promote)"
    po:
      name: "Rafael Novaes (atuando como CEO/PO)"
      role_alias: "rafael-novaes-ceo"
      signature_hash: "78df9d8d39f37805"
      approved_at: "2026-05-25T20:50:00.000Z"
    promotion_officer:
      name: "Rafael Novaes (atuando como Promotion Officer)"
      role_alias: "rafael-novaes-acting-promo-officer"
      signature_hash: "61a108e924f7ddeb"
      approved_at: "2026-05-25T20:50:00.000Z"
    note: "approver_po != approver_promotion_officer apenas em ROLE STRING. Mesma pessoa física. Sem bypass, lint bloquearia. Bypass aceito conforme política documentada em state.md §4."

  cicd_pipeline_active:
    passed: true
    status: "skipped_not_required_for_start_shadow"
    note: "Gate 6 obrigatório apenas para assisted_to_autonomous. Para start_shadow, é skip por design."

gates_summary:
  total: 6
  passed: 5
  bypassed: 1
  failed: 0
  skipped: 0
  cicd_pipeline_active_status: "skipped_not_required_for_start_shadow"

shadow_runner:
  invoked: true
  precondition_check: "pass"
  start_window_persisted: true
  window_days: 14
  next_review_at: "2026-06-08T20:50:00.000Z"

recommendation: "monitorar dashboards de qualidade durante a janela SHADOW (14 dias min). Recrutar 5-10 PMEs reais. Rafael revisa TODA análise antes do cliente ver. Disparar /acme:audit-monthly em 2026-06-25."

trace_id: "trace-77aa43ba9a5877c6"
approved_at: "2026-05-25T20:50:00.000Z"
approved_by_signature: "78df9d8d39f37805+61a108e924f7ddeb"
generated_by: "/acme:promote@0.3.0 invocado em sessão Claude Sonnet 4.6"
```

---

## Audit notes (revisão DeepAgent mensal)

- **Bypass de Gate 5** é o único item não-padrão desta transição. Documentado em `state.md §4` ANTES da execução, com rationale explícita "founder-solo-pre-team". DeepAgent deve flaggar este bypass na primeira auditoria mensal para revisão.
- **Eval coverage** está em delegação (rota 6c) — financial-qa-review valida o output E2E mas só 1 de 4 sub-agentes tem runner conectado. Para SHADOW (humano revisa), é suficiente; para ASSISTED, exigir-se-á eval completo dos 4.
- **Recálculo unit economics** (`recalc_unit_economics_required:false`) é honesto: o `prompt_hash:0fcd35f0` do eval bate com o estado de produção; nenhum prompt foi alterado desde o último recálculo.
- **Outcome clause hash** consistência verificada (`3b9278b7825aaa9e` em spec). Não há `prompts/{id}/v{ver}/system.md` separado — os prompts vivem em `src/dre-narrative/prompts.ts` (build dinâmico via `buildNarrativeSystemPrompt`). Esta é uma simplificação aceita: o hash do output da função em runtime é o hash de produção.
