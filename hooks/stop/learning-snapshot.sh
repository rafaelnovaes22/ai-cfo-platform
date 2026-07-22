#!/usr/bin/env bash
# Novais Digital Foundry — learning-snapshot hook (Stop)
# Captura aprendizados ao fim de cada sessão Claude Code (local ou headless GH Actions).
# Produz: docs/learnings/{YYYY-MM}/{session-id}.md
#
# Princípios: C1 (linkado a artifact real), C6 (source_run_id + trace), C7 (agnóstico), C8 (sem tenant hardcode)
# Integração: Foundry-20 (self-harness loop — Hermes Codex consome estes snapshots via webhook callback)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# ─── IDs e paths ─────────────────────────────────────────────────────
SESSION_ID="$(date +%Y%m%dT%H%M%S)-$$"
MONTH="$(date +%Y-%m)"
LEARNING_DIR="docs/learnings/$MONTH"
mkdir -p "$LEARNING_DIR"
OUTPUT="$LEARNING_DIR/$SESSION_ID.md"

# Metadata de contexto
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_ID="${GITHUB_RUN_ID:-local}"
CONSUMER="${FOUNDRY_CONSUMER:-$(basename "$REPO_ROOT")}"
COMMAND="${FOUNDRY_COMMAND:-unknown}"
EXIT_CODE="${FOUNDRY_EXIT_CODE:-0}"
TRACE_ID="${LANGFUSE_TRACE_ID:-local}"
CONFIDENCE="local"

# Detectar se rodou em SHADOW/AUTONOMOUS (muda confiança do learning)
if [[ -f "docs/foundry/project.json" ]] && command -v node >/dev/null 2>&1; then
  STAGE=$(node -e "const m=JSON.parse(require('fs').readFileSync('docs/foundry/project.json','utf8')); console.log(m.lifecycle_stage||'unknown')" 2>/dev/null || echo "unknown")
  case "$STAGE" in
    SHADOW)     CONFIDENCE="shadow" ;;
    ASSISTED)   CONFIDENCE="assisted" ;;
    AUTONOMOUS) CONFIDENCE="autonomous" ;;
    CANONICAL)  CONFIDENCE="canonical" ;;
    *)          CONFIDENCE="local" ;;
  esac
fi

# ─── Ler gate report mais recente ────────────────────────────────────
GATE_SUMMARY=""
GATE_REPORT_DIR="docs/foundry/session-gate-reports"
if [[ -d "$GATE_REPORT_DIR" ]]; then
  LATEST_GATE=$(ls -t "$GATE_REPORT_DIR"/*.md 2>/dev/null | head -1)
  if [[ -n "$LATEST_GATE" ]]; then
    GATE_SUMMARY=$(cat "$LATEST_GATE" 2>/dev/null | head -30)
  fi
fi

# ─── Ler shadow-status se existir ────────────────────────────────────
SHADOW_SUMMARY=""
SHADOW_FILES=$(find "runs" -name "shadow-status.md" 2>/dev/null | head -3)
if [[ -n "$SHADOW_FILES" ]]; then
  for f in $SHADOW_FILES; do
    SHADOW_SUMMARY="$SHADOW_SUMMARY
--- $f ---
$(head -20 "$f" 2>/dev/null)"
  done
fi

# ─── Verificar se há diagnostic.md (C1: learning vinculado a client real) ─
CLIENT_ID=""
DIAGNOSTIC_REF="none"
if [[ -d "docs/clients" ]]; then
  LATEST_DIAG=$(find "docs/clients" -name "diagnostic.md" -newer "$GATE_REPORT_DIR" 2>/dev/null | head -1 || \
                find "docs/clients" -name "diagnostic.md" 2>/dev/null | head -1)
  if [[ -n "$LATEST_DIAG" ]]; then
    CLIENT_ID=$(echo "$LATEST_DIAG" | sed 's|docs/clients/||;s|/.*||')
    DIAGNOSTIC_REF="$LATEST_DIAG"
  fi
fi

# C8 guard: se nenhum diagnostic, marcar como internal (não conta como client learning)
if [[ -z "$CLIENT_ID" ]]; then
  DIAGNOSTIC_REF="none"
  IS_INTERNAL="true"
else
  IS_INTERNAL="false"
fi

# ─── Escrita do snapshot ──────────────────────────────────────────────
cat > "$OUTPUT" << SNAPSHOT_EOF
---
session_id: ${SESSION_ID}
timestamp: ${TIMESTAMP}
run_id: ${RUN_ID}
consumer: ${CONSUMER}
command: ${COMMAND}
exit_code: ${EXIT_CODE}
confidence: ${CONFIDENCE}
source_trace_id: ${TRACE_ID}
client_id: ${CLIENT_ID:-none}
source_diagnostic: ${DIAGNOSTIC_REF}
is_internal: ${IS_INTERNAL}
tokens_used: "~"
cost_estimate: "~"
proposed_memory_update: false
---

# Learning Snapshot — ${SESSION_ID}

> Gerado automaticamente por \`hooks/stop/learning-snapshot.sh\`. Revisão humana/Hermes antes de persistir em \`agent-memory.md\`.

## Contexto da sessão

- **Consumer**: ${CONSUMER}
- **Comando**: ${COMMAND}
- **Exit code**: ${EXIT_CODE}
- **Lifecycle stage**: ${CONFIDENCE}
- **Client**: ${CLIENT_ID:-não identificado (is_internal=true)}

## Gate summary (última sessão)

\`\`\`
${GATE_SUMMARY:-nenhum gate report encontrado nesta sessão}
\`\`\`

## Shadow status (se disponível)

\`\`\`
${SHADOW_SUMMARY:-nenhum shadow-status encontrado}
\`\`\`

## Novos padrões detectados

<!-- Preencher por Hermes/Codex após análise do output NDJSON -->
<!-- Formato: § [confidence] [data] [run:id] Descrição do padrão -->

## Pitfalls encontrados

<!-- Preencher por Hermes/Codex após análise de gates FAIL/WARN -->
<!-- Exemplo: § [confidence:local] [${TIMESTAMP:0:10}] [run:${RUN_ID}] Gate G3 falhou — eval suite abaixo de 30 casos -->

## Sugestão para agent-memory.md

<!-- Hermes propõe patch ao agent-memory.md do consumer baseado neste snapshot -->
<!-- NÃO hardcodar por tenant — usar formato § genérico e portável (C8) -->

## Decisão "should persist?"

- [ ] Sim — propor PR com patch ao \`docs/clients/${CLIENT_ID:-{client_id}}/agent-memory.md\`
- [ ] Sim parcial — adicionar a \`docs/clients/${CLIENT_ID:-{client_id}}/learned-skills/\`
- [ ] Não — snapshot mantido como audit trail mas sem propagação
SNAPSHOT_EOF

# Output para Claude Code (formato JSON esperado pelo hook Stop)
echo "{\"priority\": \"INFO\", \"message\": \"Learning snapshot salvo: $OUTPUT (confidence=$CONFIDENCE, client=${CLIENT_ID:-none})\"}"
