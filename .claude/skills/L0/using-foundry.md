---
name: using-foundry
description: Meta-skill que governa descoberta e invocação de skills, Guardians e commands no Novais Digital Foundry. Injetada automaticamente pelo SessionStart hook a cada nova sessão. Use quando iniciar uma sessão ou quando não souber qual ação tomar.
tier: 0
vocabulary_aliases: [L0, meta, session-init]
linked_principles: [C1, C2, C3, C4, C5, C6, C7, C8]
version: 1.0.0
activation:
  explicit_invocation: "@using-foundry"
  auto_inject: true
---

# Usando o Novais Digital Foundry

## Visão Geral

O Foundry é um framework de governança para agentes, plataformas e automações cobráveis. Cada ação deve ser rastreável a um princípio da Constitution (C1-C8). Esta meta-skill é o ponto de entrada: use-a para descobrir a rota certa para qualquer tarefa.

## Flowchart de Descoberta

Quando uma tarefa chegar, identifique a fase e siga a rota correta:

```
Tarefa chega
    │
    ├── Novo cliente / problema? ──────────────────→ /novais-digital:diagnose
    │     └── Precisa mapear processo? ──────────────→ @process-mapper
    │
    ├── Tem diagnóstico, precisa de contrato? ─────→ /novais-digital:spec
    │     ├── Validar economics? ─────────────────────→ /novais-digital:unit-economics
    │     └── Definir SLA? ───────────────────────────→ /novais-digital:sla-threshold
    │
    ├── Tem spec, precisa de plano técnico? ───────→ /novais-digital:plan
    │     └── Quebrar em tasks? ───────────────────────→ /novais-digital:tasks
    │
    ├── Tem tasks, precisa implementar? ───────────→ /novais-digital:implement
    │     └── Módulo AIOS? ───────────────────────────→ /novais-digital:aios-init → /novais-digital:aios-run
    │
    ├── Precisa validar qualidade? ─────────────────→ /novais-digital:eval
    │     └── Antes de merge? ──────────────────────────→ /novais-digital:pre-merge-check
    │
    ├── Pronto para promover? ──────────────────────→ /novais-digital:promote
    │     └── Rollback? ──────────────────────────────→ /novais-digital:promote rollback
    │
    ├── Auditoria mensal? ──────────────────────────→ /novais-digital:audit-monthly
    │     └── Extrair playbook? ───────────────────────→ /novais-digital:playbook-extract
    │
    ├── Input em linguagem natural (sem comando)? ─→ @foundry-router (detecta intenção)
    │
    └── Contexto da empresa / ICP? ────────────────→ @company-dna | @icp-loader | @offerings-loader
```

## Quando Usar Guardian vs Command vs Skill

| Situação | Use |
|----------|-----|
| Pipeline end-to-end (diagnóstico → promote) | `/novais-digital:*` commands |
| Validação isolada de um princípio C1-C8 | Guardian direto (`@po-guardian`, `@unit-economist`, etc.) |
| Carregar contexto estratégico (DNA, ICP, portfolio) | `@company-dna`, `@icp-loader`, `@offerings-loader` (L0) |
| Qualificar cliente / mapear processo | `@diagnostic-runner`, `@process-mapper`, `@baseline-cost-builder` (L1) |
| Construir prompt / escrever eval / rodar SHADOW | `@artifact-prompt-builder`, `@eval-case-author`, `@shadow-mode-runner` (L2) |
| Revisão adversarial antes de SHADOW/promote | `@doubt-driven-review` (L2) |
| Input vago em PT sem slash command | `@foundry-router` |

## Hierarquia de Contexto (C5)

```
L0 (Estratégico) ─── DNA org, ICP, portfolio ──── lê apenas de Tier 1
L1 (Tático)      ─── cliente, processo, custo ──── lê Tier 1 + 2
L2 (Operacional) ─── prompts, evals, SHADOW ─────  lê Tier 1 + 2 + 3
```

**Regra**: nunca pule tiers. L2 não carrega contexto de empresa sem passar por L0/L1 primeiro.

## Comportamentos Obrigatórios

### 1. Surface Assumptions (antes de qualquer ação não-trivial)

```
PREMISSAS QUE ESTOU FAZENDO:
1. [premissa sobre o tipo de projeto]
2. [premissa sobre o lifecycle stage]
3. [premissa sobre qual princípio se aplica]
→ Corrija-me agora ou prossigo com essas.
```

### 2. Parar em incerteza

Quando encontrar requisito ambíguo ou conflito entre princípios:
1. **PARAR.** Não prosseguir com suposição.
2. Nomear a confusão específica.
3. Apresentar o trade-off ou a pergunta.
4. Aguardar resolução.

### 3. Outcome antes de tudo (C2)

Nenhuma skill, command ou Guardian faz sentido sem uma cláusula de outcome clara. Se não houver outcome contratual, a primeira ação é sempre `/novais-digital:diagnose`.

### 4. Custo visível (C3)

Antes de qualquer implementação, o custo por outcome deve ser estimado e validado. Se não houver `baseline-cost-*.md`, rodar `/novais-digital:unit-economics` primeiro.

### 5. Observabilidade em tudo (C6)

Todo artefato `ai_enabled=true` precisa de trace_id. Se estiver implementando código que chama LLM sem `observe()`, é uma violação C6 — parar e corrigir antes de continuar.

## Modos de Operação (persona-detect)

| Modo | Detectado por | Comportamento |
|------|--------------|---------------|
| `vibe` | `.foundry-mode=vibe` | Linguagem natural, PT-BR leigo, sem jargão |
| `dev` | `.foundry-mode=dev` | Técnico, referências C1-C8, paths explícitos |
| `agent` | `.foundry-mode=agent` | Saída estruturada YAML, trace_id obrigatório |

Se `.foundry-mode` não existir, inferir pelo contexto do input.

## Quick Reference

| Phase | Action | One-Line |
|-------|--------|----------|
| Qualificar | `/novais-digital:diagnose` | C1: problema → diagnóstico cobrável |
| Contratar | `/novais-digital:spec` | C2: outcome contratual com 3+3 exemplos |
| Precificar | `/novais-digital:unit-economics` | C3: custo humano → margem mínima viável |
| SLA | `/novais-digital:sla-threshold` | C4: thresholds pré-contratados |
| Planejar | `/novais-digital:plan` + `/novais-digital:tasks` | C5: 3 camadas + dependências |
| Implementar | `/novais-digital:implement` | C6/C7/C8: código com trace, abstração, multi-tenant |
| Validar | `/novais-digital:eval` + `/novais-digital:pre-merge-check` | Eval suite verde + 5 gates |
| Promover | `/novais-digital:promote` | 6 gates obrigatórios → novo modo/estado |
| Auditar | `/novais-digital:audit-monthly` | Sample 5-10% runs, detectar drift |
| Escalar | `/novais-digital:playbook-extract` | Padrão reutilizável para cliente 2 |

## Sequência Típica (projeto agentic_saas)

```
1. /novais-digital:diagnose          → qualifica problema, baseline humano
2. /novais-digital:spec              → cláusula de outcome + 3+3 exemplos
3. /novais-digital:unit-economics    → custo por outcome viável (C3)
4. /novais-digital:sla-threshold     → agreement_rate, latency_p95, cost_per_outcome
5. /novais-digital:plan              → 3 camadas, C7 abstraction, C8 TenantContext
6. /novais-digital:tasks             → 6 ondas com dependências
7. /novais-digital:implement         → código + prompts/{id}/v{n}/system.md
8. /novais-digital:eval              → ≥30 cases/category, pass_rate ≥ threshold
9. /novais-digital:pre-merge-check   → 5 gates go/no-go
10. /novais-digital:promote          → start_shadow | shadow_to_assisted | assisted_to_autonomous
11. /novais-digital:audit-monthly    → drift detection + scoring
```

Para `platform` (ai_enabled=false): pula steps 7-8 (sem prompts/eval), usa `to_staging → to_pilot → to_canonical`.
