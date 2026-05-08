---
project_name: "{PROJECT_NAME}"
artifact_id: "{ARTIFACT_ID}"
platform: github-actions | gitlab-ci | bitbucket | jenkins | other
ci_setup_date: null
last_reviewed: null
forge_version: "0.7.0"
linked_principles: [C1, C4, C6, C7]
---

# CI/CD Checklist — {PROJECT_NAME}

> Checklist platform-agnostic para garantir que o projeto consumidor tem CI/CD completo
> antes de promover qualquer SKU para `AUTONOMOUS`.
>
> **Pré-requisito obrigatório**: todos os itens marcados com 🔴 devem estar ✅ antes de
> `/acme:promote --to_mode=assisted_to_autonomous`. Gate 6 do promotion-officer verifica.

---

## 1. Validação estrutural (obrigatório para qualquer modo)

- [ ] 🔴 `forge-doctor.sh` rodando em CI em todo PR — exit code 0 bloqueia merge
- [ ] 🔴 `skill-security-scan.sh` rodando quando `.claude/skills/` muda
- [ ] 🔴 Manifest JSON válido (`docs/forge/manifest.json`) verificado em CI
- [ ] 🟡 Lint de markdown para arquivos em `docs/` e `.claude/`
- [ ] 🟡 Verificação de links quebrados em arquivos `.md`

## 2. Pre-merge checks G1-G5 (obrigatório para SHADOW e acima)

- [ ] 🔴 **G1** — Imports de SDK só em `src/llm/adapters/` (lint regex em PR)
- [ ] 🔴 **G2** — Sem hardcode por tenant em `src/skus/` e `src/agents/`
- [ ] 🔴 **G3** — Toda chamada LLM com `observe()` wrapper (lint — WARN no PR)
- [ ] 🔴 **G4** — `manifest.json` sincronizado com artefatos do branch (lint)
- [ ] 🟡 **G5** — Aviso automático quando `prompts/` muda sem eval recente

## 3. Eval suite automática (obrigatório para ASSISTED e acima)

- [ ] 🔴 Workflow de eval detecta automaticamente qual `artifact_id` mudou em `prompts/`
- [ ] 🔴 Eval roda e calcula `pass_rate` por `outcome_category`
- [ ] 🔴 PR falha se `pass_rate < c4_thresholds.agreement_rate_min` em qualquer categoria
- [ ] 🔴 Relatório de eval persistido em `evals/{artifact_id}/runs/` como artefato de CI
- [ ] 🔴 Todo run de eval tem trace Langfuse (C6) — `LANGFUSE_PUBLIC_KEY` configurado
- [ ] 🟡 Comentário automático no PR com resumo do resultado de eval

## 4. Auditoria mensal automatizada (obrigatório para AUTONOMOUS)

- [ ] 🔴 Cron de auditoria configurado (1ª seg. do mês, 06:00 UTC)
- [ ] 🔴 Relatório salvo em `docs/forge/audits/{YYYY-MM}.md` e commitado automaticamente
- [ ] 🔴 Issue criada automaticamente se SLA breach detectado
- [ ] 🟡 Notificação para canal de Slack/Teams quando auditoria falha

## 5. Branch protection (obrigatório para AUTONOMOUS)

- [ ] 🔴 `main`/`master` com branch protection ativa
- [ ] 🔴 Status checks obrigatórios: `forge-doctor`, `skill-security-scan`, `pre-merge-check`
- [ ] 🔴 Require PR aprovation (mínimo 1 aprovador)
- [ ] 🔴 Dismiss stale reviews quando novo commit é feito
- [ ] 🟡 Require signed commits
- [ ] 🟡 Linear history (no merge commits)

## 6. Secrets e credenciais (obrigatório para AUTONOMOUS)

- [ ] 🔴 `ANTHROPIC_API_KEY` (ou equivalente) em GitHub Secrets — nunca em código
- [ ] 🔴 `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` em GitHub Secrets
- [ ] 🔴 `DEEPAGENTS_API_KEY` para reviewer DeepAgent
- [ ] 🔴 `GH_TOKEN` com permissões de write para commit de auditoria + criar issues
- [ ] 🟡 Rotação de secrets configurada (90 dias)

## 7. Rastreabilidade de deploys (obrigatório para AUTONOMOUS)

- [ ] 🔴 Cada deploy/promoção gera tag semântica (`v{major}.{minor}.{patch}`)
- [ ] 🔴 `promotions.md` atualizado via `/acme:promote` antes de qualquer deploy de mudança de modo
- [ ] 🔴 `prompt_hash` em produção == `prompt_hash` do eval mais recente (lint automático)
- [ ] 🟡 SBOM gerado a cada release (`npm audit` ou `pip-audit`)
- [ ] 🟡 Dependabot ou Renovate ativo para atualizações de segurança

---

## Resultado da verificação

```yaml
# Preencher antes de solicitar /acme:promote --to_mode=assisted_to_autonomous
project_name: "{PROJECT_NAME}"
artifact_id: "{ARTIFACT_ID}"
checklist_reviewed_at: null
checklist_reviewed_by: null
items_total: 27
items_red_total: 18
items_red_checked: 0       # deve ser 18/18 para AUTONOMOUS
items_yellow_total: 9
items_yellow_checked: 0    # recomendado mas não bloqueia
ci_pipeline_url: null      # ex: https://github.com/org/repo/actions
last_ci_run_status: null   # passing | failing
forge_doctor_last_pass: null
eval_last_run: null
audit_last_run: null
gate_6_status: pending     # pending | pass | fail
notes: ""
```

---

## Como usar este checklist

1. **Copie** para `docs/cicd-checklist-{artifact_id}.md` no projeto consumidor
2. **Preencha** substituindo placeholders (`{PROJECT_NAME}`, `{ARTIFACT_ID}`)
3. **Marque** cada item conforme implementa
4. **Execute** `forge-doctor.sh` e confirme status `pass` antes de preencher o resultado
5. **Compartilhe** com o `promotion-officer` ao chamar `/acme:promote --to_mode=assisted_to_autonomous`
6. O `promotion-officer` valida o **Gate 6** lendo este arquivo — todos os itens 🔴 marcados são pré-requisito

---

## Legenda

| Ícone | Significado |
|---|---|
| 🔴 | Obrigatório — Gate 6 bloqueia `assisted_to_autonomous` se não marcado |
| 🟡 | Recomendado — não bloqueia promoção, mas aumenta confiança operacional |
| ✅ | Implementado e verificado |
| ❌ | Não implementado (justificar no campo `notes`) |
