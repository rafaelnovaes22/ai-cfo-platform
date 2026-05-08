---
description: Conduz Fase 0 (diagnóstico cobrável) com decisor do cliente — qualifica problema, mede baseline humano, propõe outcome contratual, valida ICP fit, e produz relatório estruturado em docs/clients/{client_id}/diagnostic.md. Implementa C1 e abre C2.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - client_id
    - interlocutor_role
    - declared_problem
  optional:
    - session_minutes
    - industry
    - referrer
forge_command_version: 0.1.0
linked_principles: [C1, C2]
invokes_skills:
  - "@company-dna"
  - "@icp-loader"
  - "@offerings-loader"
  - "@diagnostic-runner"
output_artifact: docs/clients/{client_id}/diagnostic.md
trace_required: true
---

# /acme:diagnose — Fase 0 cobrável

## Propósito

Porta de entrada do pipeline `diagnose → spec → unit-economics → sla-threshold → plan → tasks → implement → eval → promote`. Implementa o princípio **C1 (diagnose-before-design)** estruturalmente: nenhum agente em produção sem `diagnostic.md` referenciado.

> Esta command **não vende, não arquiteta, não promete tecnologia**. Qualifica: vale a pena resolver? cliente cabe no ICP? baseline humano declarado? outcome possível?

## Pre-conditions

Antes de invocar, validar:

1. `docs/dna.md` (ou path equivalente) existe → `@company-dna` carrega
2. `docs/icp.md` (ou equivalente) existe → `@icp-loader` carrega
3. `docs/portfolio.md` (ou equivalente) existe → `@offerings-loader` carrega
4. Usuário pode escrever em `docs/clients/{client_id}/`
5. Tracing configurado (`LANGFUSE_*` ou equivalente em env) — diagnose é cobrável, todo run com trace (C6)

Se qualquer pré-condição falhar → erro estruturado, **não inicia sessão**.

## Inputs

```yaml
client_id: <slug do cliente>
interlocutor_role: <ceo | cfo | head-x | analista>
declared_problem: <1 frase, ipsis literis do interlocutor>
# opcionais
session_minutes: <duração planejada, default 90>
industry: <vertical>
referrer: <como chegou>
```

## Execução

```
1. Trace start: trace_id = forge.trace.start("/acme:diagnose", {client_id, ...})

2. Helpers Tier 1:
   - Se __forge_cache.dna vazio → invocar @company-dna
   - Se __forge_cache.icp vazio → invocar @icp-loader
   - Se __forge_cache.offerings vazio → invocar @offerings-loader

3. Conduzir @diagnostic-runner com os 10 blocos do roteiro:
   1. Problema declarado
   2. Custo do não-resolvido
   3. Baseline humano (handoff de inputs para @baseline-cost-builder)
   4. Tentativas anteriores
   5. Outcome candidato (3 exemplos positivos + 3 negativos + trigger event)
   6. Métrica de sucesso
   7. Tolerância a erro
   8. ICP fit (interno — comparar com __forge_cache.icp)
   9. Catálogo fit (interno — comparar com __forge_cache.offerings)
   10. Próximos passos (GO/NO-GO + valor diagnóstico)

4. Persistir docs/clients/{client_id}/diagnostic.md
   (template: templates/diagnostic-spec.template.md)

5. Trace end: forge.trace.end(trace_id, status, metrics)

6. Emitir output structured (abaixo)
```

## Output structured

```yaml
command: /acme:diagnose
status: ok | partial | error
client_id: <>
artifact_path: docs/clients/<>/diagnostic.md
session_minutes_actual: <N>
icp_fit: fit | edge | out_of_icp
catalog_fit: existing-sku | variant | new
go_no_go: go | no-go | needs-paid-diagnostic
proposed_outcome:
  clause: "<1 frase>"
  positive_examples: [...]
  negative_examples: [...]
  trigger_event: <evento técnico>
baseline_handoff:
  ready_for: "/acme:unit-economics"
  fields_collected: [volume_monthly, actors, hours_per_unit, error_rate, rework_rate]
  fields_missing: []
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:unit-economics --client_id=<> --process_id=<>"
```

## Verification gate (não-negociável)

A command só conclui com `status: ok` se **todos**:

- [x] `@company-dna`, `@icp-loader`, `@offerings-loader` retornaram `*_loaded: true`
- [x] Os 10 blocos do roteiro produziram output (ou `not_applicable` justificado)
- [x] `proposed_outcome.clause`, `positive_examples` (≥3), `negative_examples` (≥3), `trigger_event` presentes
- [x] `icp_fit` ∈ {fit, edge, out_of_icp} declarado
- [x] `go_no_go` ∈ {go, no-go, needs-paid-diagnostic} declarado com justificativa
- [x] Arquivo `docs/clients/{client_id}/diagnostic.md` persistido e parseia
- [x] Frontmatter inclui `forge_skill_version` e `forge_command_version`
- [x] `trace_id` não-nulo (C6)
- [x] Nenhuma leitura registrada em paths Tier 3 (`runs/`, `outcomes/`, `eval-cases/`, `traces/`)

Se algum item falhar → `status: error` ou `status: partial` com `partial: true` no relatório; **não** propaga para `/acme:spec` automaticamente.

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Cliente já tem clareza, pulo o roteiro" | C1 estrutural — sem `diagnostic.md`, SKU não pode ir a produção | Conduzir os 10 blocos mesmo se interlocutor "já sabe" |
| "Outcome ambíguo, deixo pra spec resolver" | Ambiguidade aqui contamina spec, contrato e eval | Forçar 3+3 exemplos no Bloco 5; `proposed_outcome: insufficient` se incompleto |
| "Cliente fora do ICP, mas vale tentar" | Out-of-ICP gasta esforço de pré-venda e vira churn | Marcar `icp_fit: out_of_icp` e propor `next_step: "renegociar escopo ou recusar"` |
| "Diagnóstico grátis pra fechar venda" | Cliente que não topa pagar diagnóstico raramente vira cliente sério (filtro C1) | Bloco 10 é mandatório com `paid_diagnostic_value` declarado |
| "Sem trace pra essa sessão piloto" | Quebra C6 — diagnose é cobrável, todo run audit-ready | `trace_required: true`; falhar se `LANGFUSE_*` ausente |
| "Vou ler runs antigos pra ter referência" | Runs são Tier 3 — quebra C5 | Apenas Tier 1 (helpers) + Tier 2 do mesmo cliente |

## Saída de erro estruturada

```yaml
command: /acme:diagnose
status: error
error: <enum>
hint: <ação>
trace_id: <ou null se erro pré-trace>
```

`error` ∈ `pre_conditions_failed` | `helpers_load_failed` | `interlocutor_disengaged` (≥3 blocos sem resposta substancial) | `out_of_icp_blocked` (se settings exigem) | `client_dir_unwritable` | `tracing_unconfigured` | `partial_session_aborted`.

## Critério de pronto explícito (do roadmap Forge-1)

> "`diagnostic-runner` em sessão simulada produz relatório Fase 0 estruturado em ≤ 10 min."

`/acme:diagnose --session_minutes=10` é compatível com sessões rápidas de qualificação preliminar. `--session_minutes=90` é o default para sessão completa com CEO. Em ambos os casos, **todos os 10 blocos** são executados.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 1 (spec/economics) |
