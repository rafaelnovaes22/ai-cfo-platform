#!/bin/bash
# Acme Forge — SessionStart hook
# Injects Forge meta-skill + project context + agent soul/memory into every new session.
# Adapted from agent-skills/hooks/session-start.sh by addyosmani.
# Forge-20: carrega agent-soul.md e agent-memory.md de docs/clients/{id}/ (self-harness loop).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
META_SKILL="$REPO_ROOT/.claude/skills/L0/using-forge.md"
MANIFEST="$REPO_ROOT/docs/forge/manifest.json"
PROJECT_JSON="$REPO_ROOT/docs/forge/project.json"
CLIENTS_DIR="$REPO_ROOT/docs/clients"

if ! command -v jq >/dev/null 2>&1; then
  jq() {
    python3 -c "
import sys, json
data = json.load(open('$MANIFEST'))
print(data.get('framework', {}).get('version', 'unknown'))
" 2>/dev/null || echo "unknown"
  }
  FORGE_VERSION=$(jq 2>/dev/null || echo "unknown")
  echo "{\"priority\": \"INFO\", \"message\": \"Acme Forge v$FORGE_VERSION loaded. Install jq for full context injection.\"}"
  exit 0
fi

# Read framework version from manifest
FORGE_VERSION="unknown"
if [ -f "$MANIFEST" ]; then
  FORGE_VERSION=$(jq -r '.framework.version // "unknown"' "$MANIFEST" 2>/dev/null)
fi

# Read project context if available (consumer project)
PROJECT_TYPE="unknown"
AI_ENABLED="unknown"
LIFECYCLE_STAGE="unknown"
ACTIVE_ARTIFACTS=0

if [ -f "$PROJECT_JSON" ]; then
  PROJECT_TYPE=$(jq -r '.project_type // "unknown"' "$PROJECT_JSON" 2>/dev/null)
  AI_ENABLED=$(jq -r '.ai_enabled // "unknown"' "$PROJECT_JSON" 2>/dev/null)
  LIFECYCLE_STAGE=$(jq -r '.lifecycle_stage // "unknown"' "$PROJECT_JSON" 2>/dev/null)
  ACTIVE_ARTIFACTS=$(jq -r '.artifacts | length // 0' "$PROJECT_JSON" 2>/dev/null)
fi

# ─── Agent soul + memory (Forge-20 self-harness) ─────────────────────
SOUL_CONTENT=""
MEMORY_CONTENT=""
SOUL_CLIENT=""

if [ -d "$CLIENTS_DIR" ]; then
  # Encontrar o agent-soul.md mais recente (assume projeto com um único client ativo)
  SOUL_FILE=$(find "$CLIENTS_DIR" -name "agent-soul.md" 2>/dev/null | head -1)
  if [ -n "$SOUL_FILE" ]; then
    SOUL_CLIENT=$(echo "$SOUL_FILE" | sed "s|$CLIENTS_DIR/||;s|/.*||")
    SOUL_CONTENT=$(cat "$SOUL_FILE" 2>/dev/null)
  fi

  MEMORY_FILE=$(find "$CLIENTS_DIR" -name "agent-memory.md" 2>/dev/null | head -1)
  if [ -n "$MEMORY_FILE" ]; then
    MEMORY_CONTENT=$(cat "$MEMORY_FILE" 2>/dev/null)
  fi
fi

# ─── Build context header ─────────────────────────────────────────────
CONTEXT_HEADER="Acme Forge v$FORGE_VERSION loaded."

if [ "$PROJECT_TYPE" != "unknown" ]; then
  CONTEXT_HEADER="$CONTEXT_HEADER
Project: type=$PROJECT_TYPE | ai_enabled=$AI_ENABLED | stage=$LIFECYCLE_STAGE | artifacts=$ACTIVE_ARTIFACTS"
fi

if [ -n "$SOUL_CLIENT" ]; then
  CONTEXT_HEADER="$CONTEXT_HEADER
Agent identity: client=$SOUL_CLIENT (soul+memory loaded)"
fi

# ─── Assemble full message ────────────────────────────────────────────
FULL_MESSAGE="$CONTEXT_HEADER"

if [ -f "$META_SKILL" ]; then
  META_CONTENT=$(cat "$META_SKILL")
  FULL_MESSAGE="$FULL_MESSAGE

$META_CONTENT"
else
  FULL_MESSAGE="$FULL_MESSAGE

Meta-skill using-forge.md not found at .claude/skills/L0/using-forge.md.
Skills still available individually via @skill-name."
fi

if [ -n "$SOUL_CONTENT" ]; then
  FULL_MESSAGE="$FULL_MESSAGE

---
## Agent Soul (${SOUL_CLIENT})

$SOUL_CONTENT"
fi

if [ -n "$MEMORY_CONTENT" ]; then
  FULL_MESSAGE="$FULL_MESSAGE

---
## Agent Memory (${SOUL_CLIENT})

$MEMORY_CONTENT"
fi

jq -cn \
  --arg message "$FULL_MESSAGE" \
  '{priority: "IMPORTANT", message: $message}'
