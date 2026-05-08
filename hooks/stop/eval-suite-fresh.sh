#!/usr/bin/env bash
# Hook: eval-suite-fresh
# Warns at session end if any eval suite has fewer than 30 cases (C4 requires ≥ 30/category).

[ ! -d "evals" ] && exit 0

BELOW_THRESHOLD=false
THRESHOLD=30

while IFS= read -r -d '' eval_dir; do
  SKU=$(basename "$(dirname "$eval_dir")")
  COUNT=$(find "$eval_dir" -type f \( -name "*.json" -o -name "*.yaml" -o -name "*.yml" \) 2>/dev/null | wc -l)
  if [ "$COUNT" -lt "$THRESHOLD" ]; then
    echo "WARN [eval-suite-fresh]: $SKU/cases/ tem $COUNT casos (mínimo C4: $THRESHOLD por categoria)." >&2
    BELOW_THRESHOLD=true
  fi
done < <(find evals -type d -name "cases" -print0 2>/dev/null)

if [ "$BELOW_THRESHOLD" = "true" ]; then
  echo "Execute /acme:eval para adicionar casos faltantes antes de promover." >&2
  exit 1
fi

exit 0
