---
$schema: "templates/platform-acceptance-report.template.md"
module_id: "{{ module_id }}"
project_type: "platform"
ai_enabled: false
report_type: "acceptance-report"
target_state: "CANONICAL"                # estado-alvo após este aceite
linked_spec: "docs/specs/{{ module_id }}.md"
linked_pilot_state: "docs/specs/{{ module_id }}.pilot-state.md"
linked_diagnostic: "docs/clients/{{ cliente }}/diagnostic-{{ module_id }}.md"
linked_e2e_tests_report: "tests/e2e/reports/{{ module_id }}-{{ date }}.json"
sample_window_start: "{{ YYYY-MM-DD }}"
sample_window_end: "{{ YYYY-MM-DD }}"
sample_size: {{ N }}
sample_pct_of_total: {{ X }}
constitution_version: "0.3.0"
generated_at: "{{ ISO8601 }}"
generated_by: "{{ /novais-digital:promote || mantenedor manual }}"
version: "0.1.0"
---

# Acceptance Report — {{ module_name }}

> Este documento é o **registro formal de aceite humano** que substitui (em projetos `platform` / `automation`) a eval suite + shadow-mode-runner usada em `agentic_saas`. Lido pelo gate C4.platform.3 do reviewer DeepAgent e pelo `/novais-digital:promote` antes de promover para CANONICAL.

> Para módulos com `criticality: critical`, exige assinatura do decisor do cliente (`signature_hash`).

---

## 1. Cláusula de outcome verificada

> Citação literal da §1 do [`docs/specs/{{ module_id }}.md`](./{{ module_id }}.md):

```
{{ frase do outcome operacional }}
```

**Hash da cláusula no momento do aceite**: `{{ sha256:16 }}`
(deve coincidir com `outcome_clause_hash` da spec — drift = invalidação do aceite)

---

## 2. Resultados por categoria de ação

| Categoria | Casos amostrados | Pass | Fail | Pass rate | Threshold contratado | Status |
|---|---|---|---|---|---|---|
| `{{ acao-1 }}` | {{ N }} | {{ N }} | {{ N }} | {{ X% }} | ≥ {{ Y% }} | ✅ / ❌ |
| `{{ acao-2 }}` | {{ N }} | {{ N }} | {{ N }} | {{ X% }} | ≥ {{ Y% }} | ✅ / ❌ |
| `{{ acao-3 }}` | {{ N }} | {{ N }} | {{ N }} | {{ X% }} | ≥ {{ Y% }} | ✅ / ❌ |

**Pass rate agregado** (média ponderada por volume): **{{ X% }}** {{ ✅ acima de threshold / ❌ }}

---

## 3. Sample de evidências

> 5-10% dos cenários executados no PILOT, escolhidos aleatoriamente, com evidência amostrada.

### Caso 1 — `{{ acao-x }}` — PASS / FAIL

- Cenário executado: {{ descrição }}
- Ator: {{ user_id ou role }}
- Timestamp: {{ ISO8601 }}
- **Asserções funcionais**:
  - [x] HTTP 200 em endpoint X
  - [x] Row criada em `tabela_y` com campos esperados
  - [x] Audit log entry `Module.Action.Completed` com `actor_id`, `payload`, `resource_id`
- **Avaliação humana**: {{ aprovado / aprovado-com-observação / rejeitado }}
- **Observação do avaliador** (se houver): {{ ... }}

### Caso 2 — ...

(seção análoga)

---

## 4. Bugs e edge cases encontrados em PILOT

| ID | Descrição | Severidade | Status | Resolução |
|---|---|---|---|---|
| BUG-001 | {{ ... }} | {{ critical/major/minor }} | {{ open/fixed/wontfix }} | {{ link PR ou justificativa }} |

**Critério para CANONICAL**: zero bugs `critical` ou `major` abertos. Bugs `minor` aceitáveis se documentados.

---

## 5. Audit log integrity (C6.platform)

| Métrica | Valor | Status |
|---|---|---|
| Mutações críticas em DB durante a janela | {{ N }} | — |
| Entradas correspondentes no audit log | {{ N }} | — |
| **Desvio** | {{ X% }} | ≤ 1% ✅ / > 1% ❌ |
| Audit log entries com `actor_id` ausente | {{ N }} | 0 ✅ / > 0 ❌ |
| Audit log entries com `payload` truncado/null | {{ N }} | 0 ✅ / > 0 ❌ |

---

## 6. Custo / margem (C3.platform)

> Detalhe completo em [`delivery-economics-{{ module_id }}.md`](../clients/{{ cliente }}/delivery-economics-{{ module_id }}.md).

| Métrica | Valor | Limite |
|---|---|---|
| (infra + suporte + manutenção) / receita atribuída | {{ X% }} | ≤ 25% |
| Drift mês N vs N-1 | {{ ratio }} | ≤ 1.15 |

---

## 7. Aprovações

### 7.1. PO

- **Nome / role**: {{ ... }}
- **Aprovou em**: {{ ISO8601 }}
- **Signature hash**: `{{ sha256:16 }}`
- **Observações**: {{ ... }}

### 7.2. Tech Lead

- **Nome / role**: {{ ... }}
- **Aprovou em**: {{ ISO8601 }}
- **Signature hash**: `{{ sha256:16 }}`
- **Observações**: {{ ... }}

### 7.3. Decisor do cliente (obrigatório se `criticality: critical`)

- **Nome / role**: {{ ... }}
- **Empresa**: {{ ... }}
- **Aprovou em**: {{ ISO8601 }}
- **Signature hash**: `{{ sha256:16 }}`
- **Documento de aceite anexado**: {{ link / referência ao contrato }}

---

## 8. Recomendação final

✅ **APROVADO PARA CANONICAL** — todos os gates pass, sem bugs críticos abertos, custo viável, audit log íntegro.
❌ **BLOQUEADO** — pendências em §{{ X }}: {{ detalhes }}. Reabrir aceite após correções.
🔄 **APROVADO COM RESSALVAS** — promovido com plano de mitigação para issues `minor` documentadas; revisão em {{ N }} dias.

---

## Histórico do template

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-08 | Versão inicial — Foundry-9 (delivery-type agnostic) |
