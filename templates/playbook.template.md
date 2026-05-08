# Playbook Vertical — {{ Nome do Vertical }}

> **Template do Forge** — projeto consumidor adapta isto como `docs/playbooks/{vertical}/playbook.md`.
> **Origem**: `templates/playbook.template.md` v0.1.0 do `agent-governance-framework`.

---

## Identificação

| Campo | Valor |
|---|---|
| **Vertical** | `{{ ex: financeiro, saúde, educacional, imobiliário }}` |
| **Criado em** | `{{ data }}` |
| **Atualizado em** | `{{ data }}` |
| **Forge version** | `{{ x.y.z }}` |
| **Cliente origem** (1º AUTONOMOUS) | `{{ client_id }}` |
| **SKUs de origem** | `{{ lista de SKUs que geraram este playbook }}` |

---

## Objetivo

> Documentar os blocos reutilizáveis, padrões de integração e lições aprendidas do vertical
> para que o **cliente 2 do mesmo vertical custe ≤30% do esforço do cliente 1**.

**Meta de reutilização**: `{{ X% dos blocos identificados abaixo }}` aproveitáveis sem modificação.

---

## Blocos reutilizáveis

> Bloco = skill, prompt, eval seed, adapter, ou configuração que pode ser copiada diretamente
> para o próximo cliente do mesmo vertical, com mínima adaptação.

### Tier 1 — Contexto estratégico

| Bloco | Path | Confiança de reutilização | Adaptação necessária |
|---|---|---|---|
| DNA da organização | `{{ path }}` | `alta / média / baixa` | `{{ o que muda por cliente }}` |
| ICP do vertical | `{{ path }}` | `alta / média / baixa` | `{{ segmentos, anti-ICP específico }}` |
| Catálogo de ofertas base | `{{ path }}` | `alta / média / baixa` | `{{ precificação, nomes de SKUs }}` |

### Tier 2 — Operação tática

| Bloco | Path | Confiança | Adaptação |
|---|---|---|---|
| Baseline de custo | `{{ path }}` | `{{ }}` | `{{ volume/hora por cliente }}` |
| Mapa de processo padrão | `{{ path }}` | `{{ }}` | `{{ variações de fluxo }}` |

### Tier 3 — Execução operacional

| Bloco | Path | Confiança | Adaptação |
|---|---|---|---|
| System prompt base | `{{ path }}` | `{{ }}` | `{{ seção 1 (role), seção 8 (tenantId) }}` |
| Eval seed (30+ casos) | `{{ path }}` | `{{ }}` | `{{ outcome_category, adversarial }}` |
| Adapter LLM | `{{ path }}` | `{{ }}` | `{{ modelo, parâmetros }}` |
| TenantContext schema | `{{ path }}` | `{{ }}` | `{{ campos específicos do vertical }}` |

---

## Padrões de integração do vertical

### Padrão de trigger

```
{{ ex: webhook WhatsApp → agent → resposta estruturada em JSON → CRM }}
```

Variações observadas:
- `{{ variação 1 }}`
- `{{ variação 2 }}`

### Padrão de tenantização

```typescript
// Campos obrigatórios no TenantContext deste vertical:
interface VerticalTenantContext {
  tenantId: string;
  {{ campos específicos do vertical — ex: especialidade_medica, faixa_renda_icp }}
}
```

### Padrão de instrumentação (C6)

```
observe(langfuse, {
  name: "{{ vertical }}-sku-{{ operação }}",
  metadata: { tenantId, {{ campos de contexto relevantes para auditoria }} }
})
```

---

## Padrões de eval do vertical

| outcome_category | Volume típico | Casos adversariais comuns |
|---|---|---|
| `{{ categoria 1 }}` | `{{ N casos }}` | `{{ ex: boundary condition, spam, injection }}` |
| `{{ categoria 2 }}` | `{{ N casos }}` | `{{ }}` |

**Seed de eval compartilhada**: `{{ path para evals/ de referência }}`

---

## Métricas de esforço

### Cliente 1 (referência)

| Fase | Horas reais |
|---|---|
| `/acme:diagnose` | `{{ h }}` |
| `/acme:spec` + `/acme:unit-economics` | `{{ h }}` |
| `/acme:plan` + `/acme:tasks` + `/acme:implement` | `{{ h }}` |
| `/acme:eval` (seed + calibração) | `{{ h }}` |
| SHADOW ({{ N dias }}) | `{{ h de monitoramento }}` |
| `/acme:promote` | `{{ h }}` |
| **Total** | **`{{ total h }}`** |

### Cliente 2 (estimativa com playbook)

| Fase | Horas estimadas | % cliente 1 |
|---|---|---|
| `/acme:diagnose` | `{{ h }}` | `{{ % }}` |
| Spec + economics (reutiliza blocos Tier 1) | `{{ h }}` | `{{ % }}` |
| Implement (reutiliza prompts + adapters) | `{{ h }}` | `{{ % }}` |
| Eval (reutiliza seed 70%) | `{{ h }}` | `{{ % }}` |
| SHADOW + promote | `{{ h }}` | `{{ % }}` |
| **Total estimado** | **`{{ total h }}`** | **`{{ % — meta: ≤30% }}`** |

---

## Lições aprendidas

### O que funcionou bem

1. `{{ lição 1 }}`
2. `{{ lição 2 }}`

### O que não funcionou / pegadinhas do vertical

1. `{{ problema 1 — ex: volume de mensagens invalida assunção de latência }}` — mitigação: `{{ }}`
2. `{{ problema 2 }}` — mitigação: `{{ }}`

### Adaptações obrigatórias por cliente (não reutilizável direto)

- `{{ ex: seção 1 do prompt (role/persona) — sempre adaptar para identidade do cliente }}` 
- `{{ ex: anti-ICP — cada cliente tem leads não-qualificados diferentes }}`
- `{{ ex: SLA thresholds — variam por volume do cliente }}`

---

## Retrospectiva de validação

| Critério | Cliente 1 | Meta cliente 2 | Status |
|---|---|---|---|
| Horas totais | `{{ N h }}` | ≤ `{{ 30% de N h }}` | `{{ pendente / atingido }}` |
| SHADOW pass rate | `{{ % }}` | ≥ `{{ SLA threshold }}` | `{{ }}` |
| C3 compliance | `{{ % custo/preço }}` | ≤ 25% | `{{ }}` |

---

## Aprovação do playbook

**Criado por**: `{{ nome }}` em `{{ data }}`
**Validado com cliente 2**: `{{ nome cliente }}` em `{{ data }}`
**Forge version**: `{{ x.y.z }}`

---

## Histórico

| Data | Mudança | Quem |
|---|---|---|
| `{{ data }}` | Criação inicial a partir do cliente 1 em AUTONOMOUS | `{{ nome }}` |
| `{{ data }}` | Validação com cliente 2 — esforço real medido | `{{ nome }}` |
