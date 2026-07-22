# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento alinhado com `docs/foundry/manifest.json` (`framework.version`).

## [0.15.0] - 2026-05-13

### Adicionado
- Upgrade Foundry consumer v0.7.0 → v0.15.0 via `foundry-sync.sh` (12 ADD, 28 UPDATE)
- `docs/foundry/project.json`: configuração canônica do consumer (agentic_saas, ai_enabled=true, monthly-analysis em SHADOW)
- Hooks novos: `persona-detect.sh` (PreToolUse), `friendly-errors.sh` (PostToolUse)
- Agente `foundry-router.md` (roteamento de linguagem natural → /novais-digital:*)
- Templates novos: `master-prompt.md`, `delivery-economics.template.md`, `project.template.json`, `platform-*` (4 templates)
- `scripts/foundry-doctor.sh` e `scripts/foundry` (ausentes até agora no Aicfo)
- `github-actions-test.template.yml` no cicd (TDD-first gate)
- AIOS: `test_agent` modos red/verify, `review_agent` gate TDD, `orchestrator.py` TDD-first, `config.yaml` coverage_targets
- CONSTITUTION.md v0.3.0 sincronizada
- Reviewer prompt v0.5.0 (cobre Foundry-10 TDD, Foundry-11 master-prompt, Foundry-12 Surface layer)
- `settings.json`: `_foundry_version=0.15.0`, `_constitution_version=0.3.0`, metadata `_foundry_hooks`
- `MASTER_PROMPT.md`, `HELLO.md`, `QUICKSTART_DEV.md`, `COMMON_ERRORS.md`
- `docs/adr/004-reviewer-runtime.md` (GitHub Actions mensal, gpt-4.1-mini, Langfuse obrigatório)
- `CHANGELOG.md` criado (ausente até v0.15.0)

## [0.7.0] - 2026-05-07

### Adicionado
- Foundry-8: 4 templates CI/CD em `templates/cicd/` (github-actions-validate/eval/audit + cicd-checklist)
- Gate 6 CI/CD obrigatório no `/novais-digital:promote` para `assisted_to_autonomous`
- Wave 6 no `/novais-digital:tasks` (T6.1–T6.5)
- F25 em decisions.md
