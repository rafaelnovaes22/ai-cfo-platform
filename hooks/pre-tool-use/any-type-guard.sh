#!/usr/bin/env bash
# Hook: any-type-guard
# Blocks TypeScript `any` type usage in src/skus/** and src/agents/**.

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

[ -z "$FILE_PATH" ] && exit 0
[ -z "$CONTENT" ] && exit 0

# Only guard TypeScript files in protected paths
if [[ "$FILE_PATH" =~ src/(skus|agents)/.+\.ts$ ]]; then
  # Detect: ': any', ': any[]', ': any |', 'as any', '<any>', '(any)'
  # Exclude commented lines
  VIOLATIONS=$(echo "$CONTENT" | grep -vE '^\s*//' | grep -E ':\s*any(\[\]|[^A-Za-z]|$)|\bas\s+any\b|<any>|\(any\)' | head -5)
  if [ -n "$VIOLATIONS" ]; then
    if [ -n "${ACME_FORGE_BYPASS:-}" ]; then
      BYPASS_DIR="docs/forge/bypass-log"
      mkdir -p "$BYPASS_DIR"
      LOG="$BYPASS_DIR/$(date +%Y-%m-%d).md"
      [ ! -f "$LOG" ] && printf "# Bypass Log — %s\n\n| Timestamp | Hook | File | Reason |\n|---|---|---|---|\n" "$(date +%Y-%m-%d)" > "$LOG"
      printf "| %s | any-type-guard | %s | %s |\n" \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$ACME_FORGE_BYPASS" >> "$LOG"
      exit 0
    fi
    echo "BLOCKED [any-type-guard]: uso de 'any' detectado em '$FILE_PATH' (viola C7/C8)." >&2
    echo "Violações encontradas:" >&2
    echo "$VIOLATIONS" >&2
    echo "Use tipos explícitos ou 'unknown'. Para override: ACME_FORGE_BYPASS=<motivo>." >&2
    exit 2
  fi
fi

exit 0
