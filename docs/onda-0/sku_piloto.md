---
decision: "D1+D2 — SKU piloto e cláusula contratual de outcome"
status: "aprovado"
approved_by: "CEO Novais Digital"
approved_at: "2026-05-08"
constitution_version: "0.2.0"
created_at: "2026-05-08"
last_updated: "2026-05-08"
linked_spec: "src/skus/monthly-analysis/spec.md"
---

# Onda 0 / D1+D2 — SKU piloto

## D1 — Qual o SKU piloto

**Decisão**: `monthly-analysis` (Análise Financeira Mensal).

**Justificativa**: dos 30 módulos planejados (8 ondas), `monthly-analysis` é o coração do produto e está visualmente validado (3 telas já desenhadas pelo dev frontend). Cobre 14 das 60 features na lista do Aicfo. Cliente loga, importa lançamentos, recebe análise — fluxo end-to-end testável em piloto.

Os outros 16 módulos (Onda 0 fundação + Ondas 2-8) servem ao mesmo SKU ou expandem o produto pós-piloto.

## D2 — Cláusula contratual de outcome

**Definição (do `spec.md` §1.1)**:

> O Aicfo entrega **uma análise financeira mensal** quando o cliente importa ≥ 50 lançamentos de um mês de referência, gerando: (a) DRE Facilitado classificado e narrado, (b) 3 cards de "Leitura da história" (Gargalo crítico / Atenção / Saudável), (c) Plano de Ação 3-horizontes com impacto R$ estimado por ação.

**Eventos técnicos que disparam `outcome:delivered`**:

1. `Analysis.status = "ready"` no DB
2. `dre.classified_lines / dre.total_lines >= 0.90`
3. `narrative_cards.length === 3` (1 por categoria: gargalo/atenção/saudável)
4. `action_plan.short.length >= 3 && action_plan.medium.length >= 1 && action_plan.long.length >= 1`
5. Trace Langfuse `monthly-analysis.delivered` com `costBrl` registrado

**Negative outcomes** (NÃO contam, retornam `outcome:rejected` com motivo):

- Lançamentos importados <50 → motivo `insufficient_input`
- Classificação <90% → motivo `classification_below_threshold`
- Mês de referência futuro → motivo `period_not_closed`

## Cláusula nos termos de uso (visível ao cliente)

Espelha §1.5 do spec. Limites e garantias estão no doc do produto, não em contrato custom (C8 — produto self-serve não tem cláusula contratual customizada por tenant).

## Aprovação

- [x] Mantenedor (Rafael) leu e aprovou
- [x] CEO leu e aprovou em 2026-05-08
- [x] Reviewer DeepAgent será notificado na próxima auditoria mensal

**Aprovado por**: CEO Novais Digital em 2026-05-08

> Mudanças nesta cláusula exigem reaprovação CEO + bump de versão. Hook `outcome-clause-guard` bloqueia edição sem ADR.
