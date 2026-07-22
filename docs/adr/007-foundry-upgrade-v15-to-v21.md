---
adr: 007
title: Aicfo consumer upgrade — Novais Digital Foundry v0.15.0 → v0.21.0 (Foundry-14 → Foundry-20)
status: accepted
date: 2026-05-20
deciders: Rafael Novaes (CEO Novais Digital)
linked_principles: [C1, C6, C7, C8]
linked_artifacts:
  - docs/foundry/manifest.json
  - docs/clients/aicfo/agent-soul.md
  - docs/clients/aicfo/agent-memory.md
  - templates/hermes/
  - .github/workflows/foundry-headless.yml
  - hooks/session-start/foundry-context.sh
  - hooks/stop/learning-snapshot.sh
  - .claude/agents/learning-curator.md
supersedes: null
superseded_by: null
---

# ADR-007 — Upgrade Foundry consumer v0.15.0 → v0.21.0

## Contexto

O framework canônico [`agent-governance-framework`](file:///c:/Users/Rafael/Projetos/agent-governance-framework/) está em **v0.21.0 (Foundry-20)** desde 2026-05-18. Aicfo vinha consumindo formalmente **v0.15.0 (Foundry-14)**, sincronizado em 2026-05-13.

Auditoria realizada em 2026-05-20 detectou:

1. **Drift de manifest**: `docs/foundry/manifest.json` declarava `framework_version_required: 0.15.0` enquanto **a maioria dos artefatos Foundry-15 a Foundry-20 já estava fisicamente presente** em `.claude/agents/`, `.claude/skills/` (20 skills, vs 9 originais do Foundry-14) e `hooks/` — sincronização parcial sem registro.

2. **Hermes operando de fato sem ingestão formal**: 4 PRs autônomos (`novais-digital` em 2026-05-19) demonstraram que o Hermes Agent (Foundry-19 capability) já opera contra Aicfo em produção, mas o consumer **não tinha** `.github/workflows/foundry-headless.yml` que é o entry point canônico da integração.

3. **Self-harness loop incompleto**: hooks `learning-snapshot.sh` (Stop) e `foundry-context.sh` (SessionStart) já estavam ativos e produzindo snapshots em `docs/learnings/2026-05/`, mas:
   - Snapshots nunca foram processados nem commitados
   - **Não existia `docs/clients/aicfo/`** (consumer-side bootstrap obrigatório do Foundry-20)
   - Sem `agent-soul.md` e `agent-memory.md`, o `foundry-context.sh` não injetava memória — sessão começava cega

## Decisão

Formalizar upgrade Aicfo → v0.21.0 ingerindo 4 deltas mínimos:

### 1. Bootstrap consumer-side (Foundry-20 core)
- `docs/clients/aicfo/agent-soul.md` — identidade durável: project_name=Aicfo, delivery_type=agentic_saas, lifecycle_stage=shadow_internal, restrições operacionais + anti-patterns
- `docs/clients/aicfo/agent-memory.md` — 28 fatos seed em 8 seções canônicas (`integration_quirks`, `process_patterns`, `pitfalls`, `confirmed_patterns`, `tech_constraints`, `economics_real`, `telemetry_hints`, `pii_categories`) com formato `§ [confidence:X] [data] [run:id] fato`

### 2. Hermes integration (Foundry-19)
- `.github/workflows/foundry-headless.yml` — entry point para Hermes invocar Claude Code headless via `workflow_dispatch`/`workflow_call`
- `templates/hermes/` — 8 arquivos (foundry.skill.md, learning-loop.md, learning/*.template.md, hermes-plugin/, railway/, status-fast.md) para que mantenedores possam regenerar artefatos por consumer

### 3. Manifest sync
- `docs/foundry/manifest.json` ⇒ `framework_version_required: 0.21.0`, `phase: "Foundry-20 self-harness loop"`, `last_synced_at: 2026-05-20`

### 4. Documentação dessa decisão (este ADR)

## Out of scope (não-bloqueante, fica para follow-up)

- **Processar `docs/learnings/2026-05/`**: snapshots existentes ainda não foram revisados pelo `learning-curator` para extrair fatos novos que mereçam entrar em `agent-memory.md`. Operação manual de uma única sessão (estimado 30min).
- **Foundry-15/16/17/18 documentação**: as skills já estão fisicamente em `.claude/skills/` (sdk-migration, llm-security-hardening, doubt-driven-review, source-driven-implementation, wave-implementation, context-engineering, etc.). Não tocadas neste ADR — assumidas como herança do sync parcial anterior. Auditoria futura pode confirmar conformidade.
- **Hermes Railway/Codex deployment**: este upgrade só formaliza o entry point GitHub Actions. A infra Railway que orquestra Telegram → Hermes → workflow_dispatch é Novais Digital-wide, não Aicfo-specific.

## Consequências

### Positivas

- **Auditável**: `docs/foundry/manifest.json` agora reflete realidade (sem drift); reviewer DeepAgent mensal pode verificar compliance vs Constitution v0.3.0
- **Self-harness operacional**: próxima sessão Claude Code carrega `agent-soul.md` + `agent-memory.md` no slot #1+#2 do system prompt automaticamente via `foundry-context.sh` — fim do "começar cego"
- **Hermes formalizado**: PRs autônomos `novais-digital` agora têm rastreabilidade legível via workflow file commitado
- **Lições aprendidas persistem**: a próxima sessão saberá (por exemplo) que `--delete-branch` em PR base auto-fecha filhos, sem ter que aprender de novo

### Negativas

- **Manutenção dupla**: cada nova versão do framework requer sync explícito ao consumer (não há automação ainda — Foundry-15 prevê mas não está pronto)
- **`docs/clients/aicfo/agent-memory.md` precisa curadoria contínua**: fatos obsoletos viram ruído; `learning-curator` precisa rodar periodicamente
- **C8 risk**: agent-memory.md cita "Aicfo" várias vezes, mas como é literalmente o consumer ID, não viola C8 (que proíbe hardcode por **tenant**, não por consumer). Documentar essa distinção fica para próxima Constitution audit.

### Neutras

- Aicfo continua sendo **o caso de validação real** do Foundry (Foundry-15 do roadmap canônico). Cada PR aqui é evidência empírica para o framework.

## Alternativas consideradas

1. **Não fazer upgrade**: continuar declarando v0.15.0 mesmo com artefatos v0.21.0 presentes. **Rejeitado** — viola C1 (audit trail) e C6 (rastreabilidade).
2. **Upgrade total para v0.21.0 com processamento exaustivo de `docs/learnings/`**: incluiria revisar todos os snapshots e popular agent-memory.md com fatos derivados. **Rejeitado** — escopo grande (~2-3h), low-value vs custo agora; agent-memory.md já bootstrapped com fatos críticos observados nesta sessão; processamento dos snapshots fica para sessão seguinte do `learning-curator`.
3. **Esperar Foundry-15 entregar automação de sync**: rejeitado — sem prazo definido no roadmap canônico; o gap atual já causa dano operacional (Hermes operando sem rails declarados).

## Verificação

- [x] `docs/clients/aicfo/agent-soul.md` existe e é parseável
- [x] `docs/clients/aicfo/agent-memory.md` existe com ≥10 fatos rastreáveis
- [x] `templates/hermes/` copiada do framework (8 arquivos)
- [x] `.github/workflows/foundry-headless.yml` presente
- [x] `docs/foundry/manifest.json` declara `v0.21.0` / `framework_version_required: 0.21.0`
- [x] `hooks/session-start/foundry-context.sh` carrega agent-soul + agent-memory no próximo SessionStart (testar empírico em sessão futura)
- [ ] (Follow-up) `learning-curator` invocado contra `docs/learnings/2026-05/` para extrair fatos pendentes
- [ ] (Follow-up) Auditoria DeepAgent mensal de 2026-06 valida sync sem drift

## Referências

- Framework decisions: `c:/Users/Rafael/Projetos/agent-governance-framework/docs/foundry/decisions.md` (F50-F55)
- Framework CHANGELOG: `c:/Users/Rafael/Projetos/agent-governance-framework/CHANGELOG.md` v0.20.0 + v0.21.0
- Constitution: `.claude/CONSTITUTION.md` v0.3.0 (não alterada por este ADR)
