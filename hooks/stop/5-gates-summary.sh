#!/usr/bin/env bash
# Hook: 5-gates-summary
# At session end, generates a quick Foundry gate health report for the current branch.

_get_ai_enabled() {
  if [ -f "docs/foundry/project.json" ]; then
    if command -v jq &>/dev/null; then
      jq -r '.project.ai_enabled // true' docs/foundry/project.json 2>/dev/null || echo "true"
    else
      python3 -c "import json; d=json.load(open('docs/foundry/project.json')); print(str(d.get('project',{}).get('ai_enabled',True)).lower())" 2>/dev/null || echo "true"
    fi
  else
    echo "true"
  fi
}

AI_ENABLED=$(_get_ai_enabled)

REPORT_DIR="docs/foundry/session-gate-reports"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/$(date +%Y-%m-%dT%H-%M-%S).md"

PASS=0
FAIL=0
WARN=0
LINES=()

# G1 — manifest.json é JSON válido
if node -e "JSON.parse(require('fs').readFileSync('docs/foundry/manifest.json','utf8'))" 2>/dev/null; then
  LINES+=("| G1 | manifest.json válido | ✅ PASS |")
  PASS=$((PASS+1))
else
  LINES+=("| G1 | manifest.json válido | ❌ FAIL — JSON inválido |")
  FAIL=$((FAIL+1))
fi

# G2 — sem `any` em src/skus/** e src/agents/**
if [ -d "src" ]; then
  ANY_COUNT=$(grep -rE ':\s*any(\[\]|[^A-Za-z]|$)|\bas\s+any\b' \
    --include="*.ts" src/skus/ src/agents/ 2>/dev/null | grep -vc '^\s*//' || echo "0")
  if [ "$ANY_COUNT" -eq "0" ]; then
    LINES+=("| G2 | Zero 'any' em src/skus + src/agents | ✅ PASS |")
    PASS=$((PASS+1))
  else
    LINES+=("| G2 | Zero 'any' em src/skus + src/agents | ❌ FAIL — $ANY_COUNT ocorrências |")
    FAIL=$((FAIL+1))
  fi
else
  LINES+=("| G2 | Zero 'any' em src/skus + src/agents | ⏭ SKIP — src/ não existe |")
  WARN=$((WARN+1))
fi

# G3 — evals ≥ 30 casos por SKU (agentic) OU pilot-state.md presente por módulo (platform)
if [ "$AI_ENABLED" = "false" ]; then
  # Platform: check pilot-state.md exists for modules in PILOT/CANONICAL
  if [ -d "docs/modules" ]; then
    MISSING_STATES=""
    for mod_dir in docs/modules/*/; do
      [ -d "$mod_dir" ] || continue
      MOD=$(basename "$mod_dir")
      if [ ! -f "${mod_dir}pilot-state.md" ]; then
        MISSING_STATES="$MISSING_STATES $MOD"
      fi
    done
    if [ -z "$MISSING_STATES" ]; then
      LINES+=("| G3 | pilot-state.md presente por módulo | ✅ PASS |")
      PASS=$((PASS+1))
    else
      LINES+=("| G3 | pilot-state.md presente por módulo | ⚠️ WARN — faltando:$MISSING_STATES |")
      WARN=$((WARN+1))
    fi
  else
    LINES+=("| G3 | pilot-state.md por módulo | ⏭ SKIP — docs/modules/ não existe |")
    WARN=$((WARN+1))
  fi
elif [ -d "evals" ]; then
  LOW_EVALS=""
  for eval_dir in evals/*/cases/; do
    [ -d "$eval_dir" ] || continue
    COUNT=$(find "$eval_dir" -name "*.json" -o -name "*.yaml" -o -name "*.yml" 2>/dev/null | wc -l)
    if [ "$COUNT" -lt 30 ]; then
      LOW_EVALS="$LOW_EVALS $(dirname "$eval_dir"):${COUNT}"
    fi
  done
  if [ -z "$LOW_EVALS" ]; then
    LINES+=("| G3 | Eval suites ≥ 30 casos | ✅ PASS |")
    PASS=$((PASS+1))
  else
    LINES+=("| G3 | Eval suites ≥ 30 casos | ⚠️ WARN —$LOW_EVALS |")
    WARN=$((WARN+1))
  fi
else
  LINES+=("| G3 | Eval suites ≥ 30 casos | ⏭ SKIP — evals/ não existe |")
  WARN=$((WARN+1))
fi

# G4 — sem secrets em arquivos staged
STAGED=$(git diff --staged --name-only 2>/dev/null || echo "")
SECRET_FOUND=""
if [ -n "$STAGED" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -qE 'sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|ANTHROPIC_API_KEY=.{10,}|OPENAI_API_KEY=.{10,}' "$f" 2>/dev/null; then
      SECRET_FOUND="$SECRET_FOUND $f"
    fi
  done <<< "$STAGED"
fi
if [ -z "$SECRET_FOUND" ]; then
  LINES+=("| G4 | Sem secrets em staged files | ✅ PASS |")
  PASS=$((PASS+1))
else
  LINES+=("| G4 | Sem secrets em staged files | ❌ FAIL —$SECRET_FOUND |")
  FAIL=$((FAIL+1))
fi

# G5 — ADRs alteradas no branch têm aprovação
ADR_CHANGED=$(git diff main...HEAD --name-only 2>/dev/null | grep 'docs/adr/' || echo "")
ADR_UNSIGNED=""
if [ -n "$ADR_CHANGED" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -qE "^## Aprovação" "$f" 2>/dev/null; then
      if ! grep -qE "^\*\*Aprovado por\*\*:[^{?T]" "$f" 2>/dev/null; then
        ADR_UNSIGNED="$ADR_UNSIGNED $f"
      fi
    fi
  done <<< "$ADR_CHANGED"
fi
if [ -z "$ADR_UNSIGNED" ]; then
  LINES+=("| G5 | ADRs alteradas com aprovação | ✅ PASS |")
  PASS=$((PASS+1))
else
  LINES+=("| G5 | ADRs alteradas com aprovação | ⚠️ WARN — não aprovadas:$ADR_UNSIGNED |")
  WARN=$((WARN+1))
fi

# Write report
{
  printf "# Foundry Gate Report — %s\n\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf "Branch: %s\n\n" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  printf "| Gate | Check | Status |\n|---|---|---|\n"
  for line in "${LINES[@]}"; do
    echo "$line"
  done
  printf "\n**Resultado**: %d PASS / %d WARN / %d FAIL\n" "$PASS" "$WARN" "$FAIL"
} > "$REPORT"

# Print summary to stdout (shown in session)
echo ""
echo "=== Foundry Gate Report ==="
for line in "${LINES[@]}"; do
  echo "$line"
done
printf "Resultado: %d PASS / %d WARN / %d FAIL\n" "$PASS" "$WARN" "$FAIL"
printf "Relatório completo: %s\n" "$REPORT"

[ "$FAIL" -gt "0" ] && exit 1
exit 0
