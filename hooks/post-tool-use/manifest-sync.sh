#!/usr/bin/env bash
# Hook: manifest-sync
# Warns when framework artifacts change and manifest.json needs updating.

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
  TOOL=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0

# Skip manifest.json itself to avoid loops
[[ "$FILE_PATH" =~ docs/forge/manifest\.json$ ]] && exit 0

# Guard framework artifact paths
NEEDS_SYNC=false
if [[ "$FILE_PATH" =~ ^\.claude/(skills|commands|agents)/ ]] || \
   [[ "$FILE_PATH" =~ ^docs/forge/ ]] || \
   [[ "$FILE_PATH" =~ ^templates/ ]] || \
   [[ "$FILE_PATH" =~ ^reviewer/deepagents/skills/ ]] || \
   [[ "$FILE_PATH" =~ ^evals/ ]]; then
  NEEDS_SYNC=true
fi

if [ "$NEEDS_SYNC" = "true" ]; then
  # Only warn if this looks like a new file (Write tool) or meaningful change
  if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
    echo "INFO [manifest-sync]: artefato Forge alterado — '$FILE_PATH'." >&2
    echo "Lembre de atualizar docs/forge/manifest.json (path, version, sha256, description)." >&2
    echo "Hash: sha256sum '$FILE_PATH' | cut -c1-16" >&2
    # Exit 0 = just inform, do not block or warn
  fi
fi

exit 0
