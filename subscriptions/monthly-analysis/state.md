---
subscription_id: "monthly-analysis"
artifact_id: "monthly-analysis"
artifact_type: "product"
client_id: "aicfo"
project_type: "agentic_saas"
ai_enabled: true
mode: "shadow"
mode_history:
  - from: "none"
    to: "shadow"
    transitioned_at: "2026-05-25T20:50:00.000Z"
    promotions_log_ref: "subscriptions/monthly-analysis/promotions.md#transition-1"
started_at: "2026-05-25T20:50:00.000Z"
shadow_window:
  started_at: "2026-05-25T20:50:00.000Z"
  min_window_days: 14
  window_ends_at_earliest: "2026-06-08T20:50:00.000Z"
  next_review_at: "2026-06-08"
  target_tenants: "5-10"
  status: "open_for_recruitment"
linked_spec: "docs/specs/monthly-analysis.md"
linked_baseline_cost: "docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md"
linked_process_map: "docs/clients/aicfo/process-monthly-analysis-2026-05-25.md"
linked_sla_threshold: "docs/onda-0/sla_threshold.md"
linked_promotions_log: "subscriptions/monthly-analysis/promotions.md"
created_at: "2026-05-25"
last_updated: "2026-05-25"
constitution_version: "0.2.0"
forge_command_version: "promote@0.3.0"
---

# Subscription State — `monthly-analysis`

> Estado de promoção do SKU `monthly-analysis` (produto self-serve Aicfo).
> **Mode atual**: `none` (pré-SHADOW). Próxima transição alvo: `start_shadow`.

---

## 1. Estado atual

```yaml
mode: shadow                  # ∈ {none, shadow, assisted, autonomous}
started_at: "2026-05-25T20:50:00.000Z"
last_transition_at: "2026-05-25T20:50:00.000Z"
last_transition_from: "none"
days_in_current_mode: 0       # janela SHADOW recém-iniciada
total_outcomes_delivered: 0   # SHADOW: cliente não recebe output; Rafael audita TODA análise
shadow_window:
  started_at: "2026-05-25T20:50:00.000Z"
  window_ends_at_earliest: "2026-06-08T20:50:00.000Z"
  next_review_at: "2026-06-08"
  status: "open_for_recruitment"
  recruitment_target: "5-10 PMEs reais"
```

> ✅ Transição `none → shadow` registrada em [`promotions.md` Transition 1](promotions.md#transition-1--2026-05-25--none--shadow) (6 gates avaliados; 5 passed, 1 bypassed com rationale `founder-solo-pre-team`, 0 failed).

---

## 2. Pré-conditions checklist (para `/acme:promote start_shadow`)

| # | Pre-condition | Estado | Evidência |
|---|---|---|---|
| 1 | `subscriptions/monthly-analysis/` existe com state conhecido | ✅ | este arquivo |
| 2 | `docs/specs/monthly-analysis.md` com `c2_validation:pass` + `c4_thresholds` | ✅ | spec v0.2.0 migrada em 2026-05-25 |
| 3 | `docs/clients/aicfo/baseline-cost-*.md` com `c3_check.status ∈ {viable, tight}` | ✅ | `viable` (ratio 0.089%) |
| 4 | `evals/{artifact_id}/runs/` com run recente (≤7d) e `status: pass` | ✅ | rota 6c — delegação ao `financial-qa-review`. Run: `evals/monthly-analysis/runs/2026-05-25-eval-0fcd35f0-monthly-analysis-shadow-gate.md` (100% pass, 10/10 cases adversariais) |
| 5 | `--approver_po` e `--approver_promotion_officer` declarados (roles distintos) | ⚠️ | founder-solo: Rafael nas duas roles — bypass `ACME_FORGE_BYPASS=incident:founder-solo-pre-team` registrado em §4 |
| 6 | Tracing configurado | ✅ | LangSmith via LangChain configurado em `src/observability/langfuse.ts` |

**Status global**: pre-conditions 1-4 + 6 ✅ satisfeitas (5 via bypass documentado). Pronto para executar `/acme:promote start_shadow` com flag `ACME_FORGE_BYPASS=incident:founder-solo-pre-team`.

---

## 3. Gate 4 — Eval suite E2E (resolvido via rota 6c em 2026-05-25)

### 3.1. Decisão tomada

Adotada **rota 6c**: delegação do gate SHADOW ao `financial-qa-review` (auditor determinístico do pipeline). Codex já havia criado 46 cases distribuídos em 4 sub-agentes do SKU (`normalization`, `narrative-synthesis`, `action-planning`, `financial-qa-review`); apenas o último tem runner totalmente conectado (`assertion_shape`).

### 3.2. Justificativa

O `financial-qa-review` audita o output E2E do pipeline contra 10 padrões adversariais conhecidos (number_mismatch, missing_doneWhen, contradiction, missing_evidence, unfounded_claim, fraud_overclaim, tax_overreach, implausible_impact, omission, review_need). Em 100% destes cases, o auditor:
- Marca `publishable: false` quando há defeito real
- Marca `publishable: true` quando o output está limpo

Para SHADOW (modo em que humano audita TODA análise antes do cliente ver), esta cobertura é suficiente: regressões serão detectadas pelo auditor antes do humano ter trabalho.

Para SHADOW → ASSISTED (modo em que cliente recebe a análise diretamente), exigir-se-á conectar runner para os outros 3 sub-agentes (out-of-scope desta sessão).

### 3.3. Run report

- SKU-level: [`evals/monthly-analysis/runs/2026-05-25-eval-0fcd35f0-monthly-analysis-shadow-gate.md`](../../evals/monthly-analysis/runs/2026-05-25-eval-0fcd35f0-monthly-analysis-shadow-gate.md)
- Sub-agente original: [`evals/monthly-analysis/financial-qa-review/runs/2026-05-25-eval-0fcd35f0-none.md`](../../evals/monthly-analysis/financial-qa-review/runs/2026-05-25-eval-0fcd35f0-none.md)
- Manifest com gate strategy: [`evals/monthly-analysis/manifest.json`](../../evals/monthly-analysis/manifest.json)

### 3.4. Rotas alternativas rejeitadas

| Rota | Descrição | Por que rejeitada |
|---|---|---|
| 6a | Criar ≥30 cases E2E novos com fixtures de DB completas | 46 cases já existem (Codex); custo de 3h+ injustificado |
| 6b | Manifest que agrega pass rates dos módulos do `src/` | Conceitualmente correto mas runner SKIPa 3 dos 4 sub-agentes — falsa segurança |

---

## 4. Gate 5 — Aprovação cruzada (decisão de design)

Por design constitucional, o gate 5 do `/acme:promote` requer `approver_po != approver_promotion_officer` (sem self-approval). Em projeto founder-solo, não há 2ª pessoa para assinar.

### 4.1. Decisão (2026-05-25): bypass com rationale documentado

```yaml
bypass:
  flag: "ACME_FORGE_BYPASS=incident"
  rationale: "founder-solo-pre-team"
  approved_by_implicit: "CEO Acme (single person — Rafael Novaes)"
  expires_at: "first hire of second technical/product person"
  audit_trail: "subscriptions/monthly-analysis/promotions.md (será criado ao executar promote)"
```

Esta exceção:
- Não dispensa nenhum dos outros 5 gates (C2, C3, SLA, eval, CI/CD se aplicável)
- Está **explicitamente registrada** para auditoria do DeepAgent
- Será revogada na primeira contratação técnica/product (quando alguém ≠ Rafael puder assinar como `approver_promotion_officer`)

### 4.2. Alternativa rejeitada: ADR formal (rota A3)

Considerada e rejeitada na sessão 2026-05-25: criar `solo_founder_exception` formal na Constitution v0.3.0 via ADR. Trade-off: limpa porém cara (mexer na Constitution + bump de versão + propagar para DeepAgent reviewer contract). Adiada até a primeira auditoria mensal flaggar este caso.

---

## 5. Histórico de transições (log)

Nenhuma transição executada. `subscriptions/monthly-analysis/promotions.md` será criado pelo primeiro `/acme:promote` que rodar.

---

## 6. Notas de governança

- **Source of truth** para outcome clause: `docs/specs/monthly-analysis.md` (hash `3b9278b7825aaa9e` checado por promote gate 1)
- **Source of truth** para c4_thresholds: `docs/specs/monthly-analysis.md` (hash `3a2e0f6f1f6d9644` checado por promote gate 3)
- **Source of truth** para c3_check: `docs/clients/aicfo/baseline-cost-monthly-analysis-2026-05-25.md` (status `viable` checado por promote gate 2)
- **Fonte humana** de SLA: `docs/onda-0/sla_threshold.md` (D6, aprovado CEO 2026-05-08)
- **Eval mais recente** referenciada: `evals/dre-narrative/runs/2026-05-25-eval-7e8c6af9-none.md` (gate do módulo dre-narrative em 93.8% — **não substitui** a suite E2E do SKU)

---

## 7. Próximos passos concretos

1. Decidir rota 6a vs 6b para suite E2E do SKU
2. Executar rota escolhida (criar cases ou manifest agregado)
3. Rodar `/acme:eval --module=monthly-analysis` (ou `--artifact_id=monthly-analysis`)
4. Verificar run report em `evals/monthly-analysis/runs/` com `status: pass`
5. Executar `/acme:promote monthly-analysis start_shadow --approver_po=rafael-novaes --approver_promotion_officer=rafael-novaes-acting-as-promotion-officer --bypass=ACME_FORGE_BYPASS=incident:founder-solo-pre-team`
6. Confirmar `subscriptions/monthly-analysis/promotions.md` criado com 6 gates `pass` e bypass de gate 5 auditado
7. Iniciar janela SHADOW de 14 dias com 5-10 tenants reais (recrutamento separado)
