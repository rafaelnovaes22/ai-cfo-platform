#!/usr/bin/env bash
# Hook: adr-approval-gate
# Blocks edits to ADRs that have been signed/approved without ACME_FORGE_BYPASS.

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0

# Only guard ADR files
if [[ "$FILE_PATH" =~ docs/adr/.+\.md$ ]]; then
  if [ -f "$FILE_PATH" ]; then
    # Signed ADR: "## Aprovação" section has a name filled in (not a placeholder)
    # Check for approved status OR a filled Aprovado por line
    if grep -qE "^## Aprovação" "$FILE_PATH" 2>/dev/null; then
      APPROVED_LINE=$(grep -E "^\*\*Aprovado por\*\*:" "$FILE_PATH" 2>/dev/null || echo "")
      if [ -n "$APPROVED_LINE" ] && ! echo "$APPROVED_LINE" | grep -qE "\{\{|\?\?|TBD|pendente" 2>/dev/null; then
        if [ -n "${ACME_FORGE_BYPASS:-}" ]; then
          BYPASS_DIR="docs/forge/bypass-log"
          mkdir -p "$BYPASS_DIR"
          LOG="$BYPASS_DIR/$(date +%Y-%m-%d).md"
          [ ! -f "$LOG" ] && printf "# Bypass Log — %s\n\n| Timestamp | Hook | File | Reason |\n|---|---|---|---|\n" "$(date +%Y-%m-%d)" > "$LOG"
          printf "| %s | adr-approval-gate | %s | %s |\n" \
            "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE_PATH" "$ACME_FORGE_BYPASS" >> "$LOG"
          exit 0
        fi
        echo "BLOCKED [adr-approval-gate]: '$FILE_PATH' é uma ADR assinada e não pode ser editada." >&2
        echo "Para override: ACME_FORGE_BYPASS=<motivo> em settings.local.json." >&2
        exit 2
      fi
    fi
  fi
fi

exit 0
