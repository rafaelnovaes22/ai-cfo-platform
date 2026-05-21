# Aicfo — Master Prompt do Orchestrator Forge
**Versão:** 1.0 | **Data:** 2026-05-13 | **Forge:** v0.15.0 | **Tipo:** agentic_saas / ai_enabled:true

> Prompt de orquestração canônico para operar o Aicfo sob o Acme Forge.
> Gerado a partir de `templates/master-prompt.md` (Forge v0.15.0) e adaptado para `project_type: agentic_saas`.

---

## Como este arquivo funciona

Claude Code lê este arquivo como contexto de sistema ao iniciar uma sessão no Aicfo.
Ele descreve ao agente **onde está, o que pode fazer e como se comportar**.

---

## PROMPT MASTER (contexto de sistema para Claude Code)

```markdown
# Você opera o projeto Aicfo sob o Acme Forge

## 1. Contexto do projeto

**Projeto**: Aicfo
**Tipo**: `agentic_saas` | `ai_enabled: true`
**Missão**: CFO-IA self-serve para PMEs — DRE Facilitado + narrativa + Plano de Ação 3-horizontes.
**Framework**: Acme Forge v0.15.0 — leia `docs/forge/project.json` antes de qualquer ação.
**ICP**: CEO/sócio/CFO de PME R$500k–R$10M faturamento.

Este projeto roda agentes de IA em produção (Langfuse obrigatório, C3 custo de tokens, C4 SHADOW antes de cobrar).

## 2. Lifecycle de SKUs (agentic)

```
SHADOW → ASSISTED → AUTONOMOUS
```

- **SHADOW**: análise gerada mas não entregue ao cliente; Rafael revisa em paralelo
- **ASSISTED**: análise entregue; cliente pode editar/comentar antes de fechar
- **AUTONOMOUS**: análise entregue diretamente; cliente audita amostra

**SKU piloto**: `monthly-analysis` — atualmente em **SHADOW**

**NUNCA** promova sem `/acme:promote` e aceite humano.

## 3. Constitution C1–C8 (aplicação agentic)

| Princípio | Neste projeto |
|---|---|
| C1 Diagnose-before-design | Nenhum SKU começa sem diagnóstico estruturado |
| C2 Outcome-first | Spec requer cláusula de outcome cobrável (análise aceita) |
| C3 Custo ≤ 25% | tokens Anthropic / preço por análise ≤ 25% |
| C4 SHADOW antes de cobrar | SHADOW obrigatório antes de ASSISTED |
| C5 Three-tier | L0=org / L1=cliente+produto / L2=execução por SKU |
| C6 Telemetria | Langfuse obrigatório em toda chamada LLM; trace_coverage ≥ 99% |
| C7 Portabilidade | LLM em camada `src/llm/`; infra em `src/persistence/` |
| C8 Anti-hardcode | Tenant via config DB; nunca `if (tenantId === ...)` |

## 4. Stack técnico

- Node 20 + TypeScript 5.7 ESM + Fastify 5
- LangGraph 1.2 + Anthropic SDK + Langfuse 3.38
- Prisma 6 + PostgreSQL 16 + BullMQ 5
- Vitest (testes)

## 5. Estrutura de SKU

```
src/skus/{sku-code}/
├── spec.md           # spec com outcome cobrável
├── nodes/            # nós do grafo LangGraph
├── prompts/          # prompts versionados
└── evals/            # eval suite
```

## 6. Pipeline TDD para nós novos

```bash
python aios/orchestrator.py spec --module <sku>
python aios/orchestrator.py test --module <sku> --mode red   # RED phase
python aios/orchestrator.py build --module <sku>
python aios/orchestrator.py test --module <sku> --mode verify
python aios/orchestrator.py review --module <sku>
```

## 7. Comandos principais

| Intenção | Comando |
|---|---|
| Iniciar SKU novo | `/acme:diagnose` → `/acme:spec` → `/acme:plan` |
| Implementar | `/acme:tasks` → `/acme:implement` |
| Promover lifecycle | `/acme:promote` |
| Auditoria mensal | `/acme:audit-monthly` |
| Validar framework | `bash scripts/forge-doctor.sh --consumer` |

## 8. Arquivos que NÃO editar sem confirmação

- `.claude/CONSTITUTION.md` — canônica do Forge
- `docs/adr/*.md` assinados — abrir nova ADR
- `src/skus/*/spec.md` aprovados — reaprovação necessária
- Promoção de SHADOW → ASSISTED → AUTONOMOUS — apenas via `/acme:promote`
```

---

*Gerado a partir de `templates/master-prompt.md` do Forge v0.15.0. Atualizar ao sincronizar.*
