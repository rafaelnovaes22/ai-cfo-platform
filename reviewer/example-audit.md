---
audit_date: "2026-05-31"
audit_period: "2026-05"
reviewer: "deepagent-gpt-5.5"
constitution_version: "0.2.0"
manifest_version: "0.2.0"
project: "acme-governanca-ia (exemplo fictício para gabarito)"
artifacts_audited: 17
outcomes_sampled: 47
overall_status: "warn"
version: "0.1.0"
---

# Auditoria Mensal — acme-governanca-ia — 2026-05 (EXEMPLO/GABARITO)

> ⚠️ Este é um **exemplo sintético** para servir de gabarito de output. Dados ilustrativos, não reais.
> Mostra como o reviewer deve estruturar o relatório seguindo `templates/monthly-audit.template.md` + `reviewer/output-schema.json`.

---

## 1. Resumo executivo

| Eixo | Status | Detalhe |
|---|---|---|
| Constitution C1–C8 | **6 PASS, 1 WARN, 1 FAIL** | Detalhe em §3 |
| SLA mensal agregado | ✅ PASS | 87% (threshold 85%) |
| Drift detectado | ⚠️ Sim | Custo SKU `triagem-comercial-whatsapp` subiu 18% mês-a-mês |
| Coerência artefatos ↔ código | ✅ PASS | 3 SKUs auditados |
| Issues abertas pelo reviewer | 4 | Detalhe em §6 |

**Veredito geral**: `warn`

> Operação saudável mas atenção a 2 sinais: custo subindo em 1 SKU e cobertura de eval insuficiente em outro. Sem FAIL crítico (C1-C4 todos PASS).

---

## 2. Escopo da auditoria

| Item | Quantidade |
|---|---|
| Artefatos lidos do manifest | 17 |
| SKUs/produtos em produção auditados | 3 |
| Outcomes amostrados (5–10%) | 47 |
| Eval cases re-rodados | 0 (auditoria deste mês não re-rodou eval) |
| Período de outcomes considerado | últimos 30 dias |

Manifest de referência: `0.2.0` (sha256 `a1b2c3d4e5f60708`)
Constitution lida: `0.2.0` (sha256 confirma com manifest)

---

## 3. Detalhamento por princípio (C1–C8)

### C1 — Diagnose-before-design

**Status**: ✅ PASS

**Evidência**:
- 3/3 SKUs em produção têm `linked_diagnostic` referenciando `docs/onda-0/diagnostico-fase0-{cliente}.md`
- Todos os arquivos de diagnóstico existem e têm seções: problema declarado, baseline humano, outcome proposto, métrica de sucesso
- 1 SKU (`example-triagem-whatsapp`) marcado `is_example: true` — exceção válida

**Issues abertas**: nenhuma

---

### C2 — Outcome-first

**Status**: ✅ PASS

**Evidência**:
- 3/3 specs têm seção §1 "Cláusula de outcome" com todos os 5 elementos obrigatórios (definição, 3 exemplos positivos, 3 negativos, janela temporal, evento técnico)
- Schemas de saída do código (`src/skus/*/schemas/index.ts`) batem com categorias declaradas em 95% dos casos amostrados
- 1 caso isolado: SKU `triagem-comercial-whatsapp` tem categoria `inconclusivo` na spec mas schema do código não declara (registrar issue P3)

**Issues abertas**: AUD-2026-05-004

---

### C3 — Cost ≤ 25% of price

**Status**: ⚠️ WARN

**Evidência**:
- SKU `triagem-comercial-whatsapp`: razão documentada 22%, real (Langfuse 30d) **24.8%** → ⚠️ margem apertada
- SKU `analise-financeira-mensal`: razão documentada 18%, real 17% → ✅
- SKU `example-triagem-whatsapp`: showcase, modo SHADOW — exceção C3 aplica
- **Drift de custo**: `triagem-comercial-whatsapp` subiu 18% mês-a-mês (de R$ 0.95 para R$ 1.12) — investigar mudança de prompt

**Issues abertas**: AUD-2026-05-001 (P1)

---

### C4 — SHADOW antes de cobrar

**Status**: ✅ PASS

**Evidência**:
- Promoções no período: 2 (1 SHADOW→ASSISTED, 1 ASSISTED→AUTONOMOUS)
- Ambas com gates registrados: eval suite passing, threshold de qualidade atingido, aprovação humana
- Subscription `sub_xyz123` esteve em SHADOW por 21 dias antes de promover (>= 14 ✅)

**Issues abertas**: nenhuma

---

### C5 — Three-tier context

**Status**: ✅ PASS

**Evidência**:
- 13 skills em `.claude/skills/` declaram tier corretamente (5 L0, 4 L1, 4 L2)
- 0 violações de hierarquia detectadas
- Cache hit rate em L0 (helper pattern): 78% (acima do mínimo 50%)

**Issues abertas**: nenhuma

---

### C6 — Telemetry-by-default

**Status**: ✅ PASS

**Evidência**:
- Outcomes no DB: 412
- Traces correspondentes em Langfuse: 410
- Desvio: -0.5% (✅ ≤ 1%)
- Lint regex passa em 100% dos arquivos relevantes

**Issues abertas**: nenhuma

---

### C7 — Portability over lock-in

**Status**: ✅ PASS

**Evidência**:
- Imports de `@anthropic-ai/sdk` encontrados em:
  - `src/infra/anthropic.ts` ✅ (camada de abstração esperada)
  - `src/skus/example-triagem-whatsapp/agents/intake-analyzer.ts` ⚠️ (apenas para tipos `Anthropic.Tool`, `Anthropic.MessageParam` — comum, mas idealmente trazer para `src/llm/types.ts`)
  - `src/skus/triagem-comercial-whatsapp/agents/qualifier.ts` ⚠️ (mesma situação)
- Specs (`*.md`) não têm lógica de modelo

> Nota: importar tipos do SDK é menos crítico que importar implementação. PASS com sugestão de refactor (issue P3).

**Issues abertas**: AUD-2026-05-003

---

### C8 — Anti-customização heroica

**Status**: 🔴 FAIL

**Evidência**:
- Encontradas **2 ocorrências** de `if (tenantId === 'sub_xyz123')` em:
  - `src/skus/triagem-comercial-whatsapp/agents/qualifier.ts:142`
  - `src/skus/triagem-comercial-whatsapp/agents/qualifier.ts:178`
- Arquivo `created_at`: 2026-04-15 (45 dias atrás — excede limite de 14 dias para onboarding)
- Pastas `clients/{nome}/` ou `tenants/{nome}/`: nenhuma encontrada (✅)

**Conclusão**: customização hardcoded passou do prazo de exceção (14d). Precisa ser movida para `TenantContext.skuConfig` ou virar SKU dedicado.

**Issues abertas**: AUD-2026-05-002 (P0)

---

## 4. Coerência entre artefatos

### 4.1. Spec ↔ código

| SKU/Produto | Spec versão | Código corresponde? | Notas |
|---|---|---|---|
| triagem-comercial-whatsapp | 1.2.0 | ⚠️ | Categoria `inconclusivo` falta no schema |
| analise-financeira-mensal | 0.3.0 | ✅ | Coerente |
| example-triagem-whatsapp | 0.1.0 | ✅ | Showcase OK |

### 4.2. Spec ↔ eval suite

| SKU/Produto | Categorias da spec | Categorias em eval | Coverage |
|---|---|---|---|
| triagem-comercial-whatsapp | A, B, C, inconclusivo | A, B, C | ⚠️ Falta `inconclusivo` |
| analise-financeira-mensal | gargalo, atenção, saudável | gargalo, atenção, saudável | ✅ |
| example-triagem-whatsapp | (não-vendável) | N/A | N/A |

### 4.3. ADR ↔ implementação

| ADR | Decisão | Reflete em código? | Drift? |
|---|---|---|---|
| ADR-001 | Stack LangGraph | ⚠️ | Pipeline usa state machine custom, não LangGraph |
| ADR-002 | Portfolio 3 categorias | ✅ | 3 SKUs categorizados conforme |
| ADR-003 | ClickUp interno | ✅ | Cliente final não tem acesso |

> ADR-001 vs implementação real é drift conhecido, registrado em discussão pendente. Não conta como FAIL pq não é violação de Constitution — é desvio de decisão arquitetural local.

---

## 5. Outcomes amostrados (auditoria de qualidade)

Amostra de 47 outcomes (8.5% do mês), distribuídos por categoria:

| Categoria | Amostrados | Concordância humano-vs-agente | Notas |
|---|---|---|---|
| `lead-qualificado-A` | 12 | 92% | ✅ acima do threshold 90% |
| `lead-qualificado-B` | 18 | 89% | ✅ acima do threshold 85% |
| `inconclusivo` | 8 | 75% | ⚠️ abaixo do threshold 80% — investigar |
| `não-comercial` | 6 | 100% | ✅ |
| `analise-financeira-mensal` (Acme Fin) | 3 | 67% | ⚠️ amostra pequena, mas baixo |

Detalhamento de discordâncias significativas:
- Outcome `out_a8f3b2`: agente classificou como `lead-qualificado-B`, gabarito humano `inconclusivo`. Razão: BANT incompleto em "Authority"
- Outcome `out_c2e9d1`: agente classificou como `lead-qualificado-A`, reviewer concorda; gabarito humano marcou `B`. Discordância humano-reviewer (não falha do agente).
- Outcome `out_fin_001`: análise financeira gerou gargalo "marketing 22%" mas DRE real mostra 18%. Possível alucinação.

---

## 6. Issues abertas pelo reviewer

| ID | Princípio | Severidade | Título | Owner sugerido |
|---|---|---|---|---|
| AUD-2026-05-001 | C3 | P1 | Custo de `triagem-comercial-whatsapp` subiu 18% mês-a-mês, razão real chegou a 24.8% | tech-lead |
| AUD-2026-05-002 | C8 | P0 | Hardcode por tenantId em `qualifier.ts` excedeu prazo de 14 dias (45d) | sku-architect |
| AUD-2026-05-003 | C7 | P3 | Tipos do SDK Anthropic importados fora da camada de abstração em 2 arquivos | tech-lead |
| AUD-2026-05-004 | C2 | P3 | Categoria `inconclusivo` falta no schema do código de `triagem-comercial-whatsapp` | po-guardian |

---

## 7. Drift detection

### Drift de qualidade
| SKU | Acurácia mês N | Acurácia mês N-1 | Variação | Status |
|---|---|---|---|---|
| triagem-comercial-whatsapp | 89% | 91% | -2pp | ✅ dentro do limite |
| analise-financeira-mensal | 78% | 76% | +2pp | ✅ |

### Drift de custo
| SKU | Custo médio mês N | Custo médio mês N-1 | Variação | Status |
|---|---|---|---|---|
| triagem-comercial-whatsapp | R$ 1.12 | R$ 0.95 | +18% | ⚠️ WARN (issue 001) |
| analise-financeira-mensal | R$ 0.34 | R$ 0.31 | +9% | ✅ |

### Drift de volume
| SKU | Volume mês N | Volume mês N-1 | Variação | Status |
|---|---|---|---|---|
| triagem-comercial-whatsapp | 287 | 240 | +20% | ✅ |
| analise-financeira-mensal | 91 | 73 | +25% | ✅ |

---

## 8. Recomendações priorizadas

| Prioridade | Recomendação | Impacto esperado |
|---|---|---|
| P0 | Mover hardcode `if (tenantId === 'sub_xyz123')` para `TenantContext.skuConfig` antes do próximo PR (issue AUD-002) | Evita bloqueio de C8; libera caminho para próximo cliente |
| P1 | Investigar mudança de prompt em `triagem-comercial-whatsapp` que subiu custo 18% (issue AUD-001) | Recupera margem; evita razão > 25% |
| P2 | Adicionar 5+ casos de eval para categoria `inconclusivo` no SKU de triagem | Aumenta confiança de promoção e cobertura de auditoria |
| P3 | Refatorar imports do `Anthropic.Tool` para `src/llm/types.ts` (issue AUD-003) | Reduz vazamento de SDK em SKUs |
| P3 | Investigar possível alucinação em outcome `out_fin_001` do Acme Fin | Identifica padrão se houver |

---

## 9. Comparação com auditoria anterior (2026-04)

| Métrica | Mês N (2026-05) | Mês N-1 (2026-04) | Tendência |
|---|---|---|---|
| Issues abertas | 4 | 2 | ↗ |
| Issues resolvidas no período | 1 | 3 | ↘ |
| FAIL crítico | C8 | nenhum | ↗ regressão |
| Razão custo/preço média | 22% | 19% | ↗ atenção |

> Sinal de alerta: regressão em C8 e mais issues que mês anterior. Recomendar reunião de retrospectiva com tech lead.

---

## 10. Próxima auditoria

**Data**: 2026-06-30 (último dia útil do mês)

**Mudanças no escopo**: nenhuma. Continua amostra 5-10% e checks C1-C8.

---

## 11. Assinatura do reviewer

- **Reviewer**: deepagent-gpt-5.5
- **Modelo**: gpt-5.5 (snapshot 2026-05)
- **Constitution lida**: v0.2.0 (sha256 `3318375936c7a241`)
- **Manifest lido**: v0.2.0 (sha256 `b8e9f2d6c1a40a18`)
- **Tempo de execução**: 4m 12s
- **Custo da auditoria**: US$ 1.85
- **Versão do prompt**: 0.2.0
- **Versão das validation-rules**: 0.2.0

**Limitações encontradas**:
- 5% dos outcomes não puderam ser amostrados por timeout em query Langfuse (será re-tentado na próxima auditoria)
