---
$schema: "templates/platform-pilot-state.template.md"
module_id: "{{ module_id }}"
project_type: "platform"
ai_enabled: false
log_format: "append-only"
current_state: "DRAFT"                   # DRAFT | STAGING | PILOT | CANONICAL | DEPRECATED
criticality: "standard"                  # critical | standard | simple
total_transitions: 0
linked_spec: "docs/specs/{{ module_id }}.md"
linked_acceptance_report: "docs/specs/{{ module_id }}.acceptance-report.md"
linked_diagnostic: "docs/clients/{{ cliente }}/diagnostic-{{ module_id }}.md"
constitution_version: "0.3.0"
created_at: "{{ YYYY-MM-DD }}"
last_updated: "{{ YYYY-MM-DD }}"
---

# Pilot State — {{ module_id }}

> **Append-only**. Cada transição entre estados (DRAFT → STAGING → PILOT → CANONICAL → DEPRECATED) é registrada como nova seção no topo. Não editar transições anteriores.

> Este arquivo é a **versão platform** de `subscriptions/{id}/promotions.md` (que existe para `agentic_saas`). Lido pelo `/novais-digital:promote` com `to_mode` ∈ {to_staging, to_pilot, to_canonical, to_deprecated, rollback} e pelo reviewer DeepAgent (check C4.platform.1).

---

## Janela mínima por criticidade (C4 — Constitution v0.3.0)

| Criticality | Janela mínima em PILOT antes de CANONICAL | Aceite humano exigido |
|---|---|---|
| `critical` (financeiro, contrato, LGPD, integração transacional) | **≥ 14 dias** | Decisor formal + `acceptance-report.md` assinado + signature_hash |
| `standard` | ≥ 7 dias | PO + acceptance-report.md |
| `simple` (CRUD interno, sem efeito financeiro) | ≥ 3 dias | Aceite registrado em PR/issue |

---

## Transition N — {{ YYYY-MM-DD }} — {{ from_state }} → {{ to_state }}

- **Triggered by**: `/novais-digital:promote --module_id={{ id }} --to_mode={{ to_state }}`
- **Approver(s)**:
  - PO: `{{ nome / role }}` (signature_hash: `{{ sha256:16 }}`)
  - Tech Lead: `{{ nome / role }}` (signature_hash: `{{ sha256:16 }}`)
  - Decisor cliente (se `criticality: critical`): `{{ nome / role }}` (signature_hash: `{{ sha256:16 }}`)
- **Approved at**: {{ ISO8601 }}

### Gates rodados

| Gate | Status | Evidência |
|---|---|---|
| C1 — diagnostic linkado | ✅/❌ | `docs/clients/.../diagnostic-{{ id }}.md` |
| C2 — outcome clause + critério de aceite | ✅/❌ | `docs/specs/{{ id }}.md §1` |
| C3 — delivery-economics ratio ≤ 25% | ✅/❌ | `docs/clients/.../delivery-economics-{{ id }}.md` |
| C4.platform.4 — testes E2E ≤ 7d | ✅/❌ | `tests/e2e/reports/{{ id }}-{{ date }}.json` |
| C4.platform.3 — acceptance-report.md assinado | ✅/❌ | `docs/specs/{{ id }}.acceptance-report.md` |
| C4.platform.2 — janela mínima cumprida | ✅/❌ | dias em estado anterior: {{ N }} |
| C6.platform.1/2 — audit log cobrindo mutações críticas | ✅/❌ | sample 5-10% dos últimos N dias |
| C7.platform.1/2 — sem SDKs fora da camada | ✅/❌ | grep result |
| C8.common.1 — sem hardcode por tenant | ✅/❌ | grep result |

### Métricas operacionais durante o estado anterior

| Métrica | Janela | Valor | Threshold contratado |
|---|---|---|---|
| Aceite humano por sample | {{ window_days }}d | {{ X% }} | ≥ {{ Y% }} |
| Erros 5xx | {{ window_days }}d | {{ N }} | ≤ {{ M }} |
| Latência p95 | {{ window_days }}d | {{ ms }}ms | ≤ {{ target }}ms |
| Audit log gap (mutações sem entry) | {{ window_days }}d | {{ N }} | 0 |
| Bug rate por sprint | {{ window_days }}d | {{ N }} | ≤ {{ M }} |
| Recursos consumidos vs budget | {{ window_days }}d | {{ X% }} | ≤ 100% |

### Findings durante o estado anterior

- {{ achado 1 — bug, edge case, feedback do PILOT, etc. }}
- {{ achado 2 }}

### Recomendação

✅ **PROMOVER** para {{ to_state }} — todos os gates pass + janela cumprida.
❌ **BLOQUEAR** — gates {{ X }} falhando: {{ detalhes }}.
🔄 **ESTENDER** janela em {{ N }} dias — necessidade de mais sample.

### Rollback plan (caso necessário)

- Comando: `/novais-digital:promote --module_id={{ id }} --to_mode=rollback --rollback_reason={{ enum }}`
- Estado-alvo: {{ estado anterior estável }}
- Migração de dados: {{ se aplicável }}

---

## Transition N-1 — {{ YYYY-MM-DD }} — {{ from_state }} → {{ to_state }}

(seção análoga acima)

---

## Histórico do template

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-08 | Versão inicial — Foundry-9 (delivery-type agnostic) |
