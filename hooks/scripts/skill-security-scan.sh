#!/usr/bin/env bash
# skill-security-scan.sh
# F4.5 — Escaneia arquivos de skill antes de aceitar PR.
# Uso: bash hooks/scripts/skill-security-scan.sh [--path .claude/skills] [--fail-fast]
#
# Verifica:
#   S1 — Sem hardcode de secrets (API keys, tokens)
#   S2 — Sem URLs externas hardcoded (somente variáveis de ambiente)
#   S3 — Sem comandos destrutivos sem confirmação (rm -rf, DROP TABLE, etc.)
#   S4 — Sem bypass de permissões sem documentação
#   S5 — Frontmatter obrigatório presente (name, description, type ou tier)

SKILL_PATH="${1:-}"
FAIL_FAST=false
SCAN_PATH=".claude/skills"

for arg in "$@"; do
  case "$arg" in
    --path=*) SCAN_PATH="${arg#--path=}" ;;
    --path) shift; SCAN_PATH="$1" ;;
    --fail-fast) FAIL_FAST=true ;;
  esac
done

ERRORS=0
WARNINGS=0

scan_file() {
  local file="$1"
  local file_errors=0

  # S1 — Hardcoded secrets
  if grep -qE '(sk-ant-|sk-[A-Za-z0-9]{20}|ghp_|ANTHROPIC_API_KEY\s*=\s*[^$\{])' "$file" 2>/dev/null; then
    echo "  ❌ S1 FAIL: Possível secret hardcoded em '$file'" >&2
    file_errors=$((file_errors+1))
  fi

  # S2 — URLs externas hardcoded (não de exemplo/doc)
  EXT_URLS=$(grep -E 'https?://[^[:space:]]+' "$file" 2>/dev/null | \
    grep -v 'example\|placeholder\|your-\|TODO\|#\|<!--' | \
    grep -vE 'github\.com/[^/]+/[^/]+$' | head -3 || echo "")
  # Warn only if not in a comment context — simple heuristic
  if [ -n "$EXT_URLS" ]; then
    echo "  ⚠️  S2 WARN: URLs externas em '$file' — verifique se são exemplos ou hardcode:" >&2
    echo "$EXT_URLS" | head -3 >&2
    WARNINGS=$((WARNINGS+1))
  fi

  # S3 — Comandos destrutivos sem confirmação
  DESTRUCTIVE=$(grep -nE '`?\b(rm\s+-rf|DROP\s+TABLE|DELETE\s+FROM|truncate|format\s+/|mkfs)' "$file" 2>/dev/null | head -3 || echo "")
  if [ -n "$DESTRUCTIVE" ]; then
    echo "  ❌ S3 FAIL: Comando destrutivo sem confirmação explícita em '$file':" >&2
    echo "$DESTRUCTIVE" >&2
    file_errors=$((file_errors+1))
  fi

  # S4 — bypass sem documentação
  BYPASS=$(grep -nE 'ACME_FORGE_BYPASS|--force|--no-verify|skipValidation' "$file" 2>/dev/null | \
    grep -v '#\|//\|<!--\|bypass.*doc\|bypass.*log' | head -3 || echo "")
  if [ -n "$BYPASS" ]; then
    echo "  ⚠️  S4 WARN: Referência a bypass sem documentação em '$file':" >&2
    echo "$BYPASS" | head -3 >&2
    WARNINGS=$((WARNINGS+1))
  fi

  # S5 — Frontmatter obrigatório
  if ! head -5 "$file" | grep -q '^---$' 2>/dev/null; then
    echo "  ❌ S5 FAIL: Frontmatter ausente em '$file' (requer --- no início)" >&2
    file_errors=$((file_errors+1))
  elif ! grep -qE '^(name|description|tier|type):' "$file" 2>/dev/null; then
    echo "  ❌ S5 FAIL: Frontmatter incompleto em '$file' (faltam name/description/tier)" >&2
    file_errors=$((file_errors+1))
  fi

  ERRORS=$((ERRORS+file_errors))
  return $file_errors
}

echo "=== skill-security-scan — $SCAN_PATH ==="

# Find all skill files (SKILL.md or *.md in skills path)
while IFS= read -r -d '' file; do
  echo "Scanning: $file"
  scan_file "$file"
  if [ "$FAIL_FAST" = "true" ] && [ "$ERRORS" -gt 0 ]; then
    echo "FAIL_FAST: abortando na primeira falha."
    break
  fi
done < <(find "$SCAN_PATH" -type f \( -name "*.md" -o -name "SKILL.md" \) -print0 2>/dev/null)

echo ""
echo "Resultado: $ERRORS erros, $WARNINGS avisos"

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL — corrija os erros antes de aceitar o PR."
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "PASS com $WARNINGS aviso(s) — revisar."
  exit 0
fi

echo "PASS — nenhum problema encontrado."
exit 0
