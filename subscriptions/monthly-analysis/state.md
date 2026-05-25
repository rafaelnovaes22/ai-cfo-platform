---
subscription_id: "monthly-analysis"
artifact_id: "monthly-analysis"
artifact_type: "product"
client_id: "aicfo"
project_type: "agentic_saas"
ai_enabled: true
mode: "none"
mode_history: []
started_at: null
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
mode: none                    # ∈ {none, shadow, assisted, autonomous}
started_at: null              # será preenchido ao executar /acme:promote start_shadow
last_transition_at: null
days_in_current_mode: 0
total_outcomes_delivered: 0   # ZERO porque mode=none (não há entrega ao cliente final ainda)
```

---

## 2. Pré-conditions checklist (para `/acme:promote start_shadow`)

| # | Pre-condition | Estado | Evidência |
|---|---|---|---|
| 1 | `subscriptions/monthly-analysis/` existe com state conhecido | ✅ | este arquivo |
| 2 | `docs/specs/monthly-analysis.md` com `c2_validation:pass` + `c4_thresholds` | ✅ | spec v0.2.0 migrada em 2026-05-25 |
| 3 | `docs/clients/aicfo/baseline-cost-*.md` com `c3_check.status ∈ {viable, tight}` | ✅ | `viable` (ratio 0.089%) |
| 4 | `evals/{artifact_id}/runs/` com run recente (≤7d) e `status: pass` | ❌ | suite E2E do SKU **ainda não criada**; ver §3 |
| 5 | `--approver_po` e `--approver_promotion_officer` declarados (roles distintos) | ⚠️ | founder-solo: Rafael nas duas roles — bypass `ACME_FORGE_BYPASS=incident:founder-solo-pre-team` registrado em §4 |
| 6 | Tracing configurado | ✅ | LangSmith via LangChain configurado em `src/observability/langfuse.ts` |

**Status global**: bloqueado em pre-condition #4 (suite E2E ausente).

---

## 3. Gate 4 — Eval suite E2E (decisão pendente)

A eval suite atualmente cobre **módulos individuais** (`dre-narrative` 93.8%, `classification` 87.5-100% por modelo, `action-plan` em iteração). Falta uma suite **E2E do SKU** que valide a composição.

### 3.1. Opções discutidas (sessão 2026-05-25)

| Rota | Descrição | Custo | Rigor Forge |
|---|---|---|---|
| **6a** | Criar ≥30 cases E2E novos em `evals/monthly-analysis/cases/` com fixtures de DB completas | Alto (3+ horas de design) | Máximo (literal C4) |
| **6b** | Criar `evals/monthly-analysis/manifest.json` que **agrega** pass rates dos módulos como proxy do SKU | Médio | Aceitável (interpretação composicional) |

**Decisão**: pendente. Atualmente bloqueia transição `start_shadow`.

### 3.2. Próxima sessão

Quando retomar:
- Decidir rota 6a vs 6b
- Executar a rota escolhida
- Re-rodar `/acme:promote start_shadow` com bypass do gate 5 (ver §4)

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
