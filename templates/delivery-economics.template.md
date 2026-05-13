---
$schema: "templates/delivery-economics.template.md"
artifact_id: "{{ module_id | sku_code }}"
project_type: "platform"                 # platform | automation | hybrid | agentic_saas
ai_enabled: false                         # true: usa também unit-economics.md (cost_per_outcome); false: só este arquivo
economics_model: "platform_margin"        # cost_per_outcome | platform_margin | hybrid
client_id: "{{ cliente }}"
period_month: "{{ YYYY-MM }}"
linked_spec: "docs/specs/{{ artifact_id }}.md"
linked_diagnostic: "docs/clients/{{ cliente }}/diagnostic-{{ artifact_id }}.md"
linked_unit_economics: null               # se ai_enabled=true: docs/clients/.../unit-economics-{{ id }}.md
constitution_version: "0.3.0"
created_at: "{{ YYYY-MM-DD }}"
last_updated: "{{ YYYY-MM-DD }}"
last_recalculated_at: "{{ YYYY-MM-DD }}"
recalc_required: false
version: "0.1.0"
---

# Delivery Economics — {{ artifact_id }} ({{ period_month }})

> **Princípio Constitution C3** (v0.3.0): viabilidade econômica. Para módulos com `ai_enabled=false`, este arquivo substitui (ou complementa) o `unit-economics.md`. Limite default: razão custo/receita ≤ 25%.

> Este arquivo é lido pelo reviewer DeepAgent (check `C3.platform.*`) e pelo `/acme:promote` (Gate 2 do gate-set platform).

---

## 1. Modelo de custo aplicado

| Aspecto | Valor |
|---|---|
| `economics_model` | `platform_margin` |
| Aplica quando | `ai_enabled=false` em projeto `platform` ou `automation` |
| Limite default | `cost_to_price_ratio_max` = 25% (configurável em `project.json`) |
| Drift threshold | mês N / N-1 ≤ 1.15 |

> Para módulos com `ai_enabled=true`, complementar com `unit-economics.md` (modelo `cost_per_outcome`). O `delivery-economics.md` continua sendo a visão consolidada.

---

## 2. Custos mensais alocados ao módulo

### 2.1. Infraestrutura

| Recurso | Provedor | Custo mensal | % alocado a este módulo | Custo atribuído |
|---|---|---|---|---|
| Compute (CPU/RAM) | {{ AWS / GCP / Azure / on-prem }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| Banco de dados | {{ provedor }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| Storage / S3 | {{ provedor }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| Mensageria / Queue | {{ provedor }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| CDN / Edge | {{ provedor }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| Observabilidade (logs/metrics/errors) | {{ provedor }} | R$ {{ X }} | {{ Y% }} | R$ {{ Z }} |
| **Subtotal infra** | | | | **R$ {{ Σ_infra }}** |

### 2.2. Suporte

| Item | Esforço mensal (h) | Custo-hora | Custo total |
|---|---|---|---|
| Atendimento de tickets | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| Onboarding/treinamento de usuários | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| Resolução de incidentes (P0/P1) | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| **Subtotal suporte** | | | **R$ {{ Σ_suporte }}** |

### 2.3. Manutenção (devs alocados pro-rata)

| Item | Esforço mensal (h) | Custo-hora | Custo total |
|---|---|---|---|
| Bugfixes | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| Pequenas evoluções dentro do escopo | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| Refactor / dívida técnica | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| Code review / QA | {{ N }} h | R$ {{ X }}/h | R$ {{ Z }} |
| **Subtotal manutenção** | | | **R$ {{ Σ_manutencao }}** |

### 2.4. Custo IA (somente se `ai_enabled=true` para este módulo)

| Categoria | Tokens médios | Custo médio por outcome | Volume mês | Custo total |
|---|---|---|---|---|
| Inferência primária | {{ in/out }} | R$ {{ X }} | {{ N }} | R$ {{ Z }} |
| Fallback | {{ in/out }} | R$ {{ X }} | {{ N }} | R$ {{ Z }} |
| **Subtotal IA** | | | | **R$ {{ Σ_ia }}** |

> Detalhe completo do componente IA em `unit-economics-{{ id }}.md`.

### 2.5. Custo total

| Componente | Valor |
|---|---|
| Infra | R$ {{ Σ_infra }} |
| Suporte | R$ {{ Σ_suporte }} |
| Manutenção | R$ {{ Σ_manutencao }} |
| IA (se aplicável) | R$ {{ Σ_ia }} |
| **TOTAL** | **R$ {{ Σ_total }}** |

---

## 3. Receita atribuída ao módulo

| Origem | Valor mensal |
|---|---|
| Mensalidade fixa (parcela atribuída) | R$ {{ X }} |
| Setup amortizado (12 meses) | R$ {{ X }} |
| Receita variável por outcome (se aplicável) | R$ {{ X }} |
| **Receita total atribuída** | **R$ {{ Σ_receita }}** |

**Critério de atribuição**: {{ ex: módulo crítico — 30% da mensalidade; secundário — 10%; documentar racional }}.

---

## 4. Razão custo/receita (C3.platform.2)

```
ratio = Σ_total / Σ_receita = {{ X }} / {{ Y }} = {{ Z }}
```

| Métrica | Valor | Limite | Status |
|---|---|---|---|
| Razão custo/receita | {{ X% }} | ≤ 25% | ✅ / ❌ |

**Ratio status** ∈ {`viable` (≤ 20%), `tight` (20-25%), `unviable` (> 25%)}.

---

## 5. Comparação histórica

| Mês | Custo total | Receita atribuída | Razão | Status |
|---|---|---|---|---|
| N-2 | R$ {{ X }} | R$ {{ Y }} | {{ Z% }} | ✅/❌ |
| N-1 | R$ {{ X }} | R$ {{ Y }} | {{ Z% }} | ✅/❌ |
| **N (este)** | **R$ {{ X }}** | **R$ {{ Y }}** | **{{ Z% }}** | **✅/❌** |

**Drift custo/receita N vs N-1**: ratio = {{ valor }} (limite 1.15) → ✅/❌

---

## 6. Notas e premissas

- {{ Premissa de alocação de infra: ex: 30% baseado em consumo medido pelo APM }}
- {{ Premissa de manutenção: ex: 1 dev sênior 20% do tempo durante sprints }}
- {{ Riscos identificados: ex: dependência de provedor X com fee variável }}

---

## 7. Recomendações

- {{ ex: renegociar contrato de infra para consumo elástico }}
- {{ ex: automatizar tickets recorrentes para reduzir suporte }}
- {{ ex: revisar SLA com cliente — receita atual não suporta nível atual de manutenção }}

---

## 8. Aprovação

- [ ] PO revisou e aprovou a alocação
- [ ] Financeiro confirmou receita atribuída
- [ ] Tech Lead confirmou custos de manutenção
- [ ] Recálculo agendado para próximos 90 dias

---

## Histórico do template

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-08 | Versão inicial — Forge-9 (delivery-type agnostic) |
