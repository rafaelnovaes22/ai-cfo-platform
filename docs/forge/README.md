# Acme Forge — Framework de Engenharia SaaS² Claude-nativo

> **Versão**: 0.1.0 (Forge-0 em construção)
> **Data**: 2026-04-30
> **Status**: ⏳ Plano aprovado, implementação em curso
> **Reviewer externo**: DeepAgents (GPT-5.5) — auditoria mensal sobre `manifest.json`

---

## O que é o Acme Forge

Framework Claude Code-nativo que transforma a **metodologia Acme SaaS²** + **Sincra** em rails operacionais executáveis. Cada SKU vertical novo herda automaticamente:

- **Diagnóstico estruturado** (Fase 0 / D7)
- **Spec contratual de outcome** (D1 + D2)
- **Gate de unit economics ≤ 25%** (D5)
- **Threshold de SLA pré-contratual** (D6)
- **Promoção SHADOW → ASSISTED → AUTONOMOUS** com gates verificáveis
- **Eval suite obrigatória** antes de billing variável
- **Camadas Sincra L0 / L1 / L2** com herança de contexto

> **Tese central**: a metodologia Acme já está formalizada em prosa (3 docs `metodologia*.md`) e em templates Onda 0 (D1-D7). O Forge **operacionaliza essa metodologia como artefatos executáveis pelo Claude Code** — slash commands, subagents, skills, hooks — para que cada novo SKU/cliente reuse os mesmos rails sem recriar processo.

---

## Não confundir com

- **Não é** starter kit genérico Claude Code (existem dezenas — ver `awesome-claude-code-toolkit`)
- **Não é** metodologia de processo (a metodologia já existe nos 3 docs `docs/metodologia*.md`)
- **Não é** SDK de agentes (LangGraph já cumpre esse papel — ver ADR 001)
- **Não é** plataforma — é um conjunto de **conventions + automations** sobre Claude Code

---

## Os 8 princípios (resumo do `CONSTITUTION.md`)

Formalmente versionados em [`.claude/CONSTITUTION.md`](../../.claude/CONSTITUTION.md):

1. **Diagnose-before-design** — nada começa sem Fase 0
2. **Outcome-first, never tech-first** — toda spec começa pela cláusula contratual
3. **Custo ≤ 25% do preço** — hard gate de unit economics
4. **SHADOW antes de cobrar** — billing variável só pós-eval
5. **Three-tier context (Sincra)** — L0 / L1 / L2 herdam contexto
6. **Telemetry-by-default** — sem trace Langfuse, sem outcome auditável
7. **Portability over lock-in** — modelos/ferramentas mudam; processo, input/output, handoff, artefato não
8. **Anti-customização heroica** — cliente novo do mesmo SKU = configuração, não branch

---

## Documentos do Forge (pasta `docs/forge/`)

| Arquivo | Conteúdo |
|---|---|
| [`README.md`](./README.md) | Este arquivo — overview e ponteiros |
| [`decisions.md`](./decisions.md) | Decisões F1-F8 registradas com defaults aprovados |
| [`roadmap.md`](./roadmap.md) | 5 ondas Forge-0 a Forge-5, tasks e critérios de pronto |
| [`reviewer-contract.md`](./reviewer-contract.md) | Contrato com reviewer externo DeepAgents/GPT-5.5 |
| [`manifest.json`](./manifest.json) | Inventory machine-readable de todo o framework (consumido pelo reviewer) |
| [`out-of-scope.md`](./out-of-scope.md) | O que explicitamente NÃO entra no Forge |

---

## Layout de arquivos (final, ao concluir Forge-4)

```
PMO_Acme/acme-governanca-ia/
├── .claude/
│   ├── CONSTITUTION.md                  # ← princípios versionados
│   ├── settings.json                    # hooks + permissões (forge)
│   ├── settings.local.json              # overrides do dev (intocado)
│   ├── commands/acme/                 # 11 slash commands
│   ├── agents/                          # 10 subagents Guardian
│   └── skills/L0,L1,L2/                 # skills herdadas Sincra
├── docs/
│   ├── forge/                           # ← documentação do framework
│   ├── adr/                             # ADRs do projeto
│   ├── onda-0/ … onda-N/                # ondas Acme SaaS²
│   ├── playbooks/{vertical}/            # playbooks por vertical (pós cliente 1)
│   └── retrospectives/{sku}/            # post-mortem por SKU
├── templates/                           # 4 templates fundamentais
│   ├── sku-spec.template.md             # baseado em D1+D2
│   ├── adr.template.md
│   ├── eval-case.template.md
│   └── unit-economics.template.md
├── evals/{sku-code}/                    # eval suites versionadas
└── CLAUDE.md                            # entry point Claude Code
```

---

## Mapeamento metodologia → repos absorvidos

Origens externas do que foi adotado em cada componente:

| Componente | Repos de origem |
|---|---|
| Constitution versionada | `github/spec-kit` |
| Pipeline `/diagnose → /spec → /plan → ... → /promote` | `spec-kit` + `addyosmani/agent-skills` |
| Spec template do SKU (estrutura) | `vbomfim/sdlc-guardian-agents` (PO Guardian) |
| 5 quality gates | `sdlc-guardian-agents` |
| Subagents Guardian | `sdlc-guardian-agents` + `VoltAgent/awesome-claude-code-subagents` |
| Anti-rationalization tables | `addyosmani/agent-skills` |
| Helper pattern (redução de tokens) | `aj-geddes/claude-code-bmad-skills` |
| File-guard, secret scan, deny list | `carlrannaberg/claudekit` + `peterkrueck/Claude-Code-Development-Kit` |
| Estrutura documental canônica | `peterkrueck/Claude-Code-Development-Kit` |
| Cross-LLM review | `peterkrueck` + `sdlc-guardian` (dual-model) — adaptado para **DeepAgents/GPT-5.5** |
| Path-scoped auto-activation | `giuseppe-trisciuoglio/developer-kit` |
| Skill format de referência | `anthropics/skills` |
| Skill security auditor | `alirezarezvani/claude-skills` |

**Não absorvidos** (com justificativa em [`out-of-scope.md`](./out-of-scope.md)):
`rohitg00/awesome-claude-code-toolkit`, multi-provider de `feiskyer`, skills genéricos não-eng de `alirezarezvani`, BMAD personas completas, ClickUp interface, extensions Node.js do `sdlc-guardian`.

---

## Como ler estes documentos

- **CEO / não-técnico**: comece por este README + [`decisions.md`](./decisions.md)
- **Tech Lead / dev**: leia tudo em ordem; consulte [`manifest.json`](./manifest.json) para localizar artefatos
- **Reviewer externo (DeepAgents/GPT-5.5)**: ingerir [`manifest.json`](./manifest.json) primeiro; ele aponta para todos os outros arquivos com seus hashes/versões
- **Onboarding novo dev**: `CLAUDE.md` raiz → `CONSTITUTION.md` → este README → `roadmap.md`

---

## Frase-resumo

> O **Acme Forge** transforma a metodologia Acme SaaS² em rails Claude Code-nativos: cada SKU vertical novo herda automaticamente diagnóstico estruturado, spec contratual de outcome, gate de unit economics, threshold de SLA e promoção SHADOW→AUTONOMOUS — sem reinventar processo a cada cliente, com auditoria externa mensal por DeepAgents/GPT-5.5.
