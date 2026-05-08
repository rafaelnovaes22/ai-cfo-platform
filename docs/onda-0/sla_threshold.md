---
decision: "D6 — Threshold de SLA contratual"
status: "aprovado"
approved_by: "CEO Acme"
approved_at: "2026-05-08"
constitution_version: "0.2.0"
linked_principle: "C4"
created_at: "2026-05-08"
last_updated: "2026-05-08"
linked_spec: "src/skus/monthly-analysis/spec.md"
---

# Onda 0 / D6 — SLA Threshold do SKU `monthly-analysis`

## Por que existe

C4 (SHADOW antes de cobrar) exige threshold de qualidade declarado **antes** de promover de SHADOW → ASSISTED → AUTONOMOUS. Sem threshold, promoção é "achismo" e o reviewer DeepAgent não tem âncora para auditar.

---

## Métricas de qualidade

### Métrica 1 — Acurácia de classificação DRE

**Definição**: % de lançamentos classificados em categoria DRE correta (medido contra ground truth).

| Modo | Threshold mínimo | Como medir |
|---|---|---|
| SHADOW | ≥75% | Ground truth gerado manualmente em 100 lançamentos amostrados |
| ASSISTED | ≥85% | Cliente pode editar classificação; medir % editado pós-entrega |
| AUTONOMOUS | ≥90% | Audit amostral mensal (50 lançamentos / 100 análises) |

**Bloqueio de promoção**: se métrica não atingir threshold em 30 dias consecutivos.

### Métrica 2 — Qualidade narrativa (cards de leitura)

**Definição**: % de cards aceitos pelo cliente sem edição/contestação.

| Modo | Threshold mínimo |
|---|---|
| SHADOW | ≥70% (humano valida) |
| ASSISTED | ≥80% (cliente vê + comenta) |
| AUTONOMOUS | ≥85% |

Aceitação medida via:
- Botão "Esse card faz sentido?" (👍/👎/💬) na UI
- Edição manual do card em <5% das análises

### Métrica 3 — Qualidade do plano de ação

**Definição**: % de ações marcadas como "executável" pelo cliente (não rejeitadas).

| Modo | Threshold mínimo |
|---|---|
| SHADOW | ≥60% |
| ASSISTED | ≥70% |
| AUTONOMOUS | ≥80% |

### Métrica 4 — Latência de entrega (operacional)

**Definição**: tempo da requisição "gerar análise" até `outcome:delivered`.

| Modo | p50 | p95 | p99 |
|---|---|---|---|
| SHADOW | <3 min | <5 min | <8 min |
| ASSISTED | <3 min | <5 min | <8 min |
| AUTONOMOUS | <2 min | <4 min | <7 min (depois de otimizações) |

### Métrica 5 — Trace coverage (C6)

**Threshold absoluto** (todos os modos): ≥99% das chamadas LLM com trace Langfuse.

Sem trace = não conta como outcome auditável → bloqueio automático de cobrança.

### Métrica 6 — Custo (C3)

**Threshold**: razão custo/ARPU ≤ 25% mensal.

Alertas:
- ≥15% → P2 (atenção)
- ≥20% → P1 (revisar prompts/cache)
- ≥25% → P0 (bloqueio de cobrança automática até resolver)

---

## Gates de promoção

### SHADOW → ASSISTED

Todos abaixo simultaneamente em 30 dias consecutivos:

- Acurácia DRE ≥85%
- Qualidade narrativa ≥80%
- Qualidade plano ≥70%
- Latência p95 <5 min
- Trace coverage ≥99%
- Razão custo/ARPU ≤20%
- Eval suite com ≥30 casos passando ≥90%
- Aprovação humana explícita do Rafael + CEO

### ASSISTED → AUTONOMOUS

Todos abaixo em 60 dias consecutivos:

- Acurácia DRE ≥90%
- Qualidade narrativa ≥85%
- Qualidade plano ≥80%
- Latência p95 <4 min
- Trace coverage ≥99%
- Razão custo/ARPU ≤15%
- Eval suite expandida (≥50 casos) passando ≥95%
- Pelo menos 50 análises ASSISTED entregues sem incidente P0
- Aprovação humana explícita do Rafael + CEO + revisão DeepAgent

---

## Em caso de breach

| Severidade | Resposta |
|---|---|
| **P0** (custo >25% OU trace <90% OU acurácia <70% por 7d) | Bloqueio automático de cobrança variável; subscription rebaixa para SHADOW; abre incidente Space 6 do ClickUp |
| **P1** (1 métrica abaixo de threshold por 14d) | Alerta para Rafael; análise de causa raiz; ADR se mudança estrutural |
| **P2** (1 métrica em alerta amarelo por 30d) | Acompanhamento mensal; nada bloqueia automaticamente |

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-08 | Versão inicial — thresholds propostos, aguardam validação SHADOW |

## Aprovação

- [x] Thresholds revisados
- [x] CEO concorda com gates de promoção em 2026-05-08
- [x] Reviewer DeepAgent será notificado na próxima auditoria mensal

**Aprovado por**: CEO Acme em 2026-05-08

> Mudança em qualquer threshold deste documento exige reaprovação CEO + nova ADR.
