# Conversion Log — Claude Code → Deep Agents

> Histórico de todas as conversões aplicadas das skills `.claude/skills/` para `reviewer/deepagents/skills/`.
>
> **Regra F18**: a versão Deep Agents é sempre **gerada**, nunca editada à mão.
> Cada conversão registrada aqui inclui hash da origem para permitir detectar drift.

---

## Versão do converter

- **Origem**: https://github.com/andersonamaral2/Claude-Code-to-Deep-Agents-Skills-Converter
- **Versão**: v2.1+ (validada com Deep Agents CLI v0.0.34+)

---

## Transformações aplicadas (T1-T8)

Toda conversão aplica:
- T1 — Execution Context header
- T2 — Execution Plan (`write_todos`)
- T3 — Prerequisites Check (via `execute`)
- T4 — Explicit `write_file`
- T5 — Inline tests via `execute`
- T6 — Sub-agents via `task`
- T7 — Usage guide (3 modos)
- T8 — Troubleshooting

Mais semantic replacements: `CLAUDE.md` → `AGENTS.md`, `.claude/` → `.deepagents/`, implicit bash → `execute`, etc.

---

## Histórico de conversões

### 2026-05-01 — Lote inicial (9 skills)

**Trigger**: criação da pasta `reviewer/deepagents/` (decisão F17/F18)

**Método**: conversão manual seguindo as 8 transformações do converter (Deep Agents CLI ainda não disponível no ambiente Claude Code; manual é equivalente, validado contra exemplos do repo Anderson Amaral).

| # | Origem | Destino | Origem sha256:16 | Status |
|---|---|---|---|---|
| 1 | `.claude/skills/L0/company-dna.md` | `reviewer/deepagents/skills/L0/company-dna/SKILL.md` | (a calcular em hook Forge-4) | ✅ |
| 2 | `.claude/skills/L0/icp-loader.md` | `reviewer/deepagents/skills/L0/icp-loader/SKILL.md` | (a calcular) | ✅ |
| 3 | `.claude/skills/L0/offerings-loader.md` | `reviewer/deepagents/skills/L0/offerings-loader/SKILL.md` | (a calcular) | ✅ |
| 4 | `.claude/skills/L1/baseline-cost-builder.md` | `reviewer/deepagents/skills/L1/baseline-cost-builder/SKILL.md` | (a calcular) | ✅ |
| 5 | `.claude/skills/L1/diagnostic-runner.md` | `reviewer/deepagents/skills/L1/diagnostic-runner/SKILL.md` | (a calcular) | ✅ |
| 6 | `.claude/skills/L1/process-mapper.md` | `reviewer/deepagents/skills/L1/process-mapper/SKILL.md` | (a calcular) | ✅ |
| 7 | `.claude/skills/L2/artifact-prompt-builder.md` | `reviewer/deepagents/skills/L2/artifact-prompt-builder/SKILL.md` | (a calcular) | ✅ |
| 8 | `.claude/skills/L2/eval-case-author.md` | `reviewer/deepagents/skills/L2/eval-case-author/SKILL.md` | (a calcular) | ✅ |
| 9 | `.claude/skills/L2/shadow-mode-runner.md` | `reviewer/deepagents/skills/L2/shadow-mode-runner/SKILL.md` | (a calcular) | ✅ |

### 2026-05-01 — Skill orquestradora (escrita direta)

| # | Destino | Origem | Status |
|---|---|---|---|
| 10 | `reviewer/deepagents/skills/reviewer/forge-auditor/SKILL.md` | (escrita direta — não convertida) | ✅ |

`forge-auditor` é a skill que **orquestra** a auditoria mensal usando as 9 skills convertidas como contexto. Não tem origem em Claude Code — é nativa Deep Agents.

---

## Como detectar drift

Quando uma skill em `.claude/skills/` mudar, o hash diverge da entrada aqui. **Forge-4** entregará hook `deepagents-resync` que:

1. Recalcula sha256:16 das skills em `.claude/skills/`
2. Compara com `origem sha256:16` deste log
3. Se divergente → re-roda converter automaticamente
4. Atualiza este log + `manifest.json`

Até o hook existir, conversão manual é necessária quando uma skill canônica muda.

---

## Procedimento manual de re-conversão

```bash
# (1) Identificar skill que mudou
git diff master -- .claude/skills/L1/baseline-cost-builder.md

# (2) Reconverter via deepagents (no projeto consumidor com converter instalado)
deepagents -y "Read .claude/skills/L1/baseline-cost-builder.md and convert this \
  Claude Code skill to Deep Agents. Save as \
  reviewer/deepagents/skills/L1/baseline-cost-builder/SKILL.md"

# (3) Atualizar este conversion-log.md com nova entrada datada + hash novo
# (4) Commit nas duas (origem + Deep Agents) no mesmo PR pra rastreabilidade
```
