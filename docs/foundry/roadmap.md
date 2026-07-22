# Novais Digital Foundry — Roadmap

> **Status**: ✅ Foundry-0 ✅ Foundry-1 ✅ Foundry-2 ✅ Foundry-3 ✅ Foundry-4 ✅ Foundry-5 infraestrutura ✅ Foundry-6 AIOS infraestrutura ✅ Foundry-7 AIOS agentes portáveis (v0.6.0) ✅ Foundry-8 CI/CD esteira completa (v0.7.0); ⏳ conteúdo real aguarda primeiro SKU em AUTONOMOUS
> **Última atualização**: 2026-05-07
> **Total estimado**: 16–23 dias úteis (paralelo às ondas Novais Digital)
> **Princípio**: cada onda Foundry tem critério de pronto verificável e atualiza `manifest.json`

---

## Visão geral das 8 ondas

| Onda | Foco | Estimativa | Bloqueia |
|---|---|---|---|
| **Foundry-0** | Fundação (constitution, settings, templates, manifest) | 2–3 dias | Foundry-1 |
| **Foundry-1** | Skills L0/L1/L2 (Sincra) | 3–5 dias | Foundry-2 |
| **Foundry-2** | Slash commands do pipeline | 3–5 dias | Foundry-3 |
| **Foundry-3** | Subagents Guardian + reviewer DeepAgents | 4–6 dias | Foundry-4 |
| **Foundry-4** | Hooks runtime e governança | 3–5 dias | Operação |
| **Foundry-5** | Playbooks verticais (contínuo, pós cliente 1) | — | — |
| **Foundry-6** | AIOS Server — camada de implementação multiagente (commands + telemetry) | 2 dias | Foundry-7 |
| **Foundry-7** | AIOS agentes portáveis (templates físicos canônicos, schema stack-agnostic) | 1 dia | Foundry-8 |
| **Foundry-8** | CI/CD — esteira completa para produção (templates + Gate 6 no promote) | 1 dia | AUTONOMOUS |

---

## Foundry-0 — Fundação ✅ (concluída em v0.1.0 + v0.2.0)

**Objetivo**: o Claude Code abre o projeto e os 8 princípios entram automaticamente no contexto.

### Tasks

- [x] **F0.1** Criar `docs/foundry/README.md` (overview)
- [x] **F0.2** Criar `docs/foundry/decisions.md` (F1-F16 com defaults aprovados)
- [x] **F0.3** Criar `docs/foundry/roadmap.md` (este arquivo)
- [x] **F0.4** Criar `docs/foundry/reviewer-contract.md` (contrato DeepAgents/GPT-5.5)
- [x] **F0.5** Criar `docs/foundry/manifest.json` (inventory machine-readable)
- [x] **F0.6** Criar `docs/foundry/out-of-scope.md`
- [x] **F0.7** Criar `.claude/CONSTITUTION.md` (8 princípios versionados)
- [x] **F0.8** Criar `.claude/settings.json` (hooks placeholders + allow list)
- [x] **F0.9** Criar `templates/platform-sku-spec.template.md` (renomeado de `sku-spec` na v0.2.0)
- [x] **F0.10** Criar `templates/adr.template.md`
- [x] **F0.11** Criar `templates/eval-case.template.md`
- [x] **F0.12** Criar `templates/unit-economics.template.md`
- [x] **F0.13** Criar `CLAUDE.md` raiz (entry point — aponta para CONSTITUTION e manifest)
- [x] **F0.14 (v0.2.0)** Generalização da Constitution + reposicionamento como repo standalone (templates expandidos para 9, pasta `reviewer/`, `examples/novais-digital/`)

### Critério de pronto

- ✅ `manifest.json` lista todos os artefatos Foundry-0 com paths, hashes e descrições
- ✅ `CLAUDE.md` raiz referencia `CONSTITUTION.md` e os 8 princípios entram no contexto inicial
- ✅ DeepAgents/GPT-5.5 (mock — humano simulando) consegue navegar manifest e responder "qual o princípio nº 3?"
- ✅ Templates D1, D5 da Onda 0 podem ser regenerados a partir dos templates do Foundry

---

## Foundry-1 — Skills L0/L1/L2 (3–5 dias)

**Objetivo**: `/novais-digital:diagnose` em projeto novo gera relatório Fase 0 estruturado em <10 min, com helper pattern BMAD reduzindo tokens em ≥70%.

> **Escopo ajustado pós-v0.2.0** (decisões F13/F14): apenas **9 skills genéricas** ficam em `.claude/skills/` do Foundry. As 4 skills Novais Digital-específicas (`tenant-onboarding`, `outcome-classifier`, `billing-calculator`, `flywheel-collector`) movem para `examples/novais-digital/skills/` e são consumidas pelo projeto `novais-digital-governanca-ia`.

### Tasks

- [x] **F1.1** Skills L0 (Tier 1 estratégico) — **3/3 concluídas em 2026-04-30**:
  - [x] `company-dna.md` — lê DNA da organização
  - [x] `icp-loader.md` — lê ICP com sinais de qualificação e anti-ICP
  - [x] `offerings-loader.md` — lê catálogo de ofertas (lifecycle + pricing model)
- [x] **F1.2** Skills L1 (Tier 2 tático) — **3/3 concluídas em 2026-04-30**:
  - [x] `baseline-cost-builder.md` — custo humano baseline + derivação de preço mínimo C3
  - [x] `diagnostic-runner.md` — roteiro estruturado Fase 0 (10 blocos) com handoffs
  - [x] `process-mapper.md` — mapa as-is agent-ready com `agent_readiness_score` heurístico
- [x] **F1.3** Skills L2 (Tier 3 operacional) — **3/3 concluídas em 2026-04-30**:
  - [x] `artifact-prompt-builder.md` — system prompt versionado em 9 seções canônicas com hash + recalc_unit_economics
  - [x] `eval-case-author.md` — eval cases (real/synthetic/edge/adversarial) com PII sanitization e cobertura ≥30 por categoria
  - [x] `shadow-mode-runner.md` — coordena SHADOW (start/tick/report), enforça 14 dias mínimos C4, recomenda promoção (decisão humana)
- [x] **F1.4** Padrão de cada skill (validado nas L0):
  - [x] Frontmatter Anthropic (name, description) + extensões Foundry (tier, linked_principles, activation, helper_pattern, cache_strategy)
  - [x] Tabela anti-rationalization (Addy Osmani)
  - [x] Verification gate explícito
  - [x] Path-scoped auto-activation
  - [x] Hard rule de C5 (Tier 1 não lê Tier 2/3)
- [x] **F1.5** Helper pattern BMAD documentado em `docs/foundry/helper-pattern.md`
- [ ] **F1.6** Skills Novais Digital-específicas em `examples/novais-digital/skills/` (4 skills) — fora do manifest principal

### Critério de pronto

- ✅ Skills L0 carregam por path correto (path-scoped) — **entregue**
- ✅ Skills L1 (Tier 2) entregues com handoff explícito entre si (diagnostic → baseline → mapper) — **entregue**
- ✅ Skills L2 (Tier 3) entregues com cadeia completa (prompt-builder + eval-case-author + shadow-mode-runner) — **entregue**
- ✅ Manifest atualizado com 9 skills genéricas — **entregue**
- ⏳ `diagnostic-runner` em sessão simulada produz relatório Fase 0 estruturado (validar quando Foundry-2 entregar `/novais-digital:diagnose`)
- ⏳ L0 com helper pattern reduz tokens de prompts L2 em ≥70% (medido via Langfuse pós Foundry-3)
- ⏳ 4 skills Novais Digital-específicas em `examples/novais-digital/skills/` (F1.6 — pendente, escopo opcional para esta onda)

---

## Foundry-2 — Slash commands (3–5 dias)

**Objetivo**: pipeline completo roda do `/diagnose` ao `/promote` em SKU exemplo (`example-triagem-whatsapp`).

### Tasks

- [x] **F2.1** Comandos de spec/economics — **4/4 concluídas em 2026-04-30**:
  - [x] `/novais-digital:diagnose` — Fase 0 cobrável (10 blocos) com handoff para spec/unit-economics
  - [x] `/novais-digital:spec` — gera spec do artefato (renomeada de `spec-sku`); `--type ∈ {platform-sku, product, diagnostic}` resolve template
  - [x] `/novais-digital:unit-economics` — calcula baseline + deriva preço mínimo C3; bloqueia avanço se unviable
  - [x] `/novais-digital:sla-threshold` — pré-contrata C4 thresholds com aprovação humana + signature_hash imutável
- [x] **F2.2** Comandos de implementação — **3/3 concluídas em 2026-04-30**:
  - [x] `/novais-digital:plan` — plano técnico em 8 seções canônicas (camadas, fluxo, instrumentação, tenant, cronograma, riscos)
  - [x] `/novais-digital:tasks` — DAG em 5 ondas (scaffolding → prompt → eval seed → SHADOW prep → metrics) com gate por task
  - [x] `/novais-digital:implement` — executa ondas com pausas humanas; NÃO inicia SHADOW (responsabilidade de `/novais-digital:promote`)
- [x] **F2.3** Comandos de validação — **4/4 concluídas em 2026-04-30**:
  - [x] `/novais-digital:eval` — eval suite com pass rate por categoria, source_mode breakdown, detecção de regressão por `prompt_hash`
  - [x] `/novais-digital:promote` — único caminho para mudar `subscription.mode`; 5 gates + aprovação cruzada com `signature_hash`
  - [x] `/novais-digital:audit-monthly` — sample 5-10%, drift detection, audit C1-C8, output consumível pelo reviewer DeepAgent
  - [x] `/novais-digital:pre-merge-check` — read-only consolidação de 5 gates (C7/C8/C6/manifest/eval) com exit code 0/1/2
- [x] **F2.4** Cada command com (validado nas 11):
  - [x] Verification gate explícito (não-negociável)
  - [x] Output structured (YAML)
  - [x] Trace Langfuse mesmo para uso manual (exceto `pre-merge-check` que é read-only)
  - [x] Tabela anti-rationalization
  - [x] Saída de erro estruturada com enum

### Critério de pronto

- ✅ Pipeline `/diagnose → /spec → /unit-economics → /sla-threshold → /plan → /tasks → /implement → /eval → /promote` validável end-to-end nos artefatos do framework
- ✅ Cada gate produz artefato persistido em `docs/clients/{client_id}/`, `docs/specs/`, `prompts/`, `evals/`, `subscriptions/` ou `docs/foundry/audits/`
- ✅ Manifest atualizado com 11 commands organizados em 3 grupos (spec_economics, implementation, validation)

---

## Foundry-3 — Subagents Guardian + Reviewer (4–6 dias)

**Objetivo**: PO Guardian recebe pedido genérico do CEO ("queremos automatizar follow-up") e devolve spec D1+D2 em formato de cláusula contratual em 1 sessão. Reviewer DeepAgents valida tudo.

### Tasks

- [x] **F3.1** 8 Guardians principais — **8/8 concluídas em 2026-05-01**:
  - [x] `po-guardian.md` (Opus) — outcome clause + ICP fit + cross-approver de promoção
  - [x] `artifact-architect.md` (Opus) — renomeado de `sku-architect` (alinhamento v0.2.0); plan 8 seções + agent_readiness
  - [x] `unit-economist.md` (Opus) — c3_check + recalc_unit_economics
  - [x] `eval-engineer.md` (Sonnet) — coverage + source_mode + regressão
  - [x] `tenant-context-curator.md` (Sonnet) — TenantContext schema + lint C8
  - [x] `observability-guardian.md` (Sonnet) — Section 8 + observe() lint + trace_coverage
  - [x] `promotion-officer.md` (Opus) — Gate 5 do promote, cross-approval mandatório
  - [x] `security-privacy-guardian.md` (Sonnet) — PII/LGPD/secrets + 3ª assinatura para AUTONOMOUS
- [x] **F3.2** 2 Cross-LLM reviewers — **2/2 concluídas**:
  - [x] `code-reviewer-claude.md` (Sonnet) — code review nativo de PR
  - [x] `code-reviewer-cross.md` (Haiku, delegator) — bridge para DeepAgent `foundry-auditor`
- [x] **F3.3** **Stack do reviewer decidida** — F17/F18 em `decisions.md`:
  - Stack: `deepagents` CLI (Python, LangChain) v0.0.34+
  - Tradução: `andersonamaral2/Claude-Code-to-Deep-Agents-Skills-Converter` (MIT)
  - Local de execução: a definir em ADR-002 do consumidor (template `templates/adr-reviewer-runtime.template.md`)
- [x] **F3.4** Reviewer DeepAgent infraestrutura:
  - 9 skills convertidas + `foundry-auditor` (skill orquestradora nativa) em `reviewer/deepagents/skills/`
  - Output em `docs/foundry/audits/{YYYY-MM}.md` validado contra `reviewer/output-schema.json`
- [x] **F3.5** Smart model routing aplicado: 4 Opus + 4 Sonnet + 1 Haiku + 1 sem modelo direto (DeepAgent externo)
- [ ] **F3.6** ADR-002 do projeto consumidor (responsabilidade do consumer; template entregue)
- [ ] **F3.7** Primeira auditoria mensal de teste (responsabilidade do consumer)

### Critério de pronto

- ✅ PO Guardian em sessão simulada produz spec D1+D2 completo
- ✅ Reviewer DeepAgents executa primeira auditoria mensal de teste e gera relatório
- ✅ ADR-002 assinada
- ✅ Manifest atualizado com 10 agents

---

## Foundry-4 — Hooks runtime (3–5 dias)

**Objetivo**: tentar editar `docs/adr/001-stack-saas2.md` sem flag `--ceo-approved` é bloqueado pelo hook.

### Tasks

- [x] **F4.1** Hooks PreToolUse — **4/4 concluídas em 2026-05-01**:
  - [x] `outcome-clause-guard` (bloqueia edição de D2 aprovado)
  - [x] `adr-approval-gate` (bloqueia edição de ADRs assinadas)
  - [x] `secret-scan` (detecta API keys / connection strings)
  - [x] `any-type-guard` (bloqueia `any` em `src/skus/**` e `src/agents/**`)
- [x] **F4.2** Hooks PostToolUse — **3/3 concluídas em 2026-05-01**:
  - [x] `langfuse-trace-check` (lint regex em chamadas LLM sem trace)
  - [x] `unit-economics-recalc` (detecta mudança de prompts e dispara recalc C3)
  - [x] `manifest-sync` (informa quando artefatos Foundry mudam sem update de manifest)
- [x] **F4.3** Hooks Stop — **2/2 concluídas em 2026-05-01**:
  - [x] `5-gates-summary` (relatório de gates ao fim da sessão, persiste em session-gate-reports/)
  - [x] `eval-suite-fresh` (avisa se evals/{sku}/cases/ < 30 ao fim da sessão)
- [x] **F4.4** Permissions deny list (já presente desde Foundry-0 em settings.json)
- [x] **F4.5** `skill-security-scan.sh` standalone (S1-S5: secrets, URLs, destrutivos, bypass, frontmatter)
- [x] **F4.6** Bypass auditado: `NOVAIS_FOUNDRY_BYPASS=<motivo>` em env ou `settings.local.json`; todos os bypasses registrados em `docs/foundry/bypass-log/YYYY-MM-DD.md`

### Critério de pronto

- ✅ Tentativa de edição protegida sem flag é bloqueada — **entregue**
- ✅ Bypass auditado deixa rastro em `docs/foundry/bypass-log/` — **entregue**
- ✅ Manifest sync hook informa quando artefatos Foundry mudam sem update de manifest — **entregue**
- ✅ Reviewer DeepAgents valida que hooks estão configurados conforme Constitution — **entregue (script)**

---

## Foundry-5 — Playbooks verticais (contínuo, pós cliente 1)

**Objetivo**: cliente 2 do mesmo vertical custa <30% do esforço do cliente 1.

### Tasks

- [x] **F5.1** Infraestrutura para playbooks verticais — **entregue em 2026-05-01**:
  - [x] `templates/playbook.template.md` — template com blocos, padrões, métricas de esforço
  - [x] `/novais-digital:playbook-extract` — command que guia extração a partir de SKU em AUTONOMOUS
  - [x] `docs/playbooks/README.md` — estrutura esperada + critérios de sucesso
  - [ ] Playbook real do primeiro vertical — **pendente: aguardando cliente 1 em AUTONOMOUS**
- [x] **F5.2** Catalogação de blocos reutilizáveis — **entregue via template** (tiers 1/2/3 com confiança)
- [x] **F5.3** Infraestrutura para retrospectivas — **entregue em 2026-05-01**:
  - [x] `templates/retrospective.template.md` — template C1-C8 + gate failures + métricas reais
  - [x] `docs/retrospectives/` — diretório criado
  - [ ] Retrospectiva real do primeiro SKU — **pendente: aguardando AUTONOMOUS**
- [x] **F5.4** Processo de refinamento da Constitution documentado em `CLAUDE.md` (exige ADR + MAJOR)
- [x] **F5.5** Reavaliado em F20 — manter projeto-scoped; `foundry-global-install.sh` como opt-in futuro
- [x] **F5.6** Reavaliado em F21 — não publicar ainda; reavaliar com ≥ 3 projetos em AUTONOMOUS

### Critério de pronto

- ✅ Templates e command de extração entregues (infraestrutura do framework) — **entregue**
- ⏳ Cliente 2 do mesmo vertical consome ≤30% das horas do cliente 1 — **pendente: aguardando dados reais**
- ⏳ Playbook vertical com métricas reais — **pendente: aguardando cliente 1 em AUTONOMOUS**
- ⏳ Retrospectiva publicada com gate failures reais — **pendente**

---

---

## Foundry-6 — AIOS Server (camada de implementação multiagente) ✅ (v0.5.0)

**Objetivo**: projeto consumidor que adota AIOS Server tem suporte nativo nos artefatos do Foundry — sem precisar adaptá-los manualmente.

> **Contexto**: projeto SchoolPlatform adotou AIOS Server (arXiv 2403.16971, `agiresearch/AIOS` v0.2.2) como kernel LLM OS. F6.1/F6.2 entregues no consumidor; F6.3–F6.6 entregues aqui no Foundry.

### Tasks

- [x] **F6.1** *(no consumidor)* ADR-003 + orchestrator.py + aios/agents/ base — entregue em SchoolPlatform
- [x] **F6.2** *(no consumidor)* docs/aios-setup.md + config.yaml + .aios-kernel/ runtime — entregue em SchoolPlatform
- [x] **F6.3** Atualizar slash commands existentes — **3/3 concluídas em 2026-05-06**:
  - [x] `/novais-digital:plan` — seção 9 condicional "Classificação AIOS" (quando `spec.aios_tier` definido)
  - [x] `/novais-digital:tasks` — Wave 2-AIOS com 4 tasks (T2-AIOS-1 a T2-AIOS-4) quando `aios_tier` presente
  - [x] `/novais-digital:implement` — bloco "Modo de implementação" com detecção de `--via aios` + `spec.aios_tier`
- [x] **F6.4** Criar novos slash commands AIOS — **3/3 concluídas em 2026-05-06**:
  - [x] `/novais-digital:aios-init` — scaffolda `aios/agents/{module}/` com validation gate (4 checks pré-criação)
  - [x] `/novais-digital:aios-run` — wrapper para orchestrator.py com gates humanos C4 obrigatórios
  - [x] `/novais-digital:aios-status` — tabela read-only de status dos módulos + BLOCKER detection
- [x] **F6.5** `docs/foundry/aios-telemetry-pattern.md` — padrão Langfuse oficial (campos obrigatórios, mock, integração com hook langfuse-trace-check)
- [x] **F6.6** `templates/platform-sku-spec.template.md` — `aios_tier` + `aios_context_boundaries` no frontmatter (após `owners:`)

### Critério de pronto

- ✅ `/novais-digital:plan` tem seção 9 AIOS (condicional) — **entregue**
- ✅ `/novais-digital:tasks` emite Wave 2-AIOS quando `aios_tier` presente — **entregue**
- ✅ `/novais-digital:implement` suporta `--via aios` com detecção automática — **entregue**
- ✅ 3 novos commands AIOS criados com padrão completo (verification gate, anti-rationalization, output structured) — **entregue**
- ✅ `aios-telemetry-pattern.md` com padrão Langfuse + mock + mapeamento Constitution — **entregue**
- ✅ Spec template com `aios_tier` no frontmatter — **entregue**
- ✅ `manifest.json` v0.5.0 atualizado com novos artefatos — **entregue**
- ✅ `decisions.md` com F23 (mapeamento AIOS ↔ Constitution) — **entregue**

---

## Foundry-7 — AIOS agentes portáveis (templates físicos canônicos) ✅ (v0.6.0)

**Objetivo**: cada novo projeto consumidor que adote AIOS recebe os 6 agentes (`spec`, `backend`, `frontend`, `schema`, `test`, `review`) **prontos** a partir de templates canônicos versionados na Foundry — sem hardcode de cliente, sem dependência da implementação de referência (SchoolPlatform), com schema stack-agnostic.

> **Contexto**: Foundry-6 entregou commands + telemetria, mas o boilerplate dos agentes ficou inline no `aios-init.md` e cobria só 3 dos 6 agentes. Foundry-7 fecha o gap extraindo os 6 como templates físicos em `templates/aios/`.

### Tasks

- [x] **F7.1** `templates/aios/README.md` — placeholders, estrutura, diferenças vs. SchoolPlatform — **entregue 2026-05-07**
- [x] **F7.2** `templates/aios/orchestrator.py.template` + `templates/aios/config.yaml.template` — pipeline + config canônica com `project.*`, `stack.*`, `modules:` — **entregue 2026-05-07**
- [x] **F7.3** 6 agentes em `templates/aios/agents/` — **entregue 2026-05-07**:
  - [x] `spec_agent/` (especializado por módulo)
  - [x] `backend_agent/` (especializado, stack via `stack.backend`)
  - [x] `frontend_agent/` (especializado, stack via `stack.frontend`)
  - [x] `schema_agent/` (compartilhado, **stack-agnostic** — propõe stack se vazia)
  - [x] `test_agent/` (compartilhado, stack via `stack.tests`)
  - [x] `review_agent/` (compartilhado, checklist Constitution C5-C8)
- [x] **F7.4** `/novais-digital:aios-init` v0.2.0 — copia de templates físicos; cobre 6 agentes; cria orchestrator/config quando ausentes — **entregue 2026-05-07**
- [x] **F7.5** `manifest.json` v0.6.0 — bloco `templates_aios.files[]` com 9 entradas — **entregue 2026-05-07**
- [x] **F7.6** F24 em `decisions.md` — justificativa, mapeamento Constitution, trade-offs — **entregue 2026-05-07**

### Critério de pronto

- ✅ 6 agentes em `templates/aios/agents/` com `entry.py.template` + `config.json.template`
- ✅ Cada `entry.py.template` tem bloco Langfuse + `_MockTrace` (C6)
- ✅ Cada `entry.py.template` declara LEIA APENAS / NÃO LEIA (C5)
- ✅ Nenhum SYSTEM_PROMPT cita "AcmeEdu", nome de cliente ou framework cravado (C7/C8)
- ✅ `schema_agent` lê `aios/config.yaml → stack.database` ou propõe stacks (modo `PROPOR_STACK`)
- ✅ `/novais-digital:aios-init` v0.2.0 valida 7 checks pré-cópia; idempotente para agentes compartilhados
- ✅ `manifest.json` registra 9 artefatos novos em `templates_aios.files[]`

---

## Foundry-8 — CI/CD esteira completa para produção ✅ (v0.7.0)

**Objetivo**: nenhum SKU pode promover para `AUTONOMOUS` sem CI/CD pipeline ativo verificável — foundry-doctor, eval automático e auditoria mensal rodando em CI, branch protection ativa.

> **Contexto**: Foundry-0 a Foundry-7 construíram toda a governança de IA (spec → shadow → promoted) mas não impunham CI/CD como pré-requisito mecânico. Regressões de prompt passavam despercebidas sem CI; auditoria mensal era manual. Foundry-8 fecha o gap tornando CI/CD um **Gate obrigatório** (Gate 6) do `/novais-digital:promote`.

### Tasks

- [x] **F8.1** Templates de CI/CD em `templates/cicd/` — **4/4 entregues em 2026-05-07**:
  - [x] `github-actions-validate.template.yml` — workflow de validação (foundry-doctor + skill-scan + pre-merge G1-G5) em todo PR
  - [x] `github-actions-eval.template.yml` — eval automático quando `prompts/` muda; falha PR se pass_rate < threshold; trace Langfuse obrigatório (C6)
  - [x] `github-actions-audit.template.yml` — cron mensal (1ª seg. 06:00 UTC); commit automático de relatório; cria Issue se SLA breach
  - [x] `cicd-checklist.template.md` — checklist platform-agnostic com 27 itens (18 🔴 obrigatórios, 9 🟡 recomendados)
- [x] **F8.2** Gate 6 no `/novais-digital:promote` — **entregue em 2026-05-07**:
  - [x] Gate 6 adicionado à seção "Os 6 gates" de `promote.md` (obrigatório apenas para `assisted_to_autonomous`)
  - [x] `gate_count: 5 → 6`; output `cicd_pipeline_active: pass | skipped`
  - [x] Tabela anti-rationalization expandida com entrada CI/CD
- [x] **F8.3** Wave 6 CI/CD no `/novais-digital:tasks` — **entregue em 2026-05-07**:
  - [x] 5 tasks (T6.1–T6.5): workflow de validação, eval CI, branch protection, audit cron, checklist assinado
  - [x] DAG expandido; `total_waves: 5 → 6`
  - [x] T6.5 produz `docs/cicd-checklist-{artifact_id}.md` com `gate_6_status: pass`
- [x] **F8.4** `promotion-officer.md` atualizado — Gate 6 na seção `assisted_to_autonomous`; verification gate e anti-rationalization expandidos
- [x] **F8.5** F25 em `decisions.md`
- [x] **F8.6** `manifest.json` v0.7.0 com bloco `templates.cicd` (4 entradas)

### Critério de pronto

- ✅ `templates/cicd/` com 4 templates (validate, eval, audit, checklist) — **entregue**
- ✅ Gate 6 bloqueia `assisted_to_autonomous` sem checklist assinado — **entregue**
- ✅ Wave 6 no tasks.md com 5 tasks e DAG sem ciclos — **entregue**
- ✅ `promotion-officer` exige Gate 6 antes de assinar promoção para AUTONOMOUS — **entregue**
- ⏳ Primeiro projeto consumidor implementando Wave 6 e obtendo Gate 6 validado — pendente (aguarda SKU em ASSISTED)

---

## Dependências entre Foundry e ondas Novais Digital

```
Onda Novais Digital 0 (Cenário B)        ←  Foundry-0  ✅ paralelo, não bloqueia
Onda Novais Digital 1 (fundação arquit.) ←  Foundry-1  ✅ paralelo
Onda Novais Digital 2 (SKU piloto E2E)   ←  Foundry-2  ⚠️ Foundry-2 acelera mas não bloqueia
Onda Novais Digital 3 (eval suite real)  ←  Foundry-3  🔴 Foundry-3 entrega gates de eval
Onda Novais Digital 4 (billing/dashboard)←  Foundry-4  ⚠️ Foundry-4 adiciona governança
Onda Novais Digital 5 (limpeza legado)   ←  Foundry-5  🟢 Foundry-5 só faz sentido pós-Novais Digital-3
```

---

## Métricas de sucesso do framework (KPIs do Foundry)

Medidas mensalmente após Foundry-3:

| Métrica | Meta |
|---|---|
| Tempo de criação de SKU novo (do `/diagnose` ao SHADOW) | ≤ 10 dias úteis |
| Tokens médios por outcome em produção | ≤ 25% do baseline pré-helper-pattern |
| % de PRs bloqueados por hooks Foundry | 5–15% (saudável; <5% = hooks fracos; >15% = atrito) |
| % de auditorias mensais com SLA passando | ≥ 90% após Foundry-4 maduro |
| Esforço cliente N+1 / cliente 1 (mesmo vertical) | ≤ 30% após Foundry-5 |
