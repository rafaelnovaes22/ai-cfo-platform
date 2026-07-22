---
description: Define os thresholds pré-contratados de C4 (agreement_rate, latency_p95, cost_per_outcome, min_run_count, min_window_days) e persiste em spec.c4_thresholds. Gate humano explícito — sem SLA declarada, /novais-digital:promote bloqueia. Garante que os números do contrato e do enforce mecânico de SHADOW são os mesmos.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - artifact_id
  optional:
    - client_id
    - subscription_id
    - approver
foundry_command_version: 0.1.0
linked_principles: [C2, C3, C4]
invokes_skills:
  - "@offerings-loader"
output_artifact: docs/specs/{artifact_id}.md (seção c4_thresholds)
trace_required: true
human_approval_required: true
---

# /novais-digital:sla-threshold — Pré-contratar SLA mensurável

## Propósito

Cliente, comercial e engenharia **declaram juntos**, antes do SHADOW começar, os números que definem "passou" ou "não passou":

- `agreement_rate_min` — % mínimo de concordância humano/agente para promover SHADOW → ASSISTED
- `latency_p95_ms` — teto de latência aceitável p95
- `cost_per_outcome_max` — teto de custo por outcome (deriva de `c3_check.min_price_per_outcome × target_ratio`)
- `min_run_count` — execuções mínimas no modo SHADOW antes de avaliar promoção
- `min_window_days` — janela mínima (default 14, hard floor C4)

> Esta command é o **inverso de "afrouxar gol depois do jogo"**. Pré-contrato registrado em `docs/specs/{artifact_id}.md` é o que `@shadow-mode-runner` lê quando produz recomendação.

## Pre-conditions

1. `docs/specs/{artifact_id}.md` existe (gerada por `/novais-digital:spec`)
2. `docs/clients/{client_id}/baseline-cost-*.md` existe com `c3_check.status` ∈ {viable, tight}
3. `--approver` declarado (humano com autoridade para assinar SLA — comercial + engenharia)
4. Tracing configurado

## Inputs

```yaml
artifact_id: <slug>
# opcionais
client_id: <slug>             # se SLA varia por cliente; default: SLA do catálogo
subscription_id: <slug>       # se SLA é específica de uma subscription
approver: <nome|role>         # quem assina a SLA
```

## Inputs estruturados (prompted ou via flag)

```yaml
agreement_rate_min: <0–1, ex: 0.85>
latency_p95_ms: <ex: 8000>
cost_per_outcome_max: <derivado de baseline × C3, mas confirmável>
min_run_count: <ex: 100>
min_window_days: <ex: 14, mínimo C4>
escalation_categories: [...]      # categorias que SEMPRE escalam, sem tentativa
quality_breach_action: rollback | hold_in_shadow | re-shadow_post_incident
```

## Execução

```
1. Trace start

2. Helpers Tier 1:
   - @offerings-loader (validar artifact_id e lifecycle_stage atual)

3. Tier 2 — leitura:
   - spec.outcome_clause + outcome_categories (define escopo do SLA)
   - baseline-cost-{process}.md → derivar cost_per_outcome_max sugerido
   - se subscription_id fornecido, ler subscription.mode atual

4. Validar limites:
   - min_window_days >= 14 (floor C4); senão ERROR
   - cost_per_outcome_max <= human_cost_per_unit (senão SLA pior que humano = inválido)
   - cost_per_outcome_max <= min_price_per_outcome × 0.25 (consistência C3)
   - agreement_rate_min ∈ [0.5, 0.99] (1.0 é inviável; <0.5 é commercial-suicide)
   - min_run_count >= 30 (alinhado com mínimo de eval-cases por categoria)

5. Confirmar com approver:
   - Output preview com todos os números + warnings
   - Aguardar aprovação explícita (campo: --approver assinou)
   - SEM aprovação humana, command termina com status=pending_approval

6. Persistir em docs/specs/{artifact_id}.md
   - Adicionar/atualizar seção c4_thresholds: { ... }
   - Bumpar spec_version (PATCH)
   - Registrar approver, approved_at em audit_trail

7. Trace end + output structured
```

## Output structured

```yaml
command: /novais-digital:sla-threshold
status: ok | pending_approval | warn | error
artifact_id: <>
spec_path: docs/specs/<>.md
spec_version_before: 0.1.0
spec_version_after: 0.1.1
c4_thresholds:
  agreement_rate_min: 0.85
  latency_p95_ms: 8000
  cost_per_outcome_max: 0.20
  min_run_count: 100
  min_window_days: 14
  escalation_categories: [pii_detected, refund_above_threshold]
  quality_breach_action: rollback
warnings:
  - "agreement_rate_min=0.85 é folgado para baseline humano de error_rate=0.92; considerar 0.90"
human_approval:
  approver: <>
  approved_at: 2026-04-30T...
  signature_hash: <sha256:16>
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/novais-digital:plan --artifact_id=<>" | "/novais-digital:eval --artifact_id=<>"
```

## Verification gate

- [x] `min_window_days >= 14` (hard floor C4 — sem exceção)
- [x] `cost_per_outcome_max <= human_cost_per_unit` (SLA não pode ser pior que humano)
- [x] `cost_per_outcome_max <= 0.25 × min_price_per_outcome` (consistência com c3_check)
- [x] `agreement_rate_min ∈ [0.5, 0.99]`
- [x] `min_run_count >= 30`
- [x] `escalation_categories` ⊆ `outcome_categories` da spec (não pode escalar categoria que não existe)
- [x] Aprovação humana explícita registrada com `signature_hash` (não auto-aprovado pela skill)
- [x] Spec persistida com `spec_version` bumpada (PATCH ou MINOR)
- [x] Trace_id não-nulo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Cliente premium aceita janela <14 dias" | Hard floor C4 sem exceção; cliente que pula SHADOW é o primeiro a churnar | `min_window_days < 14` → ERROR; bypass exige `NOVAIS_FOUNDRY_BYPASS=incident` em settings.local (Foundry-4) com log auditado |
| "agreement_rate_min = 0.95 pra parecer rigoroso" | Threshold inalcançável bloqueia promoção indefinidamente; cliente não vê valor | Calibrar com baseline humano; ≥0.85 é razoável quando humano tem ≥0.92 de acerto |
| "Aprovação por email vale" | Aprovação sem `signature_hash` registrado quebra rastreabilidade do reviewer | Aprovação aqui = explícita via flag + persistida no audit_trail; emails referenciados são apoio, não substituto |
| "Vou ajustar threshold após primeiros runs SHADOW" | "Mover trave depois do gol" é o anti-padrão #1; quebra confiança comercial | Threshold imutável durante a janela SHADOW; ajuste exige nova janela e nova aprovação |
| "cost_per_outcome_max não declarado, deixo livre" | Sem teto, SHADOW pode passar com custo inviável e quebrar em produção | C3 enforce — sem `cost_per_outcome_max`, command bloqueia |
| "escalation_categories são óbvias, omito" | Categorias de escalonamento são proteção C4 (adversarial cases) | Mandatório listar pelo menos PII-detected ou equivalente do domínio |
| "Posso aprovar minha própria SLA pra agilizar" | Aprovação cruzada (comercial + engenharia) é checks-and-balances | Bloquear self-approval; `approver` deve ter role distinto do solicitante |

## Saída de erro estruturada

```yaml
command: /novais-digital:sla-threshold
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `c4_window_below_minimum` | `cost_per_outcome_inconsistent_with_c3` | `agreement_rate_out_of_range` | `escalation_category_unknown` | `human_approval_missing` | `self_approval_attempted` | `target_ratio_override_without_adr` | `spec_unwritable`.

## Interação com SHADOW

`@shadow-mode-runner` lê **exclusivamente** o que esta command persistiu. Mudanças em `c4_thresholds` durante uma janela SHADOW ativa **bloqueiam** o `tick`/`report` da skill — exige nova janela.

```
sla-threshold(approve) → spec.c4_thresholds → @shadow-mode-runner.tick → report
                              ↑                                              ↓
                              └── imutável durante janela ←─── recomendação ─┘
```

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-2 onda 1 (spec/economics) |
