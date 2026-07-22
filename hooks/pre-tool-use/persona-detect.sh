#!/usr/bin/env bash
# Novais Digital Foundry — persona-detect.sh (PreToolUse, one-shot, LGPD-safe)
#
# OBJETIVO: detectar persona do operador (vibe/dev/agent) na PRIMEIRA invocação
# e gravar `.foundry-mode` para que outros hooks (friendly-errors, foundry-router)
# adaptem a saída.
#
# LGPD/GDPR: NUNCA lê conteúdo de prompts, arquivos do usuário ou histórico shell.
# APENAS sinais de filesystem (presença/ausência de paths) e ambiente (TTY).
# Logs apenas metadata (não strings de input).
#
# COMPORTAMENTO:
#   - Se `.foundry-mode` já existe → exit 0 imediato (no-op idempotente).
#   - Caso contrário, detecta persona, grava `.foundry-mode`, e loga decisão
#     em `docs/foundry/persona-detection.log` para auditabilidade.
#   - Hook é one-shot por consumidor — após primeira detecção nunca reroda.
#
# OVERRIDE: operador pode rodar `bash scripts/foundry mode <vibe|dev|agent>` a
# qualquer momento para sobrescrever.
#
# Princípios: C6 (auditável via log), C7 (sem hardcode de provider),
#             C8 (config por filesystem, não por código por cliente)

set -euo pipefail

MODE_FILE=".foundry-mode"

# Idempotência: se já existe, no-op
if [[ -f "$MODE_FILE" ]]; then
  exit 0
fi

# Guard: no canônico do Foundry (mantenedor) persona-detect não faz sentido
# — sempre roda como mantenedor, não como persona de consumer.
if [[ -f "docs/foundry/manifest.json" ]] && command -v node >/dev/null 2>&1; then
  if node -e "
    const m=JSON.parse(require('fs').readFileSync('docs/foundry/manifest.json','utf8'));
    process.exit(m.framework && m.framework.canonical===true ? 0 : 1);
  " 2>/dev/null; then
    # Estamos no canônico — pular detecção
    exit 0
  fi
fi

# ─── Sinais ──────────────────────────────────────────────────────────
# Todos são sinais de METADATA (presença/ausência/contagem) — nunca conteúdo.

SIGNAL_TTY="false"
[[ -t 0 ]] && SIGNAL_TTY="true"

SIGNAL_HAS_SRC="false"
[[ -d "src" ]] && SIGNAL_HAS_SRC="true"

SIGNAL_HAS_PACKAGE_JSON="false"
[[ -f "package.json" ]] && SIGNAL_HAS_PACKAGE_JSON="true"

SIGNAL_HAS_TESTS="false"
[[ -d "tests" || -d "__tests__" || -d "test" ]] && SIGNAL_HAS_TESTS="true"

SIGNAL_HAS_GIT="false"
[[ -d ".git" ]] && SIGNAL_HAS_GIT="true"

SIGNAL_HAS_CLIENTS="false"
[[ -d "docs/clients" ]] && SIGNAL_HAS_CLIENTS="true"

# Project signal (declarado no project.json se existir)
SIGNAL_NON_TECH_STAKEHOLDER="unknown"
if [[ -f "docs/foundry/project.json" ]] && command -v node >/dev/null 2>&1; then
  SIGNAL_NON_TECH_STAKEHOLDER=$(node -e "
    try {
      const p=JSON.parse(require('fs').readFileSync('docs/foundry/project.json','utf8'));
      const v=p.team && p.team.has_non_technical_stakeholder;
      console.log(v===true?'true':v===false?'false':'unknown');
    } catch(e) { console.log('unknown'); }
  " 2>/dev/null || echo "unknown")
fi

# ─── Heurística de classificação ─────────────────────────────────────
# Ordem de precedência: agent > vibe > dev (default)

CONFIDENCE="medium"
DETECTED_MODE="dev"
RATIONALE="default fallback"

# Regra 1: não-TTY = agent (CI, API, etc.)
if [[ "$SIGNAL_TTY" == "false" ]]; then
  DETECTED_MODE="agent"
  CONFIDENCE="high"
  RATIONALE="non-TTY invocation (provavelmente CI ou API)"

# Regra 2: stakeholder não-técnico declarado em project.json
elif [[ "$SIGNAL_NON_TECH_STAKEHOLDER" == "true" ]]; then
  DETECTED_MODE="vibe"
  CONFIDENCE="high"
  RATIONALE="project.json declara team.has_non_technical_stakeholder=true"

# Regra 3: filesystem com sinais técnicos fortes (src + package + tests + git)
elif [[ "$SIGNAL_HAS_SRC" == "true" && "$SIGNAL_HAS_PACKAGE_JSON" == "true" && "$SIGNAL_HAS_GIT" == "true" ]]; then
  DETECTED_MODE="dev"
  CONFIDENCE="high"
  RATIONALE="src/ + package.json + .git/ presentes (projeto de código maduro)"

# Regra 4: docs/clients existe e src/ ausente → pode ser CEO/decisor fazendo diagnose
elif [[ "$SIGNAL_HAS_CLIENTS" == "true" && "$SIGNAL_HAS_SRC" == "false" ]]; then
  DETECTED_MODE="vibe"
  CONFIDENCE="medium"
  RATIONALE="docs/clients/ presente sem src/ (perfil de diagnóstico/comercial)"

# Regra 5: filesystem mínimo (nem src/ nem clients/) → dev cauteloso
elif [[ "$SIGNAL_HAS_SRC" == "false" && "$SIGNAL_HAS_CLIENTS" == "false" ]]; then
  DETECTED_MODE="dev"
  CONFIDENCE="low"
  RATIONALE="filesystem mínimo — fallback dev (override via 'foundry mode' se incorreto)"

else
  DETECTED_MODE="dev"
  CONFIDENCE="medium"
  RATIONALE="combinação intermediária de sinais — fallback dev seguro"
fi

# ─── Escrita do .foundry-mode ──────────────────────────────────────────
echo "$DETECTED_MODE" > "$MODE_FILE"

# ─── Log auditável ───────────────────────────────────────────────────
mkdir -p docs/foundry
LOG="docs/foundry/persona-detection.log"
{
  printf '[%s] detected=%s confidence=%s rationale="%s"\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$DETECTED_MODE" \
    "$CONFIDENCE" \
    "$RATIONALE"
  printf '  signals: tty=%s src=%s package_json=%s tests=%s git=%s clients=%s non_tech_stakeholder=%s\n\n' \
    "$SIGNAL_TTY" "$SIGNAL_HAS_SRC" "$SIGNAL_HAS_PACKAGE_JSON" \
    "$SIGNAL_HAS_TESTS" "$SIGNAL_HAS_GIT" "$SIGNAL_HAS_CLIENTS" \
    "$SIGNAL_NON_TECH_STAKEHOLDER"
} >> "$LOG"

# ─── Stdout discreto (não polui sessão) ──────────────────────────────
# Apenas em TTY interativo e apenas na primeira detecção, mostra um aviso curto
if [[ "$SIGNAL_TTY" == "true" ]]; then
  printf '💡 Foundry detectou modo "%s" (confiança: %s). Override: bash scripts/foundry mode <vibe|dev|agent>\n' \
    "$DETECTED_MODE" "$CONFIDENCE" >&2
fi

exit 0
