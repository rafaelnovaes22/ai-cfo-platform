#!/usr/bin/env bash
# Hook: secret-scan
# Detects API keys and connection strings being written to files.

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
  CONTENT=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); ti=d.get('tool_input',{}); print(ti.get('new_string',ti.get('content','')))" \
    2>/dev/null || echo "")
fi

[ -z "$CONTENT" ] && exit 0

# Skip .env.example and template files (they contain placeholders, not real secrets)
if [[ "$FILE_PATH" =~ \.(example|template|sample)$ ]] || [[ "$FILE_PATH" =~ \.env\.example ]]; then
  exit 0
fi

PATTERNS=(
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  'ANTHROPIC_API_KEY=[A-Za-z0-9_-]{10,}'
  'OPENAI_API_KEY=[A-Za-z0-9_-]{10,}'
  'DATABASE_URL=postgresql://[^[:space:]]{10,}'
  'DATABASE_URL=mysql://[^[:space:]]{10,}'
  'LANGFUSE_SECRET_KEY=[A-Za-z0-9_-]{10,}'
  'ghp_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{20,}'
)

for PATTERN in "${PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qE "$PATTERN" 2>/dev/null; then
    if [ -n "${ACME_FORGE_BYPASS:-}" ]; then
      BYPASS_DIR="docs/forge/bypass-log"
      mkdir -p "$BYPASS_DIR"
      LOG="$BYPASS_DIR/$(date +%Y-%m-%d).md"
      [ ! -f "$LOG" ] && printf "# Bypass Log — %s\n\n| Timestamp | Hook | File | Reason |\n|---|---|---|---|\n" "$(date +%Y-%m-%d)" > "$LOG"
      printf "| %s | secret-scan | %s | %s |\n" \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${FILE_PATH:-stdin}" "$ACME_FORGE_BYPASS" >> "$LOG"
      exit 0
    fi
    echo "BLOCKED [secret-scan]: possível secret detectado no conteúdo (padrão: $PATTERN)." >&2
    echo "Use variáveis de ambiente ou .env (gitignored). Nunca hardcode secrets em arquivos." >&2
    exit 2
  fi
done

exit 0
