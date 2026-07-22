---
description: Quebra o plan em tasks ordenadas com dependências, gate de pronto e skill/tool por task. Para agentic (ai_enabled=true): 6 ondas (scaffolding → prompt → eval seed → SHADOW prep → metrics → CI/CD). Para platform (ai_enabled=false): 5 ondas (scaffolding → service build → E2E tests → PILOT prep → CI/CD). Lê docs/foundry/project.json para detectar tipo. Output: docs/clients/{client_id}/tasks-{artifact_id}.md como checklist machine-readable.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - artifact_id
  optional:
    - client_id
    - granularity
    - project_type   # auto-detectado de docs/foundry/project.json se omitido
foundry_command_version: 0.2.0
linked_principles: [C1, C5, C6]
invokes_skills: []
output_artifact: docs/clients/{client_id}/tasks-{artifact_id}.md
trace_required: true
---

# /novais-digital:tasks — Quebra plan em checklist

## Propósito

Transforma o `plan-{artifact_id}.md` em **lista executável de tasks** com:
- Gate de pronto declarado por task (alinhado a C1 — "o que conta como feito")
- Dependências explícitas (DAG, não árvore)
- Skill/tool atribuída a cada task (rastreabilidade do reviewer)
- Tier respeitado (C5)
- Trace obrigatório onde aplicável (C6)

A lista alimenta `/novais-digital:implement`, que executa as tasks orquestrando as skills do Foundry-1.

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
0. Resolver project_type:
   - Ler docs/foundry/project.json → project.type, project.ai_enabled
   - Se ausente: default agentic_saas / ai_enabled=true (compat v0.7.0)
   - ai_enabled=true → gerar 6 ondas agentic (Wave 1, 2, 3, 4, 5, 6)
   - ai_enabled=false → gerar 5 ondas platform (Wave 1P, 2P, 3P, 4P, 6P)

1. Trace start

2. Ler plan-{artifact_id}.md → seções 2/2P (camadas), 3 (fluxo), 4/4P (instrumentação), 5 (tenant), 7 (riscos)

3. Ler spec → outcome_categories (agentic) ou audited_actions + criticality (platform)

4. Gerar tasks distribuídas nas ondas correspondentes (estrutura abaixo)

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
foundry_command_version: tasks@0.1.0
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

- **Skill/tool**: `/novais-digital:aios-init --module {módulo} --tier {A|B|C}`
- **Output**: `aios/agents/{módulo}_spec_agent/`, `aios/agents/{módulo}_backend_agent/`, `aios/agents/{módulo}_frontend_agent/`
- **Gate de pronto**: `aios/agents/{módulo}_spec_agent/entry.py` existe + `config.json` com `"tier": "{A|B|C}"` + `/novais-digital:aios-init` retornou `status: ok`
- **Depends on**: T1.5 (scaffolding base completo) — `aios/config.yaml` e `.env` existem
- **Tier**: 3
- **Trace required**: false

### T2-AIOS-2 — Executar build (backend + frontend em paralelo)

- **Skill/tool**: `/novais-digital:aios-run --module {módulo} --step build` (ou `python aios/orchestrator.py build --module {módulo}`)
- **Output**: `docs/specs/_backend_{módulo}.md` + `docs/specs/_frontend_{módulo}.md`
- **Gate de pronto**: Rafael revisa e aprova `_backend_{módulo}.md` e `_frontend_{módulo}.md` (gate humano C4 via `/novais-digital:aios-run`)
- **Depends on**: T2-AIOS-1
- **Tier**: 3
- **Trace required**: true

### T2-AIOS-3 — Executar testes e review

- **Skill/tool**: `/novais-digital:aios-run --module {módulo} --step test` + `--step review` (ou `python aios/orchestrator.py test --module {módulo} && python aios/orchestrator.py review --module {módulo}`)
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
- **Skill/tool**: lint + `@eval-engineer` (Foundry-3) ou check manual
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

> Esta onda implementa a esteira de CI/CD que o Gate 6 do `/novais-digital:promote` exige antes de
> `assisted_to_autonomous`. Pode ser paralelizada com Wave 5, mas deve estar completa antes de
> qualquer promoção para AUTONOMOUS.

### T6.1 — Criar workflow de validação estrutural (foundry-validate)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-validate.template.yml`
- **Output**: `.github/workflows/foundry-validate.yml` com 3 jobs (foundry-doctor, skill-security-scan, pre-merge-check)
- **Gate de pronto**: PR de teste dispara o workflow; todos os jobs passam; `foundry-doctor.sh` retorna exit 0
- **Depends on**: T1.1 (estrutura base existe)
- **Tier**: 3
- **Trace required**: false

### T6.2 — Criar workflow de eval automático (foundry-eval)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-eval.template.yml` + implementar `scripts/eval-runner.py`
- **Output**: `.github/workflows/foundry-eval.yml` + `scripts/eval-runner.py` (adapter LLM para CI)
- **Gate de pronto**: PR com mudança em `prompts/` dispara eval; relatório gerado em `evals/{id}/runs/`; PR falha se pass_rate < threshold
- **Depends on**: T3.LAST (eval cases existem)
- **Tier**: 3
- **Trace required**: true (eval em CI deve ter trace Langfuse — C6)

### T6.3 — Configurar branch protection rules
- **Skill/tool**: GitHub Settings → Branches (manual) ou `gh api` CLI
- **Output**: branch protection em `main`/`master` com status checks obrigatórios (foundry-doctor, skill-security-scan, pre-merge-check)
- **Gate de pronto**: tentativa de push direto em `main` é bloqueada; PR sem CI passing não pode ser mergeado
- **Depends on**: T6.1
- **Tier**: 3
- **Trace required**: false

### T6.4 — Criar workflow de auditoria mensal (foundry-audit)
- **Skill/tool**: copiar e adaptar `templates/cicd/github-actions-audit.template.yml`
- **Output**: `.github/workflows/foundry-audit.yml` com cron mensal (1ª seg. 06:00 UTC)
- **Gate de pronto**: trigger manual `workflow_dispatch` gera `docs/foundry/audits/{YYYY-MM}.md` commitado; issue criada se SLA breach
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

---

## Ondas platform (ai_enabled=false) — Wave 1P a 4P + Wave 6P

> Gerado quando `project.ai_enabled=false`. Substitui Waves 2, 3, 4 e 5 do path agentic.
> Wave 1 (scaffolding) e Wave 6 (CI/CD) permanecem, com adaptações anotadas.

### Wave 1P — Scaffolding platform

#### T1P.1 — Criar estrutura de diretórios
- **Skill/tool**: bash mkdir | shell
- **Paths criados**: `src/services/{module_id}/`, `src/lib/{module_id}/`, `src/integrations/`, `src/lib/audit.ts`
- **Gate de pronto**: `find src -type d` retorna paths esperados
- **Depends on**: —

#### T1P.2 — Criar TenantContext schema (C8)
- **Skill/tool**: editor manual
- **Output**: `src/lib/tenant/context.ts` com `{ tenant_id, name, config }` — sem hardcode por tenant
- **Gate de pronto**: interface TS exporta corretamente; grep por `=== '` em `src/services/` retorna 0
- **Depends on**: T1P.1

#### T1P.3 — Criar abstração de integração (C7)
- **Skill/tool**: editor manual
- **Output**: `src/integrations/{provider}/index.ts` isolando SDK de terceiro
- **Gate de pronto**: grep por import direto do SDK fora de `src/integrations/` retorna 0
- **Depends on**: T1P.1

#### T1P.4 — Criar audit logger (C6)
- **Skill/tool**: editor manual
- **Output**: `src/lib/audit.ts` com `auditLog.write({ action, userId, tenantId, resourceId, payload_hash })`
- **Gate de pronto**: função exportada; chamada em ao menos 1 route handler de teste; log entry persistida na tabela de auditoria
- **Depends on**: T1P.1

### Wave 2P — Service build (lógica de negócio + audit log)

#### T2P.1 — Implementar service layer
- **Skill/tool**: editor manual / @backend_agent (se AIOS disponível)
- **Output**: `src/services/{module_id}.ts` com CRUD + validação + chamada a auditLog.write()
- **Gate de pronto**: todos os `audited_actions[]` da spec têm chamada `auditLog.write()` correspondente; lint passa
- **Depends on**: T1P.1, T1P.4

#### T2P.2 — Implementar route handlers (API layer)
- **Skill/tool**: editor manual / @frontend_agent (se AIOS disponível)
- **Output**: `src/app/api/{module_id}/route.ts` com autenticação + validação de schema + chamada ao service
- **Gate de pronto**: curl de teste retorna 200; auth missing retorna 401; payload inválido retorna 422
- **Depends on**: T2P.1

#### T2P.3 — Calcular delivery economics (C3)
- **Skill/tool**: `@baseline-cost-builder --mode=platform`
- **Output**: `docs/modules/{module_id}/delivery-economics-{module_id}.md`
- **Gate de pronto**: `platform_margin ≤ 0.25` OU `c3_check.status=tight` com plano de redução declarado
- **Depends on**: T1P.1

### Wave 3P — E2E tests (gate de qualidade C4)

#### T3P.1 — Criar suite E2E por ação auditável
- Para **cada `audited_action`** em `spec.audited_actions[]`:
  - **Skill/tool**: editor manual + Playwright/Vitest
  - **Output**: `tests/e2e/{module_id}/{action}.spec.ts`
  - **Gate de pronto**: teste passa; ação gera entrada no audit log; entry tem campos obrigatórios (action, userId, tenantId, resourceId)
  - **Depends on**: T2P.2

#### T3P.LAST — Validar cobertura E2E
- **Skill/tool**: playwright report / vitest coverage
- **Gate de pronto**: ≥80% de cobertura de `audited_actions[]`; 0 testes falhando
- **Depends on**: todas T3P.1

### Wave 4P — PILOT prep (gate C4 para platform)

#### T4P.1 — Criar pilot-state.md
- **Skill/tool**: editor manual (a partir de `templates/platform-pilot-state.template.md`)
- **Output**: `docs/modules/{module_id}/pilot-state.md` com estado inicial `DRAFT`
- **Gate de pronto**: arquivo parseável; `estado_atual: DRAFT`; responsável declarado
- **Depends on**: T2P.1

#### T4P.2 — Promover para STAGING via /novais-digital:promote
- **Skill/tool**: `/novais-digital:promote --module_id={module_id} --to_mode=to_staging`
- **Output**: `pilot-state.md` atualizado com transição `DRAFT → STAGING`
- **Gate de pronto**: spec e plan aprovados (6 gates Foundry-platform passando); `estado_atual: STAGING`
- **Depends on**: T4P.1, T3P.LAST

#### T4P.3 — Janela de observação STAGING (C4)
- **Skill/tool**: observação humana + logs de produção/staging
- **Output**: no-op (janela de tempo, não artefato)
- **Gate de pronto**: módulo em uso real por ≥3 dias (simples) / ≥7 dias (standard) / ≥14 dias (crítico) sem regressão crítica
- **Depends on**: T4P.2

#### T4P.4 — Promover para PILOT + criar acceptance-report.md
- **Skill/tool**: `/novais-digital:promote --module_id={module_id} --to_mode=to_pilot` + editor manual (`templates/platform-acceptance-report.template.md`)
- **Output**: `pilot-state.md` com `STAGING → PILOT`; `docs/modules/{module_id}/acceptance-report.md` iniciado
- **Gate de pronto**: 6 gates platform passando; arquivo de aceite criado com seção de stakeholders
- **Depends on**: T4P.3

### Wave 6P — CI/CD platform (adaptações de Wave 6)

> As tasks T6.1, T6.3, T6.4 (foundry-validate, branch protection, foundry-audit) se aplicam normalmente.
> T6.2 (foundry-eval) é substituído por T6.2P (foundry-tests — E2E em CI).
> T6.5 (checklist) aplica-se normalmente.

#### T6.2P — Criar workflow de testes E2E (foundry-tests) — substitui T6.2
- **Skill/tool**: editor manual + template CI/CD
- **Output**: `.github/workflows/foundry-tests.yml` disparando `npm run test:e2e` em PRs que tocam `src/services/{module_id}/`
- **Gate de pronto**: PR de teste dispara workflow; todos os E2E passam; PR falha se ≥1 `audited_action` sem cobertura
- **Depends on**: T3P.LAST
- **Trace required**: false

---

## Resumo de dependências (DAG)

### Agentic (ai_enabled=true)

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

### Platform (ai_enabled=false)

```
T1P.1 ─┬─→ T1P.2
       ├─→ T1P.3
       ├─→ T1P.4
       └─→ T2P.1 (service) ─→ T2P.2 (route) ─→ T3P.{n} ─→ T3P.LAST ─→ T4P.1 ─→ T4P.2 ─→ T4P.3 ─→ T4P.4
       └─→ T2P.3 (economics, parallel)
T1P.1 ──────────────────────────────────────────────────────────────────────→ T6.1 ─→ T6.3
T3P.LAST ────────────────────────────────────────────────────────────────────→ T6.2P
T6.1, T6.2P, T6.3, T6.4 ──────────────────────────────────────────────────────────→ T6.5
```

## Output structured

```yaml
command: /novais-digital:tasks
status: ok | error
artifact_id: <>
tasks_path: docs/clients/<>/tasks-<>.md
tasks_variant: agentic | platform        # detectado de project.json
total_tasks: <N>
total_waves: 6                           # agentic: waves 1-6; platform: 1P-4P + 6P (=5 ondas)
dag_validation:
  cycles: 0
  unresolved_dependencies: 0
  total_edges: <N>
trace_required_count: <N>
estimated_total_days_low: <N>
estimated_total_days_high: <N>
trace_id: <>
next_step: "/novais-digital:implement --artifact_id=<>"
```

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-2 onda 2 (implementation) |
| 0.2.0 | 2026-05-08 | Foundry-9: lê docs/foundry/project.json; Waves 1P-4P + 6P para platform; DAG platform; detecção automática de tipo (F9.14) |

## Verification gate

- [x] 6 ondas presentes; cada onda com ≥ 1 task
- [x] Toda task tem: skill/tool, output, gate de pronto, depends_on, tier, trace_required
- [x] DAG sem ciclos; toda `depends_on` resolve em task existente
- [x] Wave 3 expande para `len(spec.outcome_categories)` tasks T3.{n}, cada uma com target ≥30 cases
- [x] Wave 1 contém scaffolding C5/C7/C8/C6 antes de qualquer lógica de negócio
- [x] Wave 4 não inicia SHADOW; só prepara (start vai em `/novais-digital:promote`)
- [x] Wave 6 contém as 5 tasks de CI/CD (T6.1–T6.5); T6.5 é gate de pronto do conjunto
- [x] T6.5 produz `docs/cicd-checklist-{artifact_id}.md` com `gate_6_status: pass` — Gate 6 do `/novais-digital:promote`
- [x] Trace requerido marcado em tasks que invocam skill com `trace_required`
- [x] Arquivo persistido com frontmatter completo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Wave 3 com 10 cases é suficiente pra começar" | Quebra C4 (≥30 por categoria); SHADOW depois bloqueia | T3.LAST exige `c4_threshold_met: true`; tasks loopam até atingir |
| "Junto Wave 1+2 pra ir mais rápido" | Sem scaffolding (T1.4 — telemetria), prompt buildado em T2.1 não tem onde escrever traces | Ondas têm dependência estrutural; manter ordem |
| "Wave 4 inicia SHADOW direto" | Quebra ownership: SHADOW start é decisão humana via `/novais-digital:promote` | Wave 4 prepara; start fica fora de tasks (decisão de promotion-officer) |
| "Tier não aparece em scaffolding (não é skill)" | Sem tier, lint C5 não detecta vazamento entre módulos | Toda task em Wave 1+ declara tier mesmo se manual |
| "Granularidade fine = 1 task por step" | Pode explodir em 50+ tasks; ruído sem ganho de clareza | `granularity=fine` só agrupa por decision point, não por step linear |
| "Eval suite só sintético, é mais fácil" | Quebra meta ≥60% real após 90 dias | Tasks T3.{n} declaram split source_mode com cap de 40% sintético |
| "Tarefas T1.x sem gate de pronto, são óbvias" | Sem gate, dev marca pronto incorretamente; reviewer não audita | Cada task tem gate verificável (find, lint, test) |

## Saída de erro estruturada

```yaml
command: /novais-digital:tasks
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `plan_below_verification_gate` | `dag_cycle_detected` | `unresolved_dependency` | `category_explosion` (>30 categorias = revisitar spec) | `client_dir_unwritable`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-2 onda 2 (implementation) |
| 0.2.0 | 2026-05-07 | Wave 6 CI/CD Setup (T6.1-T6.5); total_waves 5→6; DAG expandido; Foundry-8 |
