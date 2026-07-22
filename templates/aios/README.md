# Templates AIOS — Agentes Portáveis (TDD-first)

> **Foundry-7 + Foundry-10 (v0.9.0)** — biblioteca canônica de templates dos 6 agentes AIOS Server (`agiresearch/AIOS` v0.2.2+) para projetos consumidores.
> Vinculado a: C4 (TDD enforcement), C5 (three-tier), C6 (telemetry), C7 (portability), C8 (anti-heroic).

---

## O que é isto

Conjunto de **boilerplates físicos** dos 6 agentes especializados que compõem o pipeline AIOS de um projeto consumidor da Foundry:

| Agente | Especialidade por módulo? | Responsabilidade |
|---|---|---|
| `spec_agent` | ✅ por módulo | Converte descrição em spec executável |
| `backend_agent` | ✅ por módulo | Implementa API + service layer |
| `frontend_agent` | ✅ por módulo | Implementa UI + telas |
| `schema_agent` | ❌ compartilhado | Propõe schema do banco — **stack escolhida pelo projeto consumidor** |
| `test_agent` | ❌ compartilhado | **TDD-first (v0.9.0+)** — modo `red` gera testes ANTES do build; modo `verify` revisa cobertura após build. Materializa arquivos físicos em `tests/{module}/{unit,integration,e2e}/` |
| `review_agent` | ❌ compartilhado | Revisa output contra spec + checklist Constitution + **gate TDD** (RED→GREEN + coverage por tier) |

> **Não é cópia do SchoolPlatform**. Os SYSTEM_PROMPTs aqui são **neutros e parametrizados**. O `schema_agent`, em particular, **não cravam Prisma/Postgres** — ele lê o `aios/config.yaml` do projeto consumidor para descobrir a stack desejada e adapta a proposta.

---

## Como usar (no projeto consumidor)

### Caminho 1 — via `/novais-digital:aios-init` (recomendado)

```bash
# Foundry instalada no projeto consumidor (./foundry/ ou .claude/)
# Agentes são copiados automaticamente quando você roda:
/novais-digital:aios-init --module {meu_modulo} --tier {A|B|C}
```

O comando:
1. Valida pré-requisitos (spec, config, Python, API key)
2. Copia `templates/aios/agents/{spec,backend,frontend}_agent/` aplicando substituições de placeholders
3. Garante que os 3 agentes compartilhados (`schema`, `test`, `review`) existem em `aios/agents/` (cria uma vez se ausentes)
4. Atualiza `aios/config.yaml` com o novo módulo na lista

### Caminho 2 — manual (consumidor avançado)

```bash
# A partir do diretório do projeto consumidor
cp -r ${FOUNDRY_ROOT}/templates/aios/. ./aios/

# Renomear .template → arquivo final
find ./aios -name "*.template" -exec sh -c 'mv "$1" "${1%.template}"' _ {} \;

# Substituir placeholders (mínimo: {PROJECT_NAME}, {STACK})
sed -i 's/{PROJECT_NAME}/meu-projeto/g' aios/agents/*/entry.py aios/orchestrator.py
```

---

## Pipeline TDD-first (Foundry v0.9.0+)

O orchestrator executa os agentes nesta ordem **canônica**:

```
spec → schema → test(mode=red) → build(back+front em paralelo) → test(mode=verify) → review
```

**Gates humanos obrigatórios (C4)**:

1. Após `spec` — revisar antes de gerar testes.
2. Após `test(red)` — rodar a runtime de teste do projeto e **CONFIRMAR que todos falham**. Se passarem sem implementação, a spec está incompleta ou o teste não exercita o que deveria.
3. Após `build` — rodar novamente e confirmar que viraram GREEN; rodar coverage.
4. Após `verify` — adicionar testes pedidos pelo agent (se houver) antes do review.

O `test_agent` em modo `red`:
- Lê **APENAS** `docs/specs/{module}.md` (isolamento TDD — não pode ver o backend que ainda não existe).
- Materializa arquivos físicos em `tests/{module}/{unit,integration,e2e}/` (não só markdown).
- Aplica `coverage_targets` por tier lido de `aios/config.yaml`: A=70%, B=85%, C=95% (defaults).
- Gera matriz "requisito da spec → teste" no plano em `docs/specs/_tests_{module}.md`.
- Não sobrescreve testes editados manualmente — cria `.proposed` ao lado.

O `test_agent` em modo `verify`:
- Lê backend + frontend gerados + plano RED.
- Aponta gaps de cobertura por requisito.
- Devolve `VEREDICTO: TESTES SUFICIENTES` ou `VEREDICTO: ADICIONAR TESTES`.

---

## Placeholders suportados

Todos os arquivos `.template` usam **chaves duplas-chaves** ou `{}` simples conforme convenção da Foundry. Lista exaustiva:

| Placeholder | Onde aparece | Default sugerido | Quem preenche |
|---|---|---|---|
| `{PROJECT_NAME}` | SYSTEM_PROMPT, orchestrator, config | nome do repo consumidor | `/novais-digital:aios-init` ou humano |
| `{STACK_BACKEND}` | backend_agent SYSTEM_PROMPT | declarar no `aios/config.yaml` → `stack.backend` | humano (ADR/setup) |
| `{STACK_FRONTEND}` | frontend_agent SYSTEM_PROMPT | declarar em `aios/config.yaml` → `stack.frontend` | humano |
| `{STACK_DB}` | schema_agent SYSTEM_PROMPT | declarar em `aios/config.yaml` → `stack.database` | humano |
| `{STACK_TESTS_UNIT}` | test_agent (RED) | `aios/config.yaml` → `stack.tests_unit` (ex: Vitest, Jest, pytest) | humano |
| `{STACK_TESTS_INTEGRATION}` | test_agent (RED) | `aios/config.yaml` → `stack.tests_integration` | humano |
| `{STACK_TESTS_E2E}` | test_agent (RED) | `aios/config.yaml` → `stack.tests_e2e` (ex: Playwright, Cypress, "—") | humano |
| `{TIER}` | config.json de cada agente, SYSTEM_PROMPT do spec | `B` (default) | `/novais-digital:aios-init` |
| `{MODULE}` | `aios/agents/{module}_*` (path) e prompts | nome do módulo solicitado | `/novais-digital:aios-init` |
| `{TENANT_FIELD_NAME}` | schema_agent SYSTEM_PROMPT | `tenantId` (default) | humano (se diferente) |

**Nada é hardcoded por cliente** — exigência C8.

---

## Garantias de Constitution

| Princípio | Como os templates aplicam |
|---|---|
| **C5** Three-tier | `tier: A | B | C` no `config.json` de cada agente; pipeline respeita gates humanos por tier |
| **C6** Telemetry-by-default | Todo `entry.py` tem bloco `langfuse.trace() → generation.end()` obrigatório + `_MockTrace` para dev local |
| **C7** Portability | SYSTEM_PROMPT de cada agente funciona **standalone em Claude Code** sem o kernel AIOS rodando — declarado em comentário no topo |
| **C8** Anti-heroic | `tenantId` em `task_input`, nunca no SYSTEM_PROMPT; nenhuma referência a nome de cliente; stack lida de `aios/config.yaml`, não cravada |

---

## Estrutura

```
templates/aios/
├── README.md                          # este arquivo
├── orchestrator.py.template           # pipeline + lista de módulos lida do config
├── config.yaml.template               # llm + server + memory + storage + log + stack + modules
└── agents/
    ├── spec_agent/
    │   ├── entry.py.template
    │   └── config.json.template
    ├── backend_agent/
    │   ├── entry.py.template
    │   └── config.json.template
    ├── frontend_agent/
    │   ├── entry.py.template
    │   └── config.json.template
    ├── schema_agent/                  # COMPARTILHADO — stack-agnostic
    │   ├── entry.py.template
    │   └── config.json.template
    ├── test_agent/                    # COMPARTILHADO
    │   ├── entry.py.template
    │   └── config.json.template
    └── review_agent/                  # COMPARTILHADO
        ├── entry.py.template
        └── config.json.template
```

---

## Padrão de telemetria

Cada `entry.py.template` contém o bloco padrão Langfuse documentado em [`docs/foundry/aios-telemetry-pattern.md`](../../docs/foundry/aios-telemetry-pattern.md).

O `_MockTrace` é fallback aceitável **apenas em desenvolvimento local** (sem `LANGFUSE_PUBLIC_KEY` no ambiente). Antes de promover para SHADOW, configurar Langfuse de verdade — caso contrário `/novais-digital:promote` rejeita o gate de telemetria.

---

## Diferenças vs. implementação de referência (SchoolPlatform)

| Aspecto | SchoolPlatform | Templates Foundry |
|---|---|---|
| SYSTEM_PROMPT | "Você é o X do projeto AcmeEdu" | "Você é o X do projeto **{PROJECT_NAME}**" |
| Caminhos de contexto | `funcionalidades-do-projeto.md` cravado | `docs/specs/{module}.md` (única fonte) |
| Stack | Next.js 15 + Prisma + Postgres + Vitest cravados | Lidos de `aios/config.yaml` → `stack.*` |
| Lista de módulos | Hardcoded em `orchestrator.py` (15 módulos cravados) | Lida de `aios/config.yaml` → `modules:` |
| Telemetria | Sem Langfuse | `langfuse.trace() → generation.end()` em **todos** os agentes (C6) |
| `tenantId` | Implícito no contexto | Sempre via `task_input["tenant_id"]` (C8) |

---

## Integração com CI/CD

Os templates AIOS são consumidos pelos workflows em `templates/cicd/`:

| Workflow | Lê do AIOS | Função |
|---|---|---|
| `foundry-test.yml` | `aios/config.yaml` → `modules[]`, `test_commands`, `coverage_targets` | Roda unit/integration/e2e em matrix por módulo; coverage gate |
| `foundry-validate.yml` (G6) | `tests/{module}/unit/` presente para módulos modificados em `src/` | Bloqueia PR onde código novo não tem teste RED |
| `foundry-eval.yml` | `prompts/` modificados | Eval LLM (independente do TDD; complementar) |
| `foundry-audit.yml` | mensal | Auditoria DeepAgent (independente) |

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-07 | Versão inicial — Foundry-7 (extração para templates portáveis a partir do SchoolPlatform) |
| 0.2.0 | 2026-05-12 | Foundry-10 — pipeline TDD-first; `test_agent` ganha modos `red`/`verify`; materializa arquivos físicos em `tests/{module}/`; orchestrator reordenado; review_agent enforce gate TDD; `coverage_targets` + `test_commands` no config.yaml |
