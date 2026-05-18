#!/bin/bash
# Acme Forge — SessionStart hook
# Injects Forge meta-skill + project context into every new session.
# Adapted from agent-skills/hooks/session-start.sh by addyosmani.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
META_SKILL="$REPO_ROOT/.claude/skills/L0/using-forge.md"
MANIFEST="$REPO_ROOT/docs/forge/manifest.json"
PROJECT_JSON="$REPO_ROOT/docs/forge/project.json"

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

# Build context header
CONTEXT_HEADER="Acme Forge v$FORGE_VERSION loaded."

if [ "$PROJECT_TYPE" != "unknown" ]; then
  CONTEXT_HEADER="$CONTEXT_HEADER
Project: type=$PROJECT_TYPE | ai_enabled=$AI_ENABLED | stage=$LIFECYCLE_STAGE | artifacts=$ACTIVE_ARTIFACTS"
fi

# Inject meta-skill content
if [ -f "$META_SKILL" ]; then
  META_CONTENT=$(cat "$META_SKILL")
  jq -cn \
    --arg message "$CONTEXT_HEADER

$META_CONTENT" \
    '{priority: "IMPORTANT", message: $message}'
else
  jq -cn \
    --arg message "$CONTEXT_HEADER

Meta-skill using-forge.md not found at .claude/skills/L0/using-forge.md.
Skills still available individually via @skill-name." \
    '{priority: "INFO", message: $message}'
fi
