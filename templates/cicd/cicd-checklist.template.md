---
project_name: "{PROJECT_NAME}"
artifact_id: "{ARTIFACT_ID}"
platform: github-actions | gitlab-ci | bitbucket | jenkins | other
ci_setup_date: null
last_reviewed: null
foundry_version: "0.9.0"
linked_principles: [C1, C4, C6, C7]
---

# CI/CD Checklist — {PROJECT_NAME}

> Checklist platform-agnostic para garantir que o projeto consumidor tem CI/CD completo
> antes de promover qualquer SKU para `AUTONOMOUS`.
>
> **Pré-requisito obrigatório**: todos os itens marcados com 🔴 devem estar ✅ antes de
> `/novais-digital:promote --to_mode=assisted_to_autonomous`. Gate 6 do promotion-officer verifica.

---

## 1. Validação estrutural (obrigatório para qualquer modo)

- [ ] 🔴 `foundry-doctor.sh` rodando em CI em todo PR — exit code 0 bloqueia merge
- [ ] 🔴 `skill-security-scan.sh` rodando quando `.claude/skills/` muda
- [ ] 🔴 Manifest JSON válido (`docs/foundry/manifest.json`) verificado em CI
- [ ] 🟡 Lint de markdown para arquivos em `docs/` e `.claude/`
- [ ] 🟡 Verificação de links quebrados em arquivos `.md`

## 2. Pre-merge checks G1-G6 (obrigatório para SHADOW e acima)

- [ ] 🔴 **G1** — Imports de SDK só em `src/llm/adapters/` (lint regex em PR)
- [ ] 🔴 **G2** — Sem hardcode por tenant em `src/skus/` e `src/agents/`
- [ ] 🔴 **G3** — Toda chamada LLM com `observe()` wrapper (lint — WARN no PR)
- [ ] 🔴 **G4** — `manifest.json` sincronizado com artefatos do branch (lint)
- [ ] 🟡 **G5** — Aviso automático quando `prompts/` muda sem eval recente
- [ ] 🔴 **G6** — TDD-RED gate: todo módulo modificado em `src/{modules,features,domains}/` tem `tests/{module}/unit/` correspondente (Foundry v0.9.0+)

## 3. Testes funcionais do projeto cliente (obrigatório para SHADOW e acima — Foundry v0.9.0+)

> Esta seção é nova na Foundry v0.9.0. O pipeline AIOS agora é TDD-first: testes são gerados
> antes do código. Esta seção garante que a CI roda esses testes de verdade e enforce coverage.

- [ ] 🔴 Workflow `foundry-test.yml` ativo (copiado de `templates/cicd/github-actions-test.template.yml`)
- [ ] 🔴 `aios/config.yaml` tem bloco `test_commands:` preenchido (install/lint/typecheck/unit/integration/e2e)
- [ ] 🔴 `aios/config.yaml` tem `coverage_targets:` por tier (A=70/B=85/C=95% de cobertura de linha)
- [ ] 🔴 Unit tests rodam em matrix por módulo declarado em `modules:`
- [ ] 🔴 Coverage gate bloqueia merge se `line/branch` ficar abaixo do target do tier do módulo
- [ ] 🔴 Integration tests rodam contra DB ephemeral (service container Postgres/MySQL) — **sem mocks de regra de negócio**
- [ ] 🔴 E2E (Playwright/Cypress) roda para módulos com `has_ui: true` declarado no config
- [ ] 🔴 Tier C: integration tests + e2e (quando UI) são bloqueantes (gate explícito no workflow)
- [ ] 🔴 Cada PR comenta resumo de cobertura (matrix por módulo)
- [ ] 🟡 Artefatos de teste (coverage report, Playwright report) retidos ≥ 30 dias
- [ ] 🟡 Tempo total da pipeline < 15 min (paralelizar matrix; cache de deps)

## 4. Eval suite automática (obrigatório para ASSISTED e acima)

- [ ] 🔴 Workflow de eval detecta automaticamente qual `artifact_id` mudou em `prompts/`
- [ ] 🔴 Eval roda e calcula `pass_rate` por `outcome_category`
- [ ] 🔴 PR falha se `pass_rate < c4_thresholds.agreement_rate_min` em qualquer categoria
- [ ] 🔴 Relatório de eval persistido em `evals/{artifact_id}/runs/` como artefato de CI
- [ ] 🔴 Todo run de eval tem trace Langfuse (C6) — `LANGFUSE_PUBLIC_KEY` configurado
- [ ] 🟡 Comentário automático no PR com resumo do resultado de eval

## 5. Auditoria mensal automatizada (obrigatório para AUTONOMOUS)

- [ ] 🔴 Cron de auditoria configurado (1ª seg. do mês, 06:00 UTC)
- [ ] 🔴 Relatório salvo em `docs/foundry/audits/{YYYY-MM}.md` e commitado automaticamente
- [ ] 🔴 Issue criada automaticamente se SLA breach detectado
- [ ] 🟡 Notificação para canal de Slack/Teams quando auditoria falha

## 6. Branch protection (obrigatório para AUTONOMOUS)

- [ ] 🔴 `main`/`master` com branch protection ativa
- [ ] 🔴 Status checks obrigatórios: `foundry-doctor`, `skill-security-scan`, `pre-merge-check`, `tdd-red-phase-check`, `unit-tests`, `integration-tests`
- [ ] 🔴 Require PR aprovation (mínimo 1 aprovador)
- [ ] 🔴 Dismiss stale reviews quando novo commit é feito
- [ ] 🟡 Require signed commits
- [ ] 🟡 Linear history (no merge commits)

## 7. Secrets e credenciais (obrigatório para AUTONOMOUS)

- [ ] 🔴 `ANTHROPIC_API_KEY` (ou equivalente) em GitHub Secrets — nunca em código
- [ ] 🔴 `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` em GitHub Secrets
- [ ] 🔴 `DEEPAGENTS_API_KEY` para reviewer DeepAgent
- [ ] 🔴 `GH_TOKEN` com permissões de write para commit de auditoria + criar issues
- [ ] 🟡 Rotação de secrets configurada (90 dias)

## 8. Rastreabilidade de deploys (obrigatório para AUTONOMOUS)

- [ ] 🔴 Cada deploy/promoção gera tag semântica (`v{major}.{minor}.{patch}`)
- [ ] 🔴 `promotions.md` atualizado via `/novais-digital:promote` antes de qualquer deploy de mudança de modo
- [ ] 🔴 `prompt_hash` em produção == `prompt_hash` do eval mais recente (lint automático)
- [ ] 🟡 SBOM gerado a cada release (`npm audit` ou `pip-audit`)
- [ ] 🟡 Dependabot ou Renovate ativo para atualizações de segurança

---

## Resultado da verificação

```yaml
# Preencher antes de solicitar /novais-digital:promote --to_mode=assisted_to_autonomous
project_name: "{PROJECT_NAME}"
artifact_id: "{ARTIFACT_ID}"
checklist_reviewed_at: null
checklist_reviewed_by: null
items_total: 39
items_red_total: 29        # foram somados 11 novos itens 🔴 (G6 + seção 3 testes funcionais)
items_red_checked: 0       # deve ser 29/29 para AUTONOMOUS
items_yellow_total: 10
items_yellow_checked: 0    # recomendado mas não bloqueia
ci_pipeline_url: null      # ex: https://github.com/org/repo/actions
last_ci_run_status: null   # passing | failing
foundry_doctor_last_pass: null
eval_last_run: null
audit_last_run: null
last_test_run:             # Foundry v0.9.0+ — testes funcionais do projeto cliente
  unit: null               # passing | failing | n/a
  integration: null
  e2e: null
  coverage_line_pct: null  # cobertura agregada da última execução
  coverage_branch_pct: null
gate_6_status: pending     # pending | pass | fail (promotion-officer assina aqui)
notes: ""
```

---

## Como usar este checklist

1. **Copie** para `docs/cicd-checklist-{artifact_id}.md` no projeto consumidor
2. **Preencha** substituindo placeholders (`{PROJECT_NAME}`, `{ARTIFACT_ID}`)
3. **Marque** cada item conforme implementa
4. **Execute** `foundry-doctor.sh` e confirme status `pass` antes de preencher o resultado
5. **Compartilhe** com o `promotion-officer` ao chamar `/novais-digital:promote --to_mode=assisted_to_autonomous`
6. O `promotion-officer` valida o **Gate 6** lendo este arquivo — todos os itens 🔴 marcados são pré-requisito

---

## Legenda

| Ícone | Significado |
|---|---|
| 🔴 | Obrigatório — Gate 6 bloqueia `assisted_to_autonomous` se não marcado |
| 🟡 | Recomendado — não bloqueia promoção, mas aumenta confiança operacional |
| ✅ | Implementado e verificado |
| ❌ | Não implementado (justificar no campo `notes`) |
