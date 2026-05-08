---
description: Gera plano técnico do artefato a partir de docs/specs/{artifact_id}.md + c4_thresholds + process-map. Define camadas (C5), abstração de modelo/provider (C7), pontos de instrumentação (C6), estratégia de TenantContext (C8). Output: docs/clients/{client_id}/plan-{artifact_id}.md. NÃO escolhe modelo final — `target_model_advisory` é sugestão do sla-threshold.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - artifact_id
  optional:
    - client_id
    - target_runtime
    - reuse_components_from
forge_command_version: 0.1.0
linked_principles: [C5, C6, C7, C8]
invokes_skills:
  - "@offerings-loader"
output_artifact: docs/clients/{client_id}/plan-{artifact_id}.md
trace_required: true
---

# /acme:plan — Plano técnico

## Propósito

Traduz a cadeia `spec → c4_thresholds → process-map → baseline-cost` em **plano técnico estruturado**: camadas de código, abstração de modelo (C7 obrigatório), pontos de instrumentação (C6 obrigatório), estratégia de configuração de tenant (C8 obrigatório), riscos identificados.

> Esta command **não escolhe modelo nem framework final**. `target_model` é advisory; decisão concreta vem em ADR-002 do projeto consumidor (Forge-3) ou por escolha do dev. Quem aqui escolhe modelo cedo demais quebra C7.

## Pre-conditions

1. `docs/specs/{artifact_id}.md` existe com `c2_validation: pass` e `c4_thresholds` declarados (output de `/acme:sla-threshold`)
2. `docs/clients/{client_id}/baseline-cost-*.md` existe com `c3_check.status` ∈ {viable, tight}
3. `docs/clients/{client_id}/process-*.md` existe com `agent_readiness_score >= 0.5`
4. `__forge_cache.offerings` disponível
5. Tracing configurado

## Inputs

```yaml
artifact_id: <slug>
# opcionais
client_id: <slug>                          # auto-detect via spec.linked_cliente_artifacts
target_runtime: node-ts | python | other   # advisory; default lê de spec.target_runtime ou env
reuse_components_from: [<artifact_id>...]  # se houver SKU/produto irmão para reuso de helpers
```

## Execução

```
1. Trace start

2. Helpers Tier 1:
   - @offerings-loader (validar artifact_id + lifecycle_stage; identificar variantes/parents)

3. Tier 2 — leitura cruzada:
   - spec.outcome_clause + outcome_categories + c4_thresholds (define o que precisa rodar)
   - process-map.steps + decision_points + automatable_hypotheses (define como roda)
   - baseline-cost.c3_check.cost_per_outcome_max (orçamento por execução)

4. Compor plano em 8 seções canônicas (abaixo)

5. Persistir docs/clients/{client_id}/plan-{artifact_id}.md

6. Trace end + output structured
```

## Estrutura canônica do plan (8 seções)

```markdown
---
artifact_id: <>
client_id: <>
plan_version: 0.1.0
spec_path: docs/specs/<>.md
spec_version: <>
target_runtime_advisory: node-ts
target_model_advisory: claude-sonnet | gpt-5.5 | gemini-pro
forge_command_version: plan@0.1.0
linked_principles: [C5, C6, C7, C8]
generated_at: 2026-04-30T...
---

## 1. Escopo derivado da spec
- Outcome (literal): <copiado da spec>
- Categorias: [...]
- Threshold de qualidade humana: <do diagnostic>
- C4 thresholds (do sla-threshold): { agreement_rate_min, latency_p95_ms, cost_per_outcome_max, ... }

## 2. Camadas de código (princípio C5/C7)
| Camada | Path proposto | Responsabilidade | Princípio |
|---|---|---|---|
| Skill caller | src/skus/{artifact_id}/index.ts | Orquestra fluxo do artefato | C5 (Tier 3) |
| Prompt loader | src/skus/{artifact_id}/prompt.ts | Carrega prompts/{id}/v*/system.md | C7 (markdown universal) |
| Model adapter | src/llm/adapters/<provider>.ts | **Única** dependência de SDK do provider | C7 hard rule |
| TenantContext | src/tenants/context.ts | Resolve {{tenant.*}} placeholders | C8 |
| Telemetry wrapper | src/observability/trace.ts | Instrumenta toda chamada LLM | C6 hard rule |

> **Imports do SDK do provider proibidos fora de `src/llm/adapters/`**. Lint regex enforce no `pre-merge-check` (Forge-2 F2.3).

## 3. Fluxo de dados (input → output)
1. Trigger event recebido
2. Carrega TenantContext (C8)
3. Carrega prompt versionado (`prompts/{artifact_id}/v{version}/system.md`)
4. Compõe input estruturado (schema declarado em spec)
5. Chama model_adapter (com trace wrapper)
6. Valida output contra schema (spec.output_schema)
7. Classifica `outcome_category` + `confidence`
8. Persiste run + trace
9. Decide: deliver (se mode != shadow) ou stash (se shadow)

## 4. Pontos de instrumentação (C6)
| Ponto | Evento | Campos no trace |
|---|---|---|
| Pre-LLM | call_start | input_hash, prompt_hash, tenant_id, mode |
| Post-LLM | call_end | output_hash, outcome_category, confidence, latency_ms, cost |
| Outcome | outcome_emitted | run_id, category, delivered, billing_amount |
| Erro | error_caught | error_class, retry_count |

> Trace **obrigatório** em todos os 4 pontos. Sem trace = outcome não conta. Lint regex no `pre-merge-check` exige `tracer.observe()` em handlers.

## 5. TenantContext (C8)
- Schema: `{ tenant_id, name (display), tone, escalation_email, custom_fields: {...} }`
- Resolução: `{{tenant.field}}` no prompt → substituído em runtime, **nunca** em código
- Proibido: `if (tenant_id === 'acme')`, `switch (tenant_name)` (lint regex enforce)
- Permitido: `tenant.custom_fields.<chave>` configurada via DB/yaml
- Multi-tenant: cada tenant tem entrada em `tenants/{tenant_id}.yaml` ou DB equivalente

## 6. Cronograma estimado (faixas, não compromisso)
| Fase | Output | Estimativa | Bloqueia |
|---|---|---|---|
| Setup | scaffolding + adapter | 1-2 dias | — |
| Prompt build | system.md v0.1.0 | 1 dia | — |
| Eval suite seed | ≥30 cases/categoria | 2-3 dias | SHADOW |
| SHADOW | janela ≥14 dias | 14+ dias | promotion |
| ASSISTED | gate humano | — | AUTONOMOUS |

## 7. Riscos identificados
- [ ] Risco de dado: <process-map com data_confidence: low?>
- [ ] Risco de margem: <c3_check.status == tight?>
- [ ] Risco de cobertura: <decision points sem dado disponível?>
- [ ] Risco de drift: <ICP/DNA marcado outdated?>
- [ ] Risco regulatório: <PII detectada no input schema?>

## 8. Critérios de pronto do plan
- Cada seção 1-7 preenchida com referência rastreável a spec/process-map/baseline
- Nenhum nome de provider hardcoded fora de `src/llm/adapters/` no plano
- Pelo menos 4 pontos de instrumentação declarados
- TenantContext schema declarado mesmo se cliente único atual (preparação multi-tenant)
- Próximo passo: `/acme:tasks --artifact_id=<>`
```

## 9. Classificação AIOS (quando `aios_tier` presente na spec)

> Esta seção é **opcional** — gerada automaticamente quando `spec.aios_tier` está definido.
> Se `aios_tier` for vazio ou ausente, esta seção não é incluída no plan.

```markdown
## 9. Classificação AIOS

| Módulo | Tier | Justificativa | Agentes envolvidos |
|---|---|---|---|
| {módulo} | A/B/C | {complexidade, risco, domínio} | spec → backend + frontend → test → review |

**Observação sobre Tier C**: módulos Tier C são implementados diretamente por Rafael
com assistência dos agentes. O AIOS orquestra mas Rafael revisa cada step inline.

**C7 — Portabilidade**: os SYSTEM_PROMPTs de cada agente funcionam como prompts standalone
em Claude Code — sem dependência do kernel AIOS. Kernel offline ≠ agente inutilizável.

**C8 — Anti-heroic**: `tenantId` vai em `task_input` de cada agente, nunca hardcoded
no SYSTEM_PROMPT. Agente genérico → configuração via input, não via código.

**Próximo passo**:
- Tier A/B: `python aios/orchestrator.py pipeline --module {módulo}`
  (ou via `/acme:aios-run --module {módulo}`)
- Tier C: `python aios/orchestrator.py spec --module {módulo}` e iterar com Rafael
  (ou via `/acme:aios-run --module {módulo} --step spec`)
```

## Output structured (return value)

```yaml
command: /acme:plan
status: ok | warn | error
artifact_id: <>
plan_path: docs/clients/<>/plan-<>.md
plan_version: 0.1.0
sections_present: [1, 2, 3, 4, 5, 6, 7, 8]  # inclui seção 9 se aios_tier definido
aios_tier: A | B | C | null              # null se spec não tem aios_tier
target_runtime_advisory: node-ts
target_model_advisory: claude-sonnet
abstraction_layer_declared: true     # C7 — src/llm/adapters/
instrumentation_points_count: 4      # C6 — mínimo 4
tenant_context_schema_present: true  # C8
risks_identified: 5
warnings: [...]
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:tasks --artifact_id=<>"
```

## Verification gate

- [x] Todas as 8 seções presentes e não-vazias; seção 9 gerada se `spec.aios_tier` definido
- [x] Cláusula de outcome (Seção 1) idêntica à spec (compare hash)
- [x] Camada `src/llm/adapters/` declarada (C7); plano não menciona import direto de SDK fora dela
- [x] Pelo menos 4 pontos de instrumentação (C6) com campos do trace declarados
- [x] TenantContext schema declarado (C8) — mesmo se cliente único hoje
- [x] Riscos enumerados (≥1, mesmo que `none`); cada risco com checkbox para mitigation
- [x] Cronograma usa faixas, não datas absolutas
- [x] `target_model` declarado como advisory, não compromisso
- [x] Arquivo persistido em `docs/clients/{client_id}/plan-{artifact_id}.md`
- [x] Trace_id não-nulo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou fixar Claude Opus no plano pra acelerar" | Quebra C7; modelo escolhido cedo prende arquitetura | `target_model_advisory` apenas; decisão concreta vai para ADR-002 ou config |
| "Cliente único hoje, dispenso TenantContext" | Quebra C8; multi-tenant adicionado depois é refactoring caro | TenantContext schema mandatório desde dia 1, mesmo com 1 cliente |
| "Instrumentação só em produção, dev fica simples" | Quebra C6; sem trace em dev, eval suite não simula realidade | Trace em todos ambientes; flag de amostragem aceitável só em prod AUTONOMOUS pós Forge-4 |
| "Vou copiar plano de outro SKU pra acelerar" | Quebra C8; cláusula e categorias são únicas por artefato | Plano gerado a partir desta spec; reuso vem em `reuse_components_from` referenciando módulos compartilhados, não conteúdo |
| "Riscos óbvios, omito" | Sem riscos identificados, mitigation ausente em tasks | Pelo menos 5 categorias varridas (dado, margem, cobertura, drift, regulatório); declarar `none` se aplicável |
| "Cronograma com datas firmes pra cobrar" | Cronograma sem SHADOW de 14 dias mínimos é fraude C4 | Faixas declaradas com `bloqueia` mostrando dependências |
| "Skip C5 — vou misturar tiers no mesmo módulo" | Quebra hierarquia; helper pattern e cache desmoronam | Camadas tabuladas com tier explícito em cada uma |

## Saída de erro estruturada

```yaml
command: /acme:plan
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `spec_c2_validation_failed` | `c4_thresholds_missing` | `c3_unviable` | `process_map_below_readiness` | `abstraction_layer_missing_in_plan` | `tenant_context_missing` | `instrumentation_below_minimum` | `client_dir_unwritable`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 2 (implementation) |
