---
sku_code: "{{ sku_code }}"
status: "draft"
constitution_version: "0.1.0"
linked_sku_spec: "src/skus/{{ sku_code }}/spec.md"
linked_onda_0_d5: "docs/onda-0/unit_economics.md"
created_at: "{{ YYYY-MM-DD }}"
last_updated: "{{ YYYY-MM-DD }}"
last_recalc_trigger: "{{ manual / hook unit-economics-recalc / monthly audit }}"
version: "0.1.0"
---

# Unit Economics — {{ sku_code }}

> **Princípio Constitution C3**: custo de inferência ≤ 25% do preço do outcome. Hard gate.
> Este documento é **regenerado** quando prompts mudam (hook `unit-economics-recalc`, Forge-4).

---

## 1. Inputs prévios (de §SKU Spec e Onda 0)

| Campo | Valor |
|---|---|
| **SKU code** | `{{ sku_code }}` |
| **Outcome unit** | `{{ ... }}` (de spec.md §1.1) |
| **Volume mensal estimado** | `{{ N }}` outcomes/cliente |
| **Baseline de custo do cliente** | R$ `{{ X }}` por outcome (método humano atual) |
| **Câmbio USD/BRL aplicado** | `{{ X }}` em `{{ YYYY-MM-DD }}` |

---

## 2. Estimativa de tokens por outcome

### 2.1. Modelo primário ({{ Claude Sonnet 4.6 }})

| Componente | Tokens médios | Cacheado? | Observações |
|---|---|---|---|
| System prompt + L0 (DNA/ICP/ofertas) | `{{ X }}` | ✅ ephemeral | Helper pattern BMAD reduz a 10% no input price |
| L1 (Tenant, Briefing) | `{{ X }}` | parcial | |
| L2 input (intake event) | `{{ X }}` | ❌ | |
| Tool call output (composer) | `{{ X }}` | ❌ | |
| **Total input por outcome** | `{{ X }}` | | |
| **Total output por outcome** | `{{ X }}` | | |

### 2.2. Modelo de fallback ({{ Haiku / GPT-4o-mini / DeepSeek }})

| Componente | Tokens médios |
|---|---|
| Total input | `{{ X }}` |
| Total output | `{{ X }}` |

---

## 3. Custo de inferência por outcome

> Pesquisar preços vigentes na data de preenchimento (Anthropic / OpenAI / DeepSeek).
> Câmbio fixado em §1.

### 3.1. Modelo primário

| Item | Cálculo | Valor (R$) |
|---|---|---|
| Input cacheado (10% do preço) | `tokens × preço_input × 0.1 × USD/BRL` | `{{ X }}` |
| Input não cacheado | `tokens × preço_input × USD/BRL` | `{{ X }}` |
| Output | `tokens × preço_output × USD/BRL` | `{{ X }}` |
| **Custo primário por outcome** | | **R$ `{{ X }}`** |

### 3.2. Modelo de fallback

| Item | Valor (R$) |
|---|---|
| Input | `{{ X }}` |
| Output | `{{ X }}` |
| **Custo fallback por outcome** | **R$ `{{ X }}`** |

### 3.3. Custo médio ponderado

> Mix de uso (ex: 70% primário, 30% fallback) × custo de cada.

`Custo médio: R$ {{ X }} por outcome`

---

## 4. Pricing proposto

### 4.1. Preço por outcome (variável)

| Campo | Valor |
|---|---|
| Baseline cliente (§1) | R$ `{{ X }}` |
| Desconto SaaS² (50–70% do baseline) | `{{ X }}%` |
| **Preço proposto por outcome** | **R$ `{{ X }}`** |
| Margem absoluta por outcome | R$ `{{ X }}` |
| Margem % por outcome | `{{ X }}%` |

### 4.2. Preço fixo de plataforma (mensal)

| Campo | Valor |
|---|---|
| Faixa metodológica | R$ 1.500–4.000/mês |
| **Preço proposto** | **R$ `{{ X }}`/mês** |
| O que cobre | Infra (Langfuse, Postgres, hosting), suporte, observability |

### 4.3. Cap mensal (opcional)

`{{ Sem cap / Cap em R$ X / Cap em N outcomes }}`

**Justificativa**: {{ ... }}

### 4.4. Setup fee (one-time)

`R$ {{ X }}` (faixa metodológica: R$ 8.000–25.000)

**Cobre**: configuração de canal, TenantContext, BaselineCost, primeiros 14 dias em SHADOW.

---

## 5. Validação da regra C3 (custo ≤ 25% do preço)

| Métrica | Valor | Pass / Fail |
|---|---|---|
| Custo por outcome (§3.3) | R$ `{{ X }}` | |
| Preço por outcome (§4.1) | R$ `{{ X }}` | |
| **Razão custo/preço** | `{{ X }}%` | {{ ✅ ≤25% / ❌ }} |

**Se ❌**: revisar prompts (reduzir tokens), trocar modelo, ou aumentar preço. **Não prosseguir** até passar.

---

## 6. Projeção mensal por cliente

| Métrica | Cálculo | Valor |
|---|---|---|
| Outcomes/mês esperados | (§1) | `{{ N }}` |
| Receita variável | `outcomes × preço_outcome` | R$ `{{ X }}` |
| Receita fixa | (§4.2) | R$ `{{ X }}` |
| **Receita total/cliente/mês** | variável + fixa | R$ `{{ X }}` |
| Custo de inferência total | `outcomes × custo_outcome` | R$ `{{ X }}` |
| **Margem bruta/cliente/mês** | receita − custo inferência | R$ `{{ X }}` |
| Margem % | | `{{ X }}%` |

---

## 7. Projeção 10 clientes (alvo da metodologia)

| Métrica | Valor |
|---|---|
| Receita mensal recorrente (10 clientes) | R$ `{{ X }}` |
| Custo de inferência mensal | R$ `{{ X }}` |
| Margem bruta agregada | R$ `{{ X }}` |
| Margem % agregada | `{{ X }}%` |

> Meta: ≥ 70% de margem bruta agregada. SaaS² maduro fica entre 70–85%.

---

## 8. Cross-check com produção (preenchido pelo reviewer mensal)

| Métrica | Esperado | Real (últimos 30d) | Drift |
|---|---|---|---|
| Tokens médios in/out | `{{ X / Y }}` | `{{ X / Y }}` | `{{ ±%}}` |
| Custo médio por outcome | R$ `{{ X }}` | R$ `{{ X }}` | `{{ ±%}}` |
| Razão custo/preço | `{{ X }}%` | `{{ X }}%` | `{{ ±pp }}` |

> Drift > 15% em qualquer métrica → reviewer abre issue P1.

---

## 9. Trigger de recálculo

Este documento é **regenerado** quando:

- Prompt em `src/skus/{{ sku_code }}/prompts/**` muda
- Modelo padrão da camada `src/llm/` muda
- Câmbio USD/BRL muda > 5%
- Auditoria mensal detecta drift > 15%

Hook responsável: `unit-economics-recalc` (Forge-4).

---

## 10. Aprovação

- [ ] §2 a §6 todos preenchidos com valores reais
- [ ] §5 PASSA (custo ≤ 25%)
- [ ] §7 margem bruta projetada ≥ 70%
- [ ] CEO assina pricing como base contratual

**Aprovado por**: `[ nome ]` em `[ data ]`

---

## Histórico

| Versão | Data | Mudança | Trigger |
|---|---|---|---|
| 0.1.0 | {{ YYYY-MM-DD }} | Versão inicial | manual |
