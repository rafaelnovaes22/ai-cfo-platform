#!/usr/bin/env bash
# Hook: outcome-clause-guard
# Blocks edits to approved outcome clauses (D2.1-D2.5) without ACME_FORGE_BYPASS.

INPUT=$(cat)

# Parse file_path
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0

# Only guard docs/onda-*, docs/clients/*/sku_*.md and similar outcome spec files
if [[ "$FILE_PATH" =~ docs/(onda-[0-9]+|clients/[^/]+)/.+\.md$ ]]; then
  if [ -f "$FILE_PATH" ] && grep -qiE "^(approved|status):\s*(true|approved|signed)" "$FILE_PATH" 2>/dev/null; then
    if [ -n "${ACME_FORGE_BYPASS:-}" ]; then
      BYPASS_DIR="docs/forge/bypass-log"
      mkdir -p "$BYPASS_DIR"
      LOG="$BYPASS_DIR/$(date +%Y-%m-%d).md"
      [ ! -f "$LOG" ] && printf "# Bypass Log — %s\n\n| Timestamp | Hook | File | Reason |\n|---|---|---|---|\n" "$(date +%Y-%m-%d)" > "$LOG"
      printf "| %s | outcome-clause-guard | %s | %s |\n" \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$ACME_FORGE_BYPASS" >> "$LOG"
      exit 0
    fi
    echo "BLOCKED [outcome-clause-guard]: '$FILE_PATH' contém cláusula de outcome aprovada." >&2
    echo "Para editar: defina ACME_FORGE_BYPASS=<motivo> em settings.local.json ou no ambiente." >&2
    exit 2
  fi
fi

exit 0
