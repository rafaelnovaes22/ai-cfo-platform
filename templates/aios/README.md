# Templates AIOS — Agentes Portáveis

> **Forge-7** — biblioteca canônica de templates dos 6 agentes AIOS Server (`agiresearch/AIOS` v0.2.2+) para projetos consumidores.
> Vinculado a: C5 (three-tier), C6 (telemetry), C7 (portability), C8 (anti-heroic).

---

## O que é isto

Conjunto de **boilerplates físicos** dos 6 agentes especializados que compõem o pipeline AIOS de um projeto consumidor da Forge:

| Agente | Especialidade por módulo? | Responsabilidade |
|---|---|---|
| `spec_agent` | ✅ por módulo | Converte descrição em spec executável |
| `backend_agent` | ✅ por módulo | Implementa API + service layer |
| `frontend_agent` | ✅ por módulo | Implementa UI + telas |
| `schema_agent` | ❌ compartilhado | Propõe schema do banco — **stack escolhida pelo projeto consumidor** |
| `test_agent` | ❌ compartilhado | Gera testes priorizados por edge cases |
| `review_agent` | ❌ compartilhado | Revisa output contra spec + checklist Constitution |

> **Não é cópia do SchoolPlatform/EDIX**. Os SYSTEM_PROMPTs aqui são **neutros e parametrizados**. O `schema_agent`, em particular, **não cravam Prisma/Postgres** — ele lê o `aios/config.yaml` do projeto consumidor para descobrir a stack desejada e adapta a proposta.

---

## Como usar (no projeto consumidor)

### Caminho 1 — via `/acme:aios-init` (recomendado)

```bash
# Forge instalada no projeto consumidor (./forge/ ou .claude/)
# Agentes são copiados automaticamente quando você roda:
/acme:aios-init --module {meu_modulo} --tier {A|B|C}
```

O comando:
1. Valida pré-requisitos (spec, config, Python, API key)
2. Copia `templates/aios/agents/{spec,backend,frontend}_agent/` aplicando substituições de placeholders
3. Garante que os 3 agentes compartilhados (`schema`, `test`, `review`) existem em `aios/agents/` (cria uma vez se ausentes)
4. Atualiza `aios/config.yaml` com o novo módulo na lista

### Caminho 2 — manual (consumidor avançado)

```bash
# A partir do diretório do projeto consumidor
cp -r ${FORGE_ROOT}/templates/aios/. ./aios/

# Renomear .template → arquivo final
find ./aios -name "*.template" -exec sh -c 'mv "$1" "${1%.template}"' _ {} \;

# Substituir placeholders (mínimo: {PROJECT_NAME}, {STACK})
sed -i 's/{PROJECT_NAME}/meu-projeto/g' aios/agents/*/entry.py aios/orchestrator.py
```

---

## Placeholders suportados

Todos os arquivos `.template` usam **chaves duplas-chaves** ou `{}` simples conforme convenção da Forge. Lista exaustiva:

| Placeholder | Onde aparece | Default sugerido | Quem preenche |
|---|---|---|---|
| `{PROJECT_NAME}` | SYSTEM_PROMPT, orchestrator, config | nome do repo consumidor | `/acme:aios-init` ou humano |
| `{STACK_BACKEND}` | backend_agent SYSTEM_PROMPT | declarar no `aios/config.yaml` → `stack.backend` | humano (ADR/setup) |
| `{STACK_FRONTEND}` | frontend_agent SYSTEM_PROMPT | declarar em `aios/config.yaml` → `stack.frontend` | humano |
| `{STACK_DB}` | schema_agent SYSTEM_PROMPT | declarar em `aios/config.yaml` → `stack.database` | humano |
| `{STACK_TESTS}` | test_agent SYSTEM_PROMPT | declarar em `aios/config.yaml` → `stack.tests` | humano |
| `{TIER}` | config.json de cada agente, SYSTEM_PROMPT do spec | `B` (default) | `/acme:aios-init` |
| `{MODULE}` | `aios/agents/{module}_*` (path) e prompts | nome do módulo solicitado | `/acme:aios-init` |
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

Cada `entry.py.template` contém o bloco padrão Langfuse documentado em [`docs/forge/aios-telemetry-pattern.md`](../../docs/forge/aios-telemetry-pattern.md).

O `_MockTrace` é fallback aceitável **apenas em desenvolvimento local** (sem `LANGFUSE_PUBLIC_KEY` no ambiente). Antes de promover para SHADOW, configurar Langfuse de verdade — caso contrário `/acme:promote` rejeita o gate de telemetria.

---

## Diferenças vs. implementação de referência (SchoolPlatform/EDIX)

| Aspecto | SchoolPlatform | Templates Forge |
|---|---|---|
| SYSTEM_PROMPT | "Você é o X do projeto EDIX" | "Você é o X do projeto **{PROJECT_NAME}**" |
| Caminhos de contexto | `funcionalidades-edix.md` cravado | `docs/specs/{module}.md` (única fonte) |
| Stack | Next.js 15 + Prisma + Postgres + Vitest cravados | Lidos de `aios/config.yaml` → `stack.*` |
| Lista de módulos | Hardcoded em `orchestrator.py` (15 módulos cravados) | Lida de `aios/config.yaml` → `modules:` |
| Telemetria | Sem Langfuse | `langfuse.trace() → generation.end()` em **todos** os agentes (C6) |
| `tenantId` | Implícito no contexto | Sempre via `task_input["tenant_id"]` (C8) |

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-07 | Versão inicial — Forge-7 (extração para templates portáveis a partir do SchoolPlatform) |
