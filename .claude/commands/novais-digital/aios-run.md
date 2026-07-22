---
name: novais-digital:aios-run
description: "Executa o pipeline AIOS para um módulo (spec → build → test → review)"
allowed-tools: [Bash, Read]
arguments:
  required:
    - module
  optional:
    - step
    - skip_health_check
foundry_command_version: 0.1.0
linked_principles: [C4, C6, C7]
invokes_skills: []
output_artifact: docs/specs/_backend_{module}.md + docs/specs/_frontend_{module}.md + docs/specs/_tests_{module}.md + docs/specs/_review_{module}.md
trace_required: true
---

# /novais-digital:aios-run

## Propósito

Wrapper para `python aios/orchestrator.py pipeline --module {module}`.
Verifica pré-requisitos, executa o pipeline com **gates humanos** obrigatórios (C4), e reporta resultado.

> Gates humanos não são opcionais. Viola C4 pular aprovação antes de avançar ao próximo step.

## Inputs

```yaml
module: <kebab-case>           # módulo a executar
# opcionais
step: spec | build | test | review   # executar apenas um step (default: pipeline completo)
skip_health_check: false             # pular verificação do kernel (não recomendado)
```

## Sequência de execução

```
1. Health check (a menos que --skip_health_check):
   curl -s --max-time 3 http://localhost:8000/health
   → Se falhar: imprimir instruções de start do kernel e parar (não prosseguir)

2. Se --step fornecido: executar apenas esse step
   python aios/orchestrator.py {step} --module {module}

   Se pipeline completo (sem --step):
   python aios/orchestrator.py pipeline --module {module}

3. Após cada step: aguardar gate humano (ver seção abaixo)
   → Se usuário responder "n": parar e orientar próximos passos (NÃO re-executar)

4. Ao final: listar artefatos gerados em docs/specs/
   → Timestamp de início e fim
   → Módulo e step(s) executados
   → Número de artefatos gerados
   → Aviso se algum agente não tiver trace Langfuse configurado (C6)
```

## Gates humanos obrigatórios (C4)

Após cada step, perguntar explicitamente:

| Step | Pergunta ao usuário |
|---|---|
| `spec` | "A spec em `docs/specs/{module}.md` está correta? (s/n)" |
| `build` | "Os arquivos `_backend_{module}.md` e `_frontend_{module}.md` estão aprovados? (s/n)" |
| `test` | "Os testes gerados cobrem os casos críticos? (s/n)" |
| `review` | "O review em `_review_{module}.md` não tem blockers? (s/n)" |

**Se usuário responder "n"**: parar imediatamente. Não re-executar automaticamente. Orientar:
- `spec`: "Edite `docs/specs/{module}.md` e execute `/novais-digital:aios-run --module {module} --step spec` novamente"
- `build`: "Revise os arquivos de backend/frontend e ajuste a spec se necessário"
- `test`: "Adicione casos de teste manualmente ou ajuste a spec do módulo"
- `review`: "Resolva os blockers listados em `docs/specs/_review_{module}.md` antes de continuar"

## Telemetria (C6)

Registrar no console ao final:
```
[AIOS-RUN] Módulo: {module} | Step(s): {step} | Início: {timestamp} | Fim: {timestamp}
[AIOS-RUN] Artefatos gerados: {lista}
[AIOS-RUN] Trace Langfuse: {ok | AVISO — LANGFUSE_PUBLIC_KEY não configurada}
```

Aviso obrigatório se `LANGFUSE_PUBLIC_KEY` não estiver no ambiente — chamadas sem trace não contam como outcomes auditáveis (C6).

## Instruções de start do kernel (exibir se health check falhar)

```
Kernel AIOS offline. Para iniciar:

  bash .aios-kernel/runtime/launch_kernel.sh

Aguarde "Kernel online" no log antes de executar /novais-digital:aios-run.

Alternativa (foreground):
  cd .aios-kernel && python -m aios.kernel.server

Documentação completa: docs/aios-setup.md
```

## Output structured

```yaml
command: /novais-digital:aios-run
status: ok | partial | error | waiting_human_gate
module: <>
step_executed: spec | build | test | review | pipeline
artifacts_generated:
  - docs/specs/_backend_{module}.md   # se step build
  - docs/specs/_frontend_{module}.md  # se step build
  - docs/specs/_tests_{module}.md     # se step test
  - docs/specs/_review_{module}.md    # se step review
human_gates_passed: [spec, build]     # gates que passaram com "s"
human_gate_failed: test               # gate que recebeu "n" (se aplicável)
langfuse_trace_ok: true | false
timestamp_start: <>
timestamp_end: <>
trace_id: <>
next_step: "/novais-digital:aios-run --module {module} --step test"  # se gate_failed
```

## Verification gate

- [x] Health check executado antes de qualquer chamada ao orchestrator (salvo --skip_health_check)
- [x] Gate humano explícito após cada step — nunca avança automaticamente
- [x] Ao resposta "n": comando para sem re-executar; orientação específica por step
- [x] Aviso de telemetria no console se LANGFUSE_PUBLIC_KEY ausente
- [x] Artefatos listados no output structured
- [x] Trace_id gerado para rastreabilidade

## Tabela anti-rationalization

| Tentação | Por que não | Resposta correta |
|---|---|---|
| Pular gates humanos para "acelerar" | Viola C4 — SHADOW antes de cobrar; gate é proteção contra lixo em produção | Gate humano após cada step é mandatório; `--auto` não existe |
| Re-executar automaticamente após "n" | A correção é iteração humana, não re-run cego — re-run sem fix gera o mesmo resultado | Parar, orientar, aguardar próxima invocação pelo usuário |
| Executar sem health check | Falha silenciosa do orchestrator é pior que erro claro | Health check default on; `--skip_health_check` só para dev local com kernel garantidamente online |
| Registrar trace apenas se configurado, silenciosamente | C6 requer rastreabilidade — "silencioso" esconde a violação | Aviso visível no console se trace não configurado |
| Continuar pipeline se step anterior recebeu "n" | Gate falho invalida tudo depois | Pipeline completo só avança após todos os gates anteriores receberem "s" |

## Saída de erro estruturada

```yaml
command: /novais-digital:aios-run
status: error
error: <enum>
hint: <ação específica>
trace_id: <>
```

`error` ∈ `kernel_offline` (iniciar kernel) | `orchestrator_not_found` (verificar aios/orchestrator.py) | `module_agents_not_initialized` (executar /novais-digital:aios-init primeiro) | `spec_not_found` (executar /novais-digital:spec antes de pipeline) | `human_gate_rejected` (corrigir e re-executar step) | `langfuse_not_configured` (aviso, não bloqueante).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-06 | Versão inicial — Foundry-6 AIOS run com gates C4 |
