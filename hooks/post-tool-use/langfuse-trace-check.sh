#!/usr/bin/env bash
# Hook: langfuse-trace-check
# Warns when LLM calls in src/agents/** lack Langfuse trace instrumentation (C6).

INPUT=$(cat)

if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$INPUT" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" \
    2>/dev/null || echo "")
fi

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

# Only check agent implementation files
if [[ "$FILE_PATH" =~ src/(agents|skus)/.+\.(ts|js)$ ]]; then
  CONTENT=$(cat "$FILE_PATH" 2>/dev/null || echo "")

  # Detect LLM call patterns
  HAS_LLM=$(echo "$CONTENT" | grep -cE '\.invoke\(|\.chat\(|openai\.|anthropic\.|\.generate\(|llm\.' 2>/dev/null || echo "0")

  if [ "$HAS_LLM" -gt "0" ]; then
    # Check for trace instrumentation
    HAS_TRACE=$(echo "$CONTENT" | grep -cE 'observe\(|langfuse\.|\.trace\(|traceId|span\.' 2>/dev/null || echo "0")

    if [ "$HAS_TRACE" -eq "0" ]; then
      echo "WARN [langfuse-trace-check]: '$FILE_PATH' contém chamadas LLM sem trace Langfuse (viola C6)." >&2
      echo "Adicione observe() ou langfuse.trace() para 100% de cobertura de traces (C6)." >&2
      exit 1
    fi
  fi
fi

exit 0
