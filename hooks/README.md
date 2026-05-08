# Acme Forge — Hooks Runtime

> Forge-4: hooks de governança para projetos consumidores do Acme Forge.

---

## Visão geral

| Hook | Tipo | Trigger | Propósito |
|---|---|---|---|
| `outcome-clause-guard` | PreToolUse | Edit/Write | Bloqueia edição de cláusulas de outcome aprovadas |
| `adr-approval-gate` | PreToolUse | Edit/Write | Bloqueia edição de ADRs assinadas |
| `secret-scan` | PreToolUse | Edit/Write | Detecta vazamento de API keys e connection strings |
| `any-type-guard` | PreToolUse | Edit/Write | Bloqueia `any` em `src/skus/**` e `src/agents/**` |
| `langfuse-trace-check` | PostToolUse | Edit/Write | Avisa quando chamadas LLM não têm trace Langfuse (C6) |
| `unit-economics-recalc` | PostToolUse | Edit/Write | Avisa quando prompts mudam e recalc C3 é necessário |
| `manifest-sync` | PostToolUse | Edit/Write | Avisa quando artefatos Forge mudam sem update de manifest |
| `5-gates-summary` | Stop | Fim de sessão | Gera relatório dos 5 gates Forge da branch atual |
| `eval-suite-fresh` | Stop | Fim de sessão | Avisa se eval suites têm menos de 30 casos (C4) |

---

## Estrutura

```
hooks/
  pre-tool-use/
    outcome-clause-guard.sh    # bloqueia (exit 2)
    adr-approval-gate.sh       # bloqueia (exit 2)
    secret-scan.sh             # bloqueia (exit 2)
    any-type-guard.sh          # bloqueia (exit 2)
  post-tool-use/
    langfuse-trace-check.sh    # avisa (exit 1)
    unit-economics-recalc.sh   # avisa (exit 1)
    manifest-sync.sh           # informa (exit 0)
  stop/
    5-gates-summary.sh         # relatório (exit 0/1)
    eval-suite-fresh.sh        # avisa (exit 0/1)
  scripts/
    skill-security-scan.sh     # standalone para CI/PR
```

---

## Instalação no projeto consumidor

Os hooks são referenciados em `.claude/settings.json` (já pré-configurado no Forge). Para ativá-los no projeto consumidor, copie a seção `hooks` do `settings.json` do Forge para o seu projeto.

**Requisitos:**
- Bash 4+ (macOS: `brew install bash`; Windows: Git Bash ou WSL)
- `jq` recomendado (fallback para Python 3 se ausente)
- `node` para validação de manifest.json

---

## Bypass de emergência

Para situações de incidente onde um hook precisa ser temporariamente ignorado:

```bash
# Em .claude/settings.local.json (gitignored)
# OU como variável de ambiente na sessão:
export ACME_FORGE_BYPASS="incident-2026-05-01-prod-down"
```

Todo bypass é **automaticamente auditado** em `docs/forge/bypass-log/YYYY-MM-DD.md`.

**Nenhum bypass apaga o rastro de auditoria.**

---

## Exit codes

| Código | Significado | Efeito |
|---|---|---|
| `0` | OK / informativo | Claude continua |
| `1` | Warning | Claude é notificado mas continua |
| `2` | Blocked | Claude interrompe a ação |

---

## Scan de segurança de skills (CI/PR)

```bash
# Escaneia todas as skills do Forge
bash hooks/scripts/skill-security-scan.sh

# Escaneia uma pasta específica
bash hooks/scripts/skill-security-scan.sh --path .claude/skills

# Falha rápido no primeiro erro
bash hooks/scripts/skill-security-scan.sh --fail-fast
```

Checks: S1 (secrets), S2 (URLs hardcoded), S3 (comandos destrutivos), S4 (bypass sem doc), S5 (frontmatter obrigatório).

---

## Bypass log format

`docs/forge/bypass-log/YYYY-MM-DD.md`:

```markdown
# Bypass Log — 2026-05-01

| Timestamp | Hook | File | Reason |
|---|---|---|---|
| 2026-05-01T14:30:00Z | outcome-clause-guard | docs/clients/client-1/sku.md | incident-prod-down |
```
