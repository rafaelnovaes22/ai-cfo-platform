---
name: novais-digital:aios-status
description: "Exibe o status de todos os módulos no pipeline AIOS"
allowed-tools: [Bash, Read, Glob]
arguments:
  optional:
    - module
    - project_root
foundry_command_version: 0.1.0
linked_principles: [C4, C6]
invokes_skills: []
output_artifact: console (read-only — não cria arquivos)
trace_required: false
---

# /novais-digital:aios-status

## Propósito

Executa `python aios/orchestrator.py status` e formata o output de forma legível.
Complementa com verificação direta dos artefatos gerados em `docs/specs/`.

> Comando **read-only** — não modifica nada. Seguro para usar no início de qualquer sessão.

## Inputs

```yaml
# todos opcionais
module: <kebab-case>   # filtrar por módulo específico (default: todos)
project_root: <path>   # raiz do projeto consumidor (default: cwd)
```

## Output esperado

```
## Status AIOS — {data}

Kernel: ✅ online (http://localhost:8000)
       ❌ offline (iniciar com: bash .aios-kernel/runtime/launch_kernel.sh)

| Módulo      | Tier | Spec | Backend | Frontend | Testes | Review | Pronto              |
|-------------|------|------|---------|----------|--------|--------|---------------------|
| cadastros   | A    | ✅   | ✅      | ✅       | ✅     | ✅     | ✅ mover para src/  |
| jovens      | B    | ✅   | ⏳      | ⏳       | —      | —      | aguardando build    |
| cnab        | C    | —    | —       | —        | —      | —      | Rafael dirige       |

Legenda: ✅ gerado | ⏳ em progresso | ❌ com blocker | — não iniciado
```

## Como determinar o status de cada módulo

Para cada módulo listado em `aios/orchestrator.py:MODULES_ORDER`:

| Coluna | Como verificar |
|---|---|
| Spec | `docs/specs/{module}.md` existe |
| Backend | `docs/specs/_backend_{module}.md` existe |
| Frontend | `docs/specs/_frontend_{module}.md` existe |
| Testes | `docs/specs/_tests_{module}.md` existe |
| Review | `docs/specs/_review_{module}.md` existe |
| Blocker | Review contém a string "BLOCKER" (case-insensitive) |
| Kernel | `curl -s --max-time 3 http://localhost:8000/health` retorna 200 |

**Lógica da coluna "Pronto"**:

| Condição | Status exibido |
|---|---|
| Review existe e sem "BLOCKER" | "✅ mover para src/" |
| Review existe com "BLOCKER" | "❌ ver _review_{module}.md" |
| Algum artefato ⏳ (em progresso) | "aguardando {step}" |
| Nenhum artefato iniciado, tier C | "Rafael dirige" |
| Nenhum artefato iniciado, tier A/B | "não iniciado" |

## Quando usar

- No **início de cada sessão** de trabalho para saber onde parou
- Após executar um pipeline para confirmar artefatos gerados
- Antes de `/novais-digital:implement --via aios` para verificar pré-requisitos
- Antes de mover código manualmente para `src/` (confirmar que review está verde)

## Sequência de execução

```
1. Health check: curl -s --max-time 3 http://localhost:8000/health
   (timeout 3s — não bloquear por kernel offline)

2. Tentar: python aios/orchestrator.py status
   Se falhar (orchestrator não encontrado): usar fallback de filesystem

3. Fallback filesystem: verificar existência dos artefatos em docs/specs/ para cada módulo

4. Formatar e exibir tabela
```

## Output structured

```yaml
command: /novais-digital:aios-status
status: ok
kernel_online: true | false
modules_total: <N>
modules_ready: <N>       # review existe e sem BLOCKER
modules_in_progress: <N>
modules_not_started: <N>
modules_with_blocker: <N>
table: [...]             # dados da tabela para consumo programático
generated_at: <>
```

## Verification gate

- [x] Kernel check com timeout de 3s (nunca trava a sessão por kernel offline)
- [x] Fallback filesystem funciona sem orchestrator (comando útil mesmo sem kernel)
- [x] Blocker detection: "BLOCKER" em review → ❌ na tabela
- [x] Tier C exibido como "Rafael dirige" (não como "não iniciado")
- [x] Comando read-only — zero arquivos criados ou modificados

## Tabela anti-rationalization

| Tentação | Por que não | Resposta correta |
|---|---|---|
| Bloquear se kernel offline | Status é informativo — kernel offline não impede leitura de artefatos | Health check com timeout 3s; exibir ❌ e continuar com filesystem |
| Usar apenas orchestrator.py como fonte | orchestrator pode estar offline ou desatualizado | Fallback filesystem como fonte autoritativa para artefatos gerados |
| Marcar como "pronto" sem checar BLOCKER | Review com BLOCKER ainda não está aprovado para mover para src/ | Grep explícito por "BLOCKER" no arquivo de review |
| Ocultar módulos Tier C | Rafael precisa ver o panorama completo para tomar decisões | Tier C aparece na tabela com status específico "Rafael dirige" |

## Saída de erro estruturada

```yaml
command: /novais-digital:aios-status
status: error
error: <enum>
hint: <ação específica>
```

`error` ∈ `no_modules_found` (verificar aios/orchestrator.py:MODULES_ORDER) | `docs_specs_not_found` (verificar estrutura do projeto).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-06 | Versão inicial — Foundry-6 AIOS status |
