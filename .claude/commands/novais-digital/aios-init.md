---
name: novais-digital:aios-init
description: "Scaffolda a estrutura aios/agents/{module}/ a partir dos templates físicos canônicos da Foundry"
allowed-tools: [Write, Bash, Read, Edit]
arguments:
  required:
    - module
  optional:
    - tier
    - project_root
    - force
foundry_command_version: 0.2.0
linked_principles: [C5, C6, C7, C8]
invokes_skills: []
output_artifact: aios/agents/{module}_spec_agent/ + aios/agents/{module}_backend_agent/ + aios/agents/{module}_frontend_agent/ + (aios/agents/{schema|test|review}_agent/ se ausentes)
trace_required: false
---

# /novais-digital:aios-init

## Propósito

Cria a estrutura de agentes AIOS para um módulo/artefato copiando os **templates físicos canônicos** mantidos em `templates/aios/` na Foundry.

A partir da v0.2.0 deste comando (Foundry v0.6.0+) o boilerplate **não é mais inline**: cada arquivo gerado é resultado de aplicar substituições em um `.template` mantido na Foundry — assim os 6 agentes evoluem em sincronia entre todos os projetos consumidores.

> Os SYSTEM_PROMPTs gerados funcionam como **prompts standalone em Claude Code** — sem dependência do kernel AIOS (C7 obrigatório).

## Inputs

```yaml
module: <kebab-case>           # nome do módulo
# opcionais
tier: A | B | C                # A=autônomo, B=iterativo, C=Rafael-dirige (default B)
project_root: <path>           # raiz do projeto consumidor (default: cwd)
force: false                   # sobrescreve aios/agents/{module}_*/ existentes
```

## Onde os templates vivem

```
${FOUNDRY_ROOT}/templates/aios/
├── README.md                          # documentação dos placeholders e estrutura
├── orchestrator.py.template
├── config.yaml.template
└── agents/
    ├── spec_agent/                    # ESPECIALIZADO por módulo
    ├── backend_agent/                 # ESPECIALIZADO por módulo
    ├── frontend_agent/                # ESPECIALIZADO por módulo
    ├── schema_agent/                  # COMPARTILHADO — stack-agnostic
    ├── test_agent/                    # COMPARTILHADO
    └── review_agent/                  # COMPARTILHADO
```

`${FOUNDRY_ROOT}` é resolvido em ordem:
1. Variável de ambiente `NOVAIS_FOUNDRY_ROOT`
2. `./foundry/` (subdiretório do projeto consumidor)
3. `./.claude/foundry/` (alternativa)
4. Erro: `foundry_root_not_found`

## Validation gate (pré-criação)

Antes de copiar qualquer arquivo, verificar **todos** os checks:

```
1. docs/specs/{module}.md existe (spec gerada via /novais-digital:spec)
2. ${FOUNDRY_ROOT} resolvido e templates/aios/ acessível
3. aios/config.yaml existe — se ausente, copiar de templates/aios/config.yaml.template e PARAR
   pedindo ao operador para preencher project.name + stack.* antes de prosseguir
4. Python 3.10/3.11 disponível: python --version
5. ANTHROPIC_API_KEY definida no .env (warning não-bloqueante)
6. PyYAML instalado: python -c "import yaml" (entry.py.template depende)
7. langfuse instalado (warning não-bloqueante — _MockTrace é fallback)
```

Se qualquer check obrigatório falhar: **parar e orientar com instrução específica de correção.** Não criar nenhum arquivo.

## Sequência de cópia

### Passo 1 — agentes especializados por módulo

Para cada agente em `{spec, backend, frontend}`:

```
src:  ${FOUNDRY_ROOT}/templates/aios/agents/{agent}_agent/{entry.py.template, config.json.template}
dst:  aios/agents/{module}_{agent}_agent/{entry.py, config.json}

substituições aplicadas no conteúdo:
  {PROJECT_NAME}  →  ${aios/config.yaml → project.name}
  {MODULE}        →  ${module}
  {TIER}          →  ${tier ou "B"}

renomeação: arquivo.{ext}.template → arquivo.{ext}
```

Se `aios/agents/{module}_*` já existir e `force` não for `true`: erro `module_dir_already_exists`.

### Passo 2 — agentes compartilhados

Para cada agente em `{schema, test, review}`:

```
verifica se aios/agents/{agent}_agent/ JÁ EXISTE:
  - existe → não toca (estes são compartilhados; não recriar)
  - não existe → copia src → dst (substituindo apenas {PROJECT_NAME})
```

### Passo 3 — registro do módulo no config

```
abre aios/config.yaml
adiciona em modules: → { name: ${module}, tier: ${tier ou "B"} }
preserva ordenação alfabética
não altera outros campos
```

### Passo 4 — orchestrator.py

```
verifica se aios/orchestrator.py JÁ EXISTE:
  - existe → não toca (orchestrator é único e estável)
  - não existe → copia templates/aios/orchestrator.py.template → aios/orchestrator.py
              substituindo {PROJECT_NAME}
```

## Output structured

```yaml
command: /novais-digital:aios-init
status: ok | partial | error
module: <>
tier: A | B | C
project_root: <abs_path>
foundry_root: <abs_path>
agents_created:
  - aios/agents/{module}_spec_agent/
  - aios/agents/{module}_backend_agent/
  - aios/agents/{module}_frontend_agent/
agents_present_unchanged:
  - aios/agents/schema_agent/   # se já existia
  - aios/agents/test_agent/
  - aios/agents/review_agent/
agents_seeded:
  - aios/agents/schema_agent/   # se foi criado neste run
config_updated: true | false
orchestrator_created: true | false
checks_passed:
  spec_exists: true
  foundry_root_resolved: true
  config_exists: true
  python_ok: true
  pyyaml_installed: true
  api_key_ok: true
  langfuse_installed: true | false_warning
next_step: "/novais-digital:aios-run --module {module} --step spec"
```

## Verification gate

- [x] `docs/specs/{module}.md` existe antes de copiar qualquer arquivo
- [x] `${FOUNDRY_ROOT}/templates/aios/` resolvido e acessível
- [x] `aios/config.yaml` existe e tem `project.name` preenchido (não ainda `{PROJECT_NAME}`)
- [x] Cada `entry.py` gerado tem todas as substituições aplicadas — nenhum `{PROJECT_NAME}`, `{MODULE}` ou `{TIER}` literal sobrou no resultado
- [x] Cada `entry.py` gerado preserva o bloco Langfuse + `_MockTrace` (C6)
- [x] Nenhum `tenantId` hardcoded nos arquivos gerados (C8)
- [x] SYSTEM_PROMPT funciona standalone sem kernel (C7) — declarado nos comentários do template
- [x] Agentes compartilhados (schema/test/review) não foram sobrescritos se já existiam

## Tabela anti-rationalization

| Tentação | Por que não | Resposta correta |
|---|---|---|
| Voltar a gerar boilerplate inline (sem templates físicos) | Diverge entre projetos consumidores; impossível evoluir em conjunto | Copiar de `templates/aios/` é o único caminho a partir de v0.2.0 |
| Cravar Prisma/Postgres no schema_agent | Viola C7 e força stack ao consumidor | schema_agent é stack-agnostic — lê `aios/config.yaml → stack.database` ou propõe stacks |
| Recriar schema_agent/test_agent/review_agent por módulo | Esses são compartilhados; redundância sem benefício | Apenas spec/backend/frontend recebem prefixo `{module}_` |
| Sobrescrever agentes compartilhados existentes | Apaga customização local feita pelo consumidor | Passo 2 só cria se ausente; nunca sobrescreve |
| Atualizar `aios/config.yaml` em outros campos além de `modules:` | Pode apagar configurações reais (api_key, log path) | Apenas appende em `modules:`; preserva o resto |
| Pular o gate de spec existente | Agentes sem spec geram lixo irrecuperável | Check 1 é hard gate — parar se spec não existe |
| Pular instrumentação Langfuse no boilerplate | Sem trace = outcome não auditável (C6) | Templates já incluem; o command só copia, não modifica |

## Saída de erro estruturada

```yaml
command: /novais-digital:aios-init
status: error
error: <enum>
hint: <ação específica>
```

`error` ∈
- `spec_not_found` — criar spec via `/novais-digital:spec`
- `foundry_root_not_found` — definir `NOVAIS_FOUNDRY_ROOT` ou clonar `foundry/` no projeto
- `aios_config_not_found` — copiei `templates/aios/config.yaml.template` para `aios/config.yaml`; preencha `project.name` e `stack.*` antes de re-rodar
- `aios_config_unfilled` — `aios/config.yaml → project.name` ainda contém `{PROJECT_NAME}` literal; preencher antes de re-rodar
- `python_not_available` — instalar Python 3.10+
- `pyyaml_missing` — `pip install pyyaml` (entry.py depende para ler config)
- `api_key_missing` — definir `ANTHROPIC_API_KEY` no `.env` (warning, não bloqueia)
- `module_dir_already_exists` — usar `--force` para sobrescrever os 3 agentes especializados; agentes compartilhados nunca são sobrescritos automaticamente

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-06 | Versão inicial — Foundry-6 AIOS init com boilerplate inline |
| 0.2.0 | 2026-05-07 | **Foundry-7**: passa a copiar dos templates físicos em `templates/aios/`; cobre 6 agentes (adiciona schema/test/review compartilhados); orchestrator + config gerados quando ausentes; schema_agent é stack-agnostic |
