---
adr: 020
title: QA financeiro 100% determinístico (remoção do LLM advisory do caminho crítico)
status: accepted
date: 2026-06-16
deciders: Rafael Novaes (CEO Acme)
linked_principles: [C3, C6]
linked_artifacts:
  - src/monthly-analysis/agents/financial-qa-review.ts
  - src/monthly-analysis/graph/nodes/qa-review.ts
supersedes: null
superseded_by: null
related: [019]
---

# ADR-020 — QA financeiro 100% determinístico

## Contexto

O QA da análise mensal (`financial-qa-review`) tinha duas camadas:

1. **Pré-checador determinístico**: regras explícitas que decidem `publishable` e disparam retry de narrative/action.
2. **LLM advisory** (decisão de 2026-06-03): rodava quando o determinístico aprovava, gerando issues rebaixados a `warning` para telemetria, sem bloquear nem disparar retry.

Medição via LangSmith (2026-06-16, Vertex `us-central1`, análise real de 77 lançamentos) revelou:

- O LLM advisory custava **~41.5s no caminho crítico**, bloqueando o `finalize`.
- Ele checa **exatamente os mesmos 6 códigos** do determinístico (`NUMBER_MISMATCH`, `MISSING_DONEWHEN`, `CONTRADICTION`, `MISSING_EVIDENCE`, `UNFOUNDED_CLAIM`, `STAGE_MISMATCH`), de forma probabilística.
- Como já era advisory, **não adicionava garantia nenhuma**: a proteção em produção já era 100% determinística.

Em domínio financeiro, onde o resultado entregue não pode conter erro, a rede de segurança para o que o determinístico não prevê deve ser **revisão humana** (`needsReview` nos modos SHADOW/ASSISTED), não um segundo componente probabilístico que também produz falsos positivos (foi justamente um falso positivo, "CONTRADICTION em empresa saudável", que rebaixou o LLM a advisory em 2026-06-03).

## Decisão

`financial-qa-review` passa a ser **100% determinístico**: o pré-checador é o gate único e auditável. A chamada ao LLM foi removida do nó. O nó retorna `latencyMs=0` e `response=NOOP`.

O prompt do revisor (`prompts/financial-qa-review.ts`) é **preservado** para um eventual uso como detector de gaps **amostrado e offline em SHADOW** (alimentar novas regras determinísticas), nunca no caminho crítico de entrega.

## Consequências

- **Latência**: corte de ~41.5s por análise no caminho crítico.
- **Custo (C3)**: elimina os tokens do `financial-qa-review` em toda análise.
- **Qualidade**: o fluxo financeiro fica inteiramente baseado em regras explícitas e auditáveis, sem componente probabilístico decidindo ou observando a entrega.
- **Telemetria (C6)**: perde-se o sinal advisory do LLM em produção. Mitigação: se houver necessidade de descobrir gaps do determinístico, rodar o revisor amostrado em SHADOW, fora da entrega.
- Reverte a escolha de 2026-06-03 que manteve o advisory rodando síncrono.
