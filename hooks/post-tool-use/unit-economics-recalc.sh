#!/usr/bin/env bash
# Hook: unit-economics-recalc
# Warns when prompt files change and unit-economics recalc is needed (C3).

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0

# Guard prompt files
if [[ "$FILE_PATH" =~ src/skus/[^/]+/prompts/.+\.(ts|js|txt|md)$ ]] || \
   [[ "$FILE_PATH" =~ prompts/.+\.(ts|js|txt|md)$ ]]; then

  echo "WARN [unit-economics-recalc]: prompt alterado em '$FILE_PATH'." >&2
  echo "Recalcule unit economics: /acme:unit-economics --recalc (C3 — custo ≤ 25% do preço)." >&2
  echo "O prompt_hash também mudou — atualize artifact-prompt-builder se necessário." >&2
  exit 1
fi

exit 0
