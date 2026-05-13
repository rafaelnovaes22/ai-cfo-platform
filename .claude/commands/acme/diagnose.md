---
description: Conduz Fase 0 (diagnóstico cobrável) com decisor do cliente — qualifica problema, mede baseline humano, propõe outcome contratual, valida ICP fit, e produz relatório estruturado em docs/clients/{client_id}/diagnostic.md. Implementa C1 e abre C2. v0.2.0 (Forge-9): aceita --project_type ∈ {agentic_saas, platform, automation, hybrid}.
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
    - project_type
    - ai_enabled
forge_command_version: 0.2.0
linked_principles: [C1, C2]
invokes_skills:
  - "@company-dna"
  - "@icp-loader"
  - "@offerings-loader"
  - "@diagnostic-runner"
output_artifact: docs/clients/{client_id}/diagnostic.md
trace_required: true
project_type_aware: true
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
project_type: <agentic_saas | platform | automation | hybrid>  # default: lê de docs/forge/project.json; se ausente, agentic_saas
ai_enabled: <true | false>                                       # default: lê de project.json; se ausente, true
```

> **Resolução de project_type** (v0.2.0): se `--project_type` ausente, command tenta `docs/forge/project.json`. Se também ausente, aplica defaults retroativos `agentic_saas` + `ai_enabled=true` e emite WARN sugerindo criar `project.json` a partir de `templates/project.template.json`.

## Execução

```
1. Trace start: trace_id = forge.trace.start("/acme:diagnose", {client_id, ...})

2. Helpers Tier 1:
   - Se __forge_cache.dna vazio → invocar @company-dna
   - Se __forge_cache.icp vazio → invocar @icp-loader
   - Se __forge_cache.offerings vazio → invocar @offerings-loader

3. Resolver project_type:
   - Se --project_type fornecido → usar
   - Senão, ler docs/forge/project.json → project.type / project.ai_enabled
   - Senão, defaults legados (agentic_saas + ai_enabled=true) e WARN

4. Conduzir @diagnostic-runner com os 10 blocos do roteiro (interpretação por project_type):
   1. Problema declarado
   2. Custo do não-resolvido (humano OU operacional, conforme tipo)
   3. Baseline (humano para agentic; ferramenta atual + horas operacionais para platform)
   4. Tentativas anteriores
   5. Outcome candidato:
      - agentic_saas → 3 exemplos positivos + 3 negativos + trigger event de DELIVERED
      - platform → 3 exemplos positivos + 3 negativos + evento de COMPLETED + audit log entry esperado
      - automation → idem platform; foco em job/integração
      - hybrid → declarar por módulo
   6. Métrica de sucesso (acurácia para IA; pass rate de aceite humano para platform)
   7. Tolerância a erro
   8. ICP fit (interno)
   9. Catálogo fit (interno)
   10. Próximos passos (GO/NO-GO + valor diagnóstico) + tipo de spec a gerar:
       - agentic_saas → /acme:spec --type=platform-sku|product
       - platform → /acme:spec --type=platform-module
       - automation → /acme:spec --type=automation-job (futuro: alias de platform-module)

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
project_type: agentic_saas | platform | automation | hybrid       # NOVO v0.2.0
ai_enabled: true | false                                            # NOVO v0.2.0
session_minutes_actual: <N>
icp_fit: fit | edge | out_of_icp
catalog_fit: existing-sku | variant | new
go_no_go: go | no-go | needs-paid-diagnostic
proposed_outcome:
  kind: classified_outcome | operational_action | execution_event   # NOVO v0.2.0 (depende de project_type)
  clause: "<1 frase>"
  positive_examples: [...]
  negative_examples: [...]
  trigger_event: <evento técnico>
  audit_log_event_expected: "<event_name>"                          # NOVO v0.2.0 (obrigatório se ai_enabled=false)
baseline_handoff:
  model: human_baseline | platform_baseline                          # NOVO v0.2.0
  ready_for: "/acme:unit-economics" | "/acme:spec --type=platform-module"
  fields_collected: [volume_monthly, actors, hours_per_unit, error_rate, rework_rate, current_tool, infra_monthly_brl]
  fields_missing: []
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:spec --type=<tipo-resolvido> --client_id=<> --artifact_id=<>"
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
| 0.2.0 | 2026-05-08 | **Delivery-type aware** — aceita `--project_type` ∈ {agentic_saas, platform, automation, hybrid} e `--ai_enabled`. Bloco 5 do roteiro adapta ao tipo (operational_action para platform; classified_outcome para agentic). Output emite `project_type`, `ai_enabled`, `proposed_outcome.kind`, `audit_log_event_expected`, `baseline_handoff.model`. Backwards compatible (defaults legados quando ausente). Forge-9. |
