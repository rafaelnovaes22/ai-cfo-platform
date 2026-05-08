---
description: Quebra o plan em tasks ordenadas com dependências, gate de pronto e skill/tool por task. Tasks organizadas em 6 ondas (scaffolding → prompt → eval seed → SHADOW prep → metrics → CI/CD setup). Output: docs/clients/{client_id}/tasks-{artifact_id}.md como checklist machine-readable.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - artifact_id
  optional:
    - client_id
    - granularity
forge_command_version: 0.1.0
linked_principles: [C1, C5, C6]
invokes_skills: []
output_artifact: docs/clients/{client_id}/tasks-{artifact_id}.md
trace_required: true
---

# /acme:tasks — Quebra plan em checklist

## Propósito

Transforma o `plan-{artifact_id}.md` em **lista executável de tasks** com:
- Gate de pronto declarado por task (alinhado a C1 — "o que conta como feito")
- Dependências explícitas (DAG, não árvore)
- Skill/tool atribuída a cada task (rastreabilidade do reviewer)
- Tier respeitado (C5)
- Trace obrigatório onde aplicável (C6)

A lista alimenta `/acme:implement`, que executa as tasks orquestrando as skills do Forge-1.

## Pre-conditions

1. `docs/clients/{client_id}/plan-{artifact_id}.md` existe com todas 8 seções e `verification_gate: pass`
2. `docs/specs/{artifact_id}.md` referenciado no plan resolve em arquivo
3. Tracing configurado

## Inputs

```yaml
artifact_id: <slug>
# opcionais
client_id: <slug>            # auto-detect via plan
granularity: standard | fine # default standard; fine quebra por step do process-map
```

## Execução

```
1. Trace start

2. Ler plan-{artifact_id}.md → seções 2 (camadas), 3 (fluxo), 4 (instrumentação), 5 (tenant), 7 (riscos)

3. Ler spec → outcome_categories, c4_thresholds

4. Gerar tasks distribuídas em 6 ondas (estrutura abaixo)

5. Validar DAG (sem ciclo; toda dependência resolve)

6. Persistir docs/clients/{client_id}/tasks-{artifact_id}.md

7. Trace end + output structured
```

## Estrutura canônica do tasks.md

```markdown
---
artifact_id: <>
client_id: <>
plan_path: docs/clients/<>/plan-<>.md
generated_at: 2026-04-30T...
forge_command_version: tasks@0.1.0
total_tasks: <N>
total_waves: 5
---

## Wave 1 — Scaffolding (camadas, sem lógica de negócio)

### T1.1 — Criar estrutura de diretórios
- **Skill/tool**: bash mkdir | shell
- **Path criados**: `src/skus/{artifact_id}/`, `src/llm/adapters/`, `src/observability/`, `src/tenants/`, `prompts/{artifact_id}/v0.1.0/`
- **Gate de pronto**: `find src -type d` retorna paths esperados
- **Depends on**: —
- **Tier**: 3 (operacional)
- **Trace required**: false

### T1.2 — Criar TenantContext schema (C8)
- **Skill/tool**: editor manual + lint
- **Output**: `src/tenants/context.ts` (schema + interface)
- **Gate de pronto**: schema parseia + lint passa + `tenant_id`, `name`, `custom_fields` presentes
- **Depends on**: T1.1
- **Tier**: 3
- **Trace required**: false

### T1.3 — Criar abstração de modelo (C7)
- **Skill/tool**: editor manual
- **Output**: `src/llm/adapters/<provider>.ts` (interface + implementação primária)
- **Gate de pronto**: import do SDK do provider só aparece neste arquivo (lint regex)
- **Depends on**: T1.1
- **Tier**: 3
- **Trace required**: false

### T1.4 — Criar wrapper de telemetria (C6)
- **Skill/tool**: editor manual
- **Output**: `src/observability/trace.ts` com `trace.observe(fn)`, `trace.start()`, `trace.end()`
- **Gate de pronto**: chamadas a model_adapter automaticamente envelopadas em trace
- **Depends on**: T1.3
- **Tier**: 3
- **Trace required**: false

## Wave 2-AIOS — Setup e execução de agentes (emitida quando `spec.aios_tier` presente)

> Esta onda **substitui parcialmente** Wave 2 quando o artefato usa AIOS como camada de implementação.
> Se `aios_tier` não estiver definido na spec, esta onda não é gerada e Wave 2 padrão é usada.

### T2-AIOS-1 — Inicializar agentes AIOS para o módulo

- **Skill/tool**: `/acme:aios-init --module {módulo} --tier {A|B|C}`
- **Output**: `aios/agents/{módulo}_spec_agent/`, `aios/agents/{módulo}_backend_agent/`, `aios/agents/{módulo}_frontend_agent/`
- **Gate de pronto**: `aios/agents/{módulo}_spec_agent/entry.py` existe + `config.json` com `"tier": "{A|B|C}"` + `/acme:aios-init` retornou `status: ok`
- **Depends on**: T1.5 (scaffolding base completo) — `aios/config.yaml` e `.env` existem
- **Tier**: 3
- **Trace required**: false

### T2-AIOS-2 — Executar build (backend + frontend em paralelo)

- **Skill/tool**: `/acme:aios-run --module {módulo} --step build` (ou `python aios/orchestrator.py build --module {módulo}`)
- **Output**: `docs/specs/_backend_{módulo}.md` + `docs/specs/_frontend_{módulo}.md`
- **Gate de pronto**: Rafael revisa e aprova `_backend_{módulo}.md` e `_frontend_{módulo}.md` (gate humano C4 via `/acme:aios-run`)
- **Depends on**: T2-AIOS-1
- **Tier**: 3
- **Trace required**: true

### T2-AIOS-3 — Executar testes e review

- **Skill/tool**: `/acme:aios-run --module {módulo} --step test` + `--step review` (ou `python aios/orchestrator.py test --module {módulo} && python aios/orchestrator.py review --module {módulo}`)
- **Output**: `docs/specs/_tests_{módulo}.md` + `docs/specs/_review_{módulo}.md`
- **Gate de pronto**: `_review_{módulo}.md` existe e **não contém** a string "BLOCKER" — verificado por Rafael
- **Depends on**: T2-AIOS-2
- **Tier**: 3
- **Trace required**: true

### T2-AIOS-4 — Mover código aprovado para src/

- **Skill/tool**: Rafael move manualmente após revisar `_review_{módulo}.md`
- **Output**: `src/{módulo}/` com código aprovado commitado
- **Gate de pronto**: `src/{módulo}/` existe com commit `feat({módulo}): código aprovado pós-review AIOS`
- **Depends on**: T2-AIOS-3
- **Tier**: 3
- **Trace required**: false

---

## Wave 2 — Prompt build
- **Skill/tool**: `@artifact-prompt-builder`
- **Inputs**: artifact_id, artifact_type, spec_path, process_map_path, baseline_cost_path
- **Output**: `prompts/{artifact_id}/v0.1.0/system.md` + `prompt_hash`
- **Gate de pronto**: skill retorna `prompt_built: true` com 9 seções e `recalc_unit_economics_required: true`
- **Depends on**: T1.1
- **Tier**: 3
- **Trace required**: true

### T2.2 — Wire prompt loader
- **Skill/tool**: editor manual
- **Output**: `src/skus/{artifact_id}/prompt.ts` (lê system.md por versão; cacheia em runtime)
- **Gate de pronto**: dado `prompt_version`, retorna conteúdo + hash registrado
- **Depends on**: T2.1
- **Tier**: 3

## Wave 3 — Eval suite seed (precondição C4)

### T3.{n} — Gerar 30+ casos por outcome_category
- Para **cada categoria** em `spec.outcome_categories`:
  - **Skill/tool**: `@eval-case-author`
  - **Inputs**: artifact_id, outcome_category=<categoria>, source_mode=real|synthetic|edge|adversarial, target_count=10 (loop até 30+)
  - **Output**: `evals/{artifact_id}/cases/case-{categoria}-{nnn}.md`
  - **Gate de pronto**: `coverage_after.cases_in_category_<>=30` E `c4_threshold_met: true`
  - **Depends on**: T2.1
  - **Tier**: 3
  - **Trace required**: true

### T3.LAST — Validar suite global
- **Skill/tool**: lint + `@eval-engineer` (Forge-3) ou check manual
- **Gate de pronto**: nenhuma duplicata; ≤40% sintético; ≥1 edge/adversarial por categoria
- **Depends on**: todas T3.{n}
- **Tier**: 3

## Wave 4 — SHADOW prep

### T4.1 — Criar subscription em modo SHADOW
- **Skill/tool**: editor manual / DB seed
- **Output**: registro em `subscriptions/` com `mode: shadow`, `delivered: false`, `billing: 0`
- **Gate de pronto**: subscription persistida + lint detecta `mode == shadow`
- **Depends on**: T2.2, T3.LAST
- **Tier**: 3

### T4.2 — Verificar precondições de @shadow-mode-runner.start
- **Skill/tool**: dry-run de `@shadow-mode-runner --action=start`
- **Output**: relatório de precondições (6 checks de C4)
- **Gate de pronto**: skill retorna `preconditions_checked: { all: true }` (sem invocar start ainda)
- **Depends on**: T4.1
- **Tier**: 3
- **Trace required**: true

## Wave 5 — Metrics & dashboards

### T5.1 — Configurar dashboards Langfuse (ou equivalente)
- **Skill/tool**: editor manual + provider-specific config
- **Output**: dashboards de agreement_rate, latency_p95, cost_per_outcome, runs_total
- **Gate de pronto**: dashboard renderiza com dados zerados antes do SHADOW iniciar
- **Depends on**: T4.2
- **Tier**: 3

### T5.2 — Definir alertas
- **Skill/tool**: editor manual
- **Output**: alerts em latency p95 > threshold, cost > threshold, error rate >5%
- **Gate de pronto**: alerts ativos + canal de notificação configurado
- **Depends on**: T5.1
- **Tier**: 3

## Wave 6 — CI/CD Setup (pré-requisito obrigatório para AUTONOMOUS)

> Esta onda implementa a esteira de CI/CD que o Gate 6 do `/acme:promote` exige antes de
> `assisted_to_autonomous`. Pode ser paralelizada com Wave 5, mas deve estar completa antes de
> qualquer promoção para AUTONOMOUS.

### T6.1 — Criar workflow de validação estrutural (forge-validate)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-validate.template.yml`
- **Output**: `.github/workflows/forge-validate.yml` com 3 jobs (forge-doctor, skill-security-scan, pre-merge-check)
- **Gate de pronto**: PR de teste dispara o workflow; todos os jobs passam; `forge-doctor.sh` retorna exit 0
- **Depends on**: T1.1 (estrutura base existe)
- **Tier**: 3
- **Trace required**: false

### T6.2 — Criar workflow de eval automático (forge-eval)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-eval.template.yml` + implementar `scripts/eval-runner.py`
- **Output**: `.github/workflows/forge-eval.yml` + `scripts/eval-runner.py` (adapter LLM para CI)
- **Gate de pronto**: PR com mudança em `prompts/` dispara eval; relatório gerado em `evals/{id}/runs/`; PR falha se pass_rate < threshold
- **Depends on**: T3.LAST (eval cases existem)
- **Tier**: 3
- **Trace required**: true (eval em CI deve ter trace Langfuse — C6)

### T6.3 — Configurar branch protection rules
- **Skill/tool**: GitHub Settings → Branches (manual) ou `gh api` CLI
- **Output**: branch protection em `main`/`master` com status checks obrigatórios (forge-doctor, skill-security-scan, pre-merge-check)
- **Gate de pronto**: tentativa de push direto em `main` é bloqueada; PR sem CI passing não pode ser mergeado
- **Depends on**: T6.1
- **Tier**: 3
- **Trace required**: false

### T6.4 — Criar workflow de auditoria mensal (forge-audit)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-audit.template.yml`
- **Output**: `.github/workflows/forge-audit.yml` com cron mensal (1ª seg. 06:00 UTC)
- **Gate de pronto**: trigger manual `workflow_dispatch` gera `docs/forge/audits/{YYYY-MM}.md` commitado; issue criada se SLA breach
- **Depends on**: T6.1
- **Tier**: 3
- **Trace required**: false

### T6.5 — Preencher e assinar CI/CD checklist
- **Skill/tool**: editor manual — preencher `docs/cicd-checklist-{artifact_id}.md` a partir de `templates/cicd/cicd-checklist.template.md`
- **Output**: `docs/cicd-checklist-{artifact_id}.md` com todos os itens 🔴 marcados e `gate_6_status: pass`
- **Gate de pronto**: checklist com `items_red_checked == items_red_total`; `ci_pipeline_url` preenchido; `last_ci_run_status: passing`
- **Depends on**: T6.1, T6.2, T6.3, T6.4
- **Tier**: 3
- **Trace required**: false

## Resumo de dependências (DAG)

```
T1.1 ─┬─→ T1.2
      ├─→ T1.3 ─→ T1.4
      └─→ T2.1 ─→ T2.2 ─┐
                  └─→ T3.{n} ─→ T3.LAST ─→ T4.1 ─→ T4.2 ─→ T5.1 ─→ T5.2
                                    │
                                    └──────────────────────────────────────→ T6.2
T1.1 ──────────────────────────────────────────────────────────────────────→ T6.1 ─→ T6.3
                                                                                    └─→ T6.4
T6.1, T6.2, T6.3, T6.4 ────────────────────────────────────────────────────────────→ T6.5
```
```

## Output structured

```yaml
command: /acme:tasks
status: ok | error
artifact_id: <>
tasks_path: docs/clients/<>/tasks-<>.md
total_tasks: <N>
total_waves: 6
dag_validation:
  cycles: 0
  unresolved_dependencies: 0
  total_edges: <N>
trace_required_count: <N>   # tasks com trace
estimated_total_days_low: <N>
estimated_total_days_high: <N>
trace_id: <>
next_step: "/acme:implement --artifact_id=<>"
```

## Verification gate

- [x] 6 ondas presentes; cada onda com ≥ 1 task
- [x] Toda task tem: skill/tool, output, gate de pronto, depends_on, tier, trace_required
- [x] DAG sem ciclos; toda `depends_on` resolve em task existente
- [x] Wave 3 expande para `len(spec.outcome_categories)` tasks T3.{n}, cada uma com target ≥30 cases
- [x] Wave 1 contém scaffolding C5/C7/C8/C6 antes de qualquer lógica de negócio
- [x] Wave 4 não inicia SHADOW; só prepara (start vai em `/acme:promote`)
- [x] Wave 6 contém as 5 tasks de CI/CD (T6.1–T6.5); T6.5 é gate de pronto do conjunto
- [x] T6.5 produz `docs/cicd-checklist-{artifact_id}.md` com `gate_6_status: pass` — Gate 6 do `/acme:promote`
- [x] Trace requerido marcado em tasks que invocam skill com `trace_required`
- [x] Arquivo persistido com frontmatter completo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Wave 3 com 10 cases é suficiente pra começar" | Quebra C4 (≥30 por categoria); SHADOW depois bloqueia | T3.LAST exige `c4_threshold_met: true`; tasks loopam até atingir |
| "Junto Wave 1+2 pra ir mais rápido" | Sem scaffolding (T1.4 — telemetria), prompt buildado em T2.1 não tem onde escrever traces | Ondas têm dependência estrutural; manter ordem |
| "Wave 4 inicia SHADOW direto" | Quebra ownership: SHADOW start é decisão humana via `/acme:promote` | Wave 4 prepara; start fica fora de tasks (decisão de promotion-officer) |
| "Tier não aparece em scaffolding (não é skill)" | Sem tier, lint C5 não detecta vazamento entre módulos | Toda task em Wave 1+ declara tier mesmo se manual |
| "Granularidade fine = 1 task por step" | Pode explodir em 50+ tasks; ruído sem ganho de clareza | `granularity=fine` só agrupa por decision point, não por step linear |
| "Eval suite só sintético, é mais fácil" | Quebra meta ≥60% real após 90 dias | Tasks T3.{n} declaram split source_mode com cap de 40% sintético |
| "Tarefas T1.x sem gate de pronto, são óbvias" | Sem gate, dev marca pronto incorretamente; reviewer não audita | Cada task tem gate verificável (find, lint, test) |

## Saída de erro estruturada

```yaml
command: /acme:tasks
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `plan_below_verification_gate` | `dag_cycle_detected` | `unresolved_dependency` | `category_explosion` (>30 categorias = revisitar spec) | `client_dir_unwritable`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 2 (implementation) |
| 0.2.0 | 2026-05-07 | Wave 6 CI/CD Setup (T6.1-T6.5); total_waves 5→6; DAG expandido; Forge-8 |
