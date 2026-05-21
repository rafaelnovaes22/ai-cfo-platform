---
audit_date: "{{ YYYY-MM-DD }}"
audit_period: "{{ YYYY-MM }}"
reviewer: "deepagent-gpt-5.5"
constitution_version: "0.2.0"
manifest_version: "{{ X.Y.Z }}"
project: "{{ nome do projeto consumidor }}"
artifacts_audited: 0
outcomes_sampled: 0
overall_status: "pass|warn|fail"
version: "0.1.0"
---

# Auditoria Mensal — {{ project }} — {{ audit_period }}

> Output do reviewer DeepAgent / GPT-5.5.
> Estrutura segue [`reviewer/output-schema.json`](../reviewer/output-schema.json).
> Detalhes do contrato em [`docs/forge/reviewer-contract.md`](../docs/forge/reviewer-contract.md).

---

## 1. Resumo executivo

| Eixo | Status | Detalhe |
|---|---|---|
| Constitution C1–C8 | {{ X PASS, Y WARN, Z FAIL }} | Detalhe em §3 |
| SLA mensal agregado | {{ ✅/⚠️/❌ }} | {{ X% }} (threshold {{ Y% }}) |
| Drift detectado | {{ ✅ Não / ⚠️ Sim }} | {{ se sim, descrever }} |
| Coerência artefatos ↔ código | {{ ✅/⚠️/❌ }} | {{ ... }} |
| Issues abertas pelo reviewer | {{ N }} | Detalhe em §6 |

**Veredito geral**: `{{ overall_status }}`

---

## 2. Escopo da auditoria

| Item | Quantidade |
|---|---|
| Artefatos lidos do manifest | {{ N }} |
| SKUs/produtos em produção auditados | {{ N }} |
| Outcomes amostrados (5–10%) | {{ N }} |
| Eval cases re-rodados | {{ N }} |
| Período de outcomes considerado | {{ últimos 30 dias }} |

Manifest de referência: `{{ manifest_version }}` (sha256 `{{ ... }}`)

---

## 3. Detalhamento por princípio (C1–C8)

### C1 — Diagnose-before-design

**Status**: {{ ✅ PASS / ⚠️ WARN / 🔴 FAIL }}

**Evidência**:
- {{ ex: 3/3 SKUs em produção têm diagnostic.md correspondente }}
- {{ exceção: produto X marcado is_example: true conforme regra de exceção }}

**Issues abertas**: {{ nenhuma / lista de IDs }}

---

### C2 — Outcome-first

**Status**: {{ ... }}

**Evidência**:
- {{ ex: 3/3 specs têm seção 'Cláusula de outcome' completa }}
- {{ ex: outputs do código batem com schema declarado em 95% dos casos amostrados }}

**Issues abertas**: {{ ... }}

---

### C3 — Cost ≤ 25% of price

**Status**: {{ ... }}

**Evidência**:
- SKU `{{ x }}`: razão custo/preço documentada {{ Y% }}, real (Langfuse 30d) {{ Z% }} → {{ ✅/⚠️ }}
- SKU `{{ y }}`: ...
- Drift de custo (mês N vs N-1): {{ +/- X% }}

**Issues abertas**: {{ ... }}

---

### C4 — SHADOW antes de cobrar

**Status**: {{ ... }}

**Evidência**:
- Promoções no período: {{ N }} (de SHADOW→ASSISTED, de ASSISTED→AUTONOMOUS)
- Todas as promoções tiveram gates passing? {{ Sim/Não }}
- Subscriptions em modo SHADOW por {{ N }} dias antes de promover (regra ≥ 14d): {{ ✅/⚠️ }}

**Issues abertas**: {{ ... }}

---

### C5 — Three-tier context

**Status**: {{ ... }}

**Evidência**:
- {{ N }} skills declaram tier no frontmatter
- {{ M }} violações detectadas (Tier 1 lendo Tier 2/3)
- Cache hit rate em Tier 1 (helper pattern): {{ X% }}

**Issues abertas**: {{ ... }}

---

### C6 — Telemetry-by-default

**Status**: {{ ... }}

**Evidência**:
- Outcomes no DB: {{ N }}
- Traces correspondentes em Langfuse: {{ M }}
- Desvio: {{ +/- X% }} ({{ ✅ ≤ 1% / ⚠️ > 1% / 🔴 > 5% }})

**Issues abertas**: {{ ... }}

---

### C7 — Portability over lock-in

**Status**: {{ ... }}

**Evidência**:
- Imports de SDK LLM fora da camada de abstração: {{ N arquivos }}
- {{ se 0: PASS; se >0 listar }}

**Issues abertas**: {{ ... }}

---

### C8 — Anti-customização heroica

**Status**: {{ ... }}

**Evidência**:
- Ocorrências de `if (tenantId === '...')` em código de produção: {{ N }}
- Pastas `clients/{nome}/` em src/: {{ N }}
- Configuração via TenantContext: {{ X tenants ativos }}

**Issues abertas**: {{ ... }}

---

## 4. Coerência entre artefatos

### 4.1. Spec ↔ código

| SKU/Produto | Spec versão | Código corresponde? | Notas |
|---|---|---|---|
| {{ x }} | {{ 1.2.0 }} | {{ ✅/⚠️ }} | {{ ... }} |

### 4.2. Spec ↔ eval suite

| SKU/Produto | Categorias da spec | Categorias em eval | Coverage |
|---|---|---|---|
| {{ x }} | {{ A, B, C }} | {{ A, B }} | ⚠️ Falta C |

### 4.3. ADR ↔ implementação

| ADR | Decisão | Reflete em código? | Drift? |
|---|---|---|---|
| {{ 001 }} | {{ Stack X }} | {{ ✅/⚠️ }} | {{ ... }} |

---

## 5. Outcomes amostrados (auditoria de qualidade)

Amostra de {{ N }} outcomes (5–10% do mês), distribuídos por categoria:

| Categoria | Amostrados | Concordância humano-vs-agente | Notas |
|---|---|---|---|
| {{ lead-qualificado-A }} | {{ N }} | {{ X% }} | {{ ✅ acima do threshold }} |
| {{ lead-qualificado-B }} | {{ N }} | {{ X% }} | {{ ... }} |
| {{ inconclusivo }} | {{ N }} | {{ X% }} | {{ ... }} |

Detalhamento de discordâncias significativas:
- Outcome `{{ id }}`: {{ descrição da discordância }}
- {{ ... }}

---

## 6. Issues abertas pelo reviewer

| ID | Princípio | Severidade | Título | Owner sugerido |
|---|---|---|---|---|
| {{ AUD-2026-04-001 }} | C3 | P1 | Custo de SKU X chegou a 26% | tech-lead |
| {{ AUD-2026-04-002 }} | C5 | P2 | Skill Y declara tier errado | po-guardian |
| {{ ... }} | {{ }} | {{ }} | {{ }} | {{ }} |

---

## 7. Drift detection

### Drift de qualidade
| SKU | Acurácia mês N | Acurácia mês N-1 | Variação | Status |
|---|---|---|---|---|
| {{ x }} | {{ 87% }} | {{ 92% }} | {{ -5pp }} | ⚠️ WARN |

### Drift de custo
| SKU | Custo médio mês N | Custo médio mês N-1 | Variação | Status |
|---|---|---|---|---|
| {{ x }} | R$ {{ 1,20 }} | R$ {{ 0,95 }} | {{ +26% }} | ⚠️ WARN |

### Drift de volume
| SKU | Volume mês N | Volume mês N-1 | Variação | Status |
|---|---|---|---|---|
| {{ x }} | {{ 230 }} | {{ 180 }} | {{ +28% }} | ✅ |

---

## 8. Recomendações priorizadas

| Prioridade | Recomendação | Impacto esperado |
|---|---|---|
| P0 | {{ ... }} | {{ ... }} |
| P1 | {{ ... }} | {{ ... }} |
| P2 | {{ ... }} | {{ ... }} |

---

## 9. Comparação com auditoria anterior

| Métrica | Mês N | Mês N-1 | Tendência |
|---|---|---|---|
| Issues abertas | {{ N }} | {{ M }} | {{ ↗/↘/→ }} |
| Issues resolvidas | {{ N }} | {{ M }} | {{ ... }} |
| FAIL crítico | {{ ✅ Não }} | {{ ... }} | {{ ... }} |
| Razão custo/preço média | {{ X% }} | {{ Y% }} | {{ ... }} |

---

## 10. Próxima auditoria

**Data**: {{ próximo último dia útil do mês }}

**Mudanças no escopo**: {{ nenhuma / listar }}

---

## 11. Assinatura do reviewer

- **Reviewer**: deepagent-gpt-5.5
- **Modelo**: gpt-5.5 (snapshot {{ data }})
- **Constitution lida**: v{{ X.Y.Z }} (sha256 `{{ ... }}`)
- **Manifest lido**: v{{ X.Y.Z }} (sha256 `{{ ... }}`)
- **Tempo de execução**: {{ N min }}
- **Custo da auditoria**: US$ {{ X.XX }}
