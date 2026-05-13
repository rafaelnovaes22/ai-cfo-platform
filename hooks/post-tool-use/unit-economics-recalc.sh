#!/usr/bin/env bash
# Hook: unit-economics-recalc
# Warns when prompt files change and unit-economics recalc is needed (C3).
# When ai_enabled=false (platform), warns instead on delivery-economics file changes.

_get_ai_enabled() {
  if [ -f "docs/forge/project.json" ]; then
    if command -v jq &>/dev/null; then
      jq -r '.project.ai_enabled // true' docs/forge/project.json 2>/dev/null || echo "true"
    else
      python3 -c "import json; d=json.load(open('docs/forge/project.json')); print(str(d.get('project',{}).get('ai_enabled',True)).lower())" 2>/dev/null || echo "true"
    fi
  else
    echo "true"
  fi
}

AI_ENABLED=$(_get_ai_enabled)

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0

if [ "$AI_ENABLED" = "false" ]; then
  # Platform project: warn when infra/service costs change (delivery-economics recalc needed)
  if [[ "$FILE_PATH" =~ docs/modules/[^/]+/(infra|costs|services)\.(md|yaml|json)$ ]] || \
     [[ "$FILE_PATH" =~ docs/clients/[^/]+/delivery-economics-.+\.md$ ]]; then
    echo "WARN [unit-economics-recalc]: custo de plataforma alterado em '$FILE_PATH'." >&2
    echo "Recalcule delivery economics: /acme:unit-economics --recalc --type=platform (C3 — platform_margin ≤ 25%)." >&2
    exit 1
  fi
  exit 0
fi

# Agentic project: guard prompt files (inference cost change)
if [[ "$FILE_PATH" =~ src/skus/[^/]+/prompts/.+\.(ts|js|txt|md)$ ]] || \
   [[ "$FILE_PATH" =~ prompts/.+\.(ts|js|txt|md)$ ]]; then

  echo "WARN [unit-economics-recalc]: prompt alterado em '$FILE_PATH'." >&2
  echo "Recalcule unit economics: /acme:unit-economics --recalc (C3 — custo ≤ 25% do preço)." >&2
  echo "O prompt_hash também mudou — atualize artifact-prompt-builder se necessário." >&2
  exit 1
fi

exit 0
