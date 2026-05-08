# Reviewer — Deep Agents (LangChain)

> **Decisão F17/F18** (2026-05-01) — `docs/forge/decisions.md`

Esta pasta contém os assets necessários para que um **DeepAgent (LangChain)** auditarmensalmente um projeto consumidor do Forge contra a Constitution C1-C8 + extensões declaradas.

---

## Conteúdo

```
reviewer/deepagents/
  ├── README.md                 ← este arquivo
  ├── conversion-log.md         ← histórico de conversões aplicadas
  └── skills/
      ├── L0/
      │   ├── company-dna/SKILL.md
      │   ├── icp-loader/SKILL.md
      │   └── offerings-loader/SKILL.md
      ├── L1/
      │   ├── baseline-cost-builder/SKILL.md
      │   ├── diagnostic-runner/SKILL.md
      │   └── process-mapper/SKILL.md
      ├── L2/
      │   ├── artifact-prompt-builder/SKILL.md
      │   ├── eval-case-author/SKILL.md
      │   └── shadow-mode-runner/SKILL.md
      └── reviewer/
          └── forge-auditor/SKILL.md
```

| Pasta | O que é | Origem |
|---|---|---|
| `skills/L0`, `L1`, `L2` | Versão Deep Agents das 9 skills do Forge | **Gerada** por conversão a partir de `.claude/skills/` (não editar à mão) |
| `skills/reviewer/forge-auditor` | Skill orquestradora da auditoria mensal | Escrita **direta** em formato Deep Agents (não tem origem em Claude Code) |

---

## Stack escolhida (F17)

- **Deep Agents CLI v0.0.34+** (Python, LangChain)
- **Provider**: configurável via env var `DEEPAGENTS_MODEL`; default OpenAI direto (F10)
- **Local de execução**: processo separado no projeto consumidor (ou CI) — não dependência embarcada
- **Output**: `docs/forge/audits/{YYYY-MM}.md` consumível por humano + por `/acme:audit-monthly` do Forge

---

## Como instalar (no projeto consumidor)

### 1. Instalar Deep Agents CLI

```bash
pip install deepagents
deepagents --version  # >= 0.0.34
```

### 2. Instalar o converter de skills (uma vez)

```bash
curl -fsSL https://raw.githubusercontent.com/andersonamaral2/Claude-Code-to-Deep-Agents-Skills-Converter/main/install.sh | bash
deepagents skills list  # deve mostrar: skill-converter
```

### 3. Instalar as 10 skills do Forge (este diretório)

Opção A — local-scoped (uma sessão):

```bash
mkdir -p .deepagents/skills/
cp -r reviewer/deepagents/skills/L0 reviewer/deepagents/skills/L1 \
      reviewer/deepagents/skills/L2 reviewer/deepagents/skills/reviewer \
      .deepagents/skills/

deepagents skills list
# Esperado: skill-converter, company-dna, icp-loader, offerings-loader,
#           baseline-cost-builder, diagnostic-runner, process-mapper,
#           artifact-prompt-builder, eval-case-author, shadow-mode-runner,
#           forge-auditor
```

Opção B — global (todos os projetos):

```bash
mkdir -p ~/.deepagents/agent/skills/
cp -r reviewer/deepagents/skills/* ~/.deepagents/agent/skills/
```

### 4. Configurar credenciais do provider

```bash
export OPENAI_API_KEY=sk-...           # ou ANTHROPIC_API_KEY, GOOGLE_API_KEY
export DEEPAGENTS_MODEL=gpt-4.1-mini   # default; pode ser claude-sonnet-4, etc
```

---

## Como rodar a auditoria mensal

```bash
# da raiz do projeto consumidor
deepagents -y -n "Run the forge-auditor skill against this repository for month 2026-04"
```

Ou via CI workflow (exemplo):

```yaml
# .github/workflows/forge-audit.yml
name: Forge Monthly Audit
on:
  schedule:
    - cron: '0 8 1 * *'  # 1º dia útil de cada mês, 08h UTC
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install deepagents
      - run: cp -r reviewer/deepagents/skills/* ~/.deepagents/agent/skills/
      - run: deepagents -y -n "Run forge-auditor for month $(date -d 'last month' +%Y-%m)"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          DEEPAGENTS_MODEL: gpt-4.1-mini
```

A skill `forge-auditor` produz `docs/forge/audits/{YYYY-MM}.md` no formato consumido por `reviewer/output-schema.json`.

---

## Como reconverter as skills (quando uma `.claude/skills/` mudar)

A regra **F18** diz que a versão Deep Agents é sempre **gerada**, nunca editada à mão.

### Manual (uma skill)

```bash
deepagents -y "Read .claude/skills/L0/company-dna.md and convert this Claude Code \
  skill to Deep Agents. Save as reviewer/deepagents/skills/L0/company-dna/SKILL.md"
```

### Batch (todas)

```bash
deepagents -y "Convert all Claude Code skills in .claude/skills/ to Deep Agents \
  format. Save each one in reviewer/deepagents/skills/{tier}/{name}/SKILL.md, \
  matching the source path tier."
```

Toda conversão deve atualizar `reviewer/deepagents/conversion-log.md` com:
- Origem (path + sha256:16 da skill original)
- Data
- Versão do converter
- Transformações aplicadas

Em **Forge-4** isso será automatizado por hook `manifest-sync` + sub-hook `deepagents-resync`.

---

## As 8 transformações aplicadas pelo converter

| # | Transformação | O que adiciona |
|---|---|---|
| T1 | Execution Context | Tabela de tools Deep Agents usadas pela skill |
| T2 | Execution Plan | Checklist para `write_todos` com todos os passos |
| T3 | Prerequisites | Verificação de tools/env vars via `execute` |
| T4 | Explicit creation | "Create file X" → `write_file` explícito |
| T5 | Inline tests | Após cada `write_file`, teste via `execute` |
| T6 | Sub-agents | Loops viram chamadas paralelas a `task` |
| T7 | Usage guide | 3 modos (interactive, one-shot, CI/CD) |
| T8 | Troubleshooting | Issues comuns por dependência |

Mais semantic replacements: `CLAUDE.md` → `AGENTS.md`, `.claude/` → `.deepagents/`, implicit bash → `execute`, etc.

---

## Modelo de auditoria (esperado)

A skill `forge-auditor` orquestra a auditoria em paralelo via `task` (sub-agents):

```
forge-auditor (orchestrator)
  ├── task: audit C1 (diagnose-before-design)
  ├── task: audit C2 (outcome-first)
  ├── task: audit C3 (cost ≤ 25%)
  ├── task: audit C4 (SHADOW antes de cobrar)
  ├── task: audit C5 (three-tier)
  ├── task: audit C6 (telemetry)
  ├── task: audit C7 (portability — lint regex)
  └── task: audit C8 (anti-customização — lint regex)
       │
       ↓
  consolida findings em docs/forge/audits/{YYYY-MM}.md
```

Cada sub-task carrega contexto Tier 1 das skills convertidas (`company-dna`, `icp-loader`, `offerings-loader` em formato Deep Agents) para tomar decisões sobre o que conta como conformidade.

---

## Limitações conhecidas

- Requer Python 3.11+ no ambiente do reviewer
- Modelos com janela < 128k tokens podem truncar `manifest.json` + skills + artefatos auditados; preferir Sonnet/Opus/GPT-5.5/Gemini Pro
- Reverse conversion (Deep Agents → Claude Code) está fora do escopo do reviewer

---

## Histórico

| Data | Mudança |
|---|---|
| 2026-05-01 | Versão inicial — estrutura criada e 9 skills L0/L1/L2 convertidas + skill orquestradora `forge-auditor`. F17/F18 registradas em `decisions.md`. |
