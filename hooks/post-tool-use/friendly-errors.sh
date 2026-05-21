#!/usr/bin/env bash
# Hook: friendly-errors (Forge-12 Fase 2)
# Intercepta mensagens de erro relacionadas a violações de Constitution C1-C8 e
# traduz para linguagem amigável conforme modo de operação (.forge-mode).
#
# Modos suportados:
#   vibe  → tradução leiga (ex: "C3 violation" → "Esse SKU está caro demais")
#   dev   → mostra tradução + detalhes técnicos
#   agent → não traduz (output original)
#   unset → comportamento dev por padrão
#
# Não bloqueia execução (apenas anexa explicação ao output).

set -euo pipefail

INPUT=$(cat)

# Diretório raiz do repo (pasta acima do hooks/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE_FILE="${REPO_ROOT}/.forge-mode"

# Determina modo
if [[ -f "${MODE_FILE}" ]]; then
  FORGE_MODE=$(cat "${MODE_FILE}" | tr -d '[:space:]')
else
  FORGE_MODE="dev"
fi

# Em modo agent → não traduz
if [[ "${FORGE_MODE}" == "agent" ]]; then
  exit 0
fi

# Extrai output do tool (compatível com jq ou python3)
if command -v jq >/dev/null 2>&1; then
  TOOL_OUTPUT=$(echo "${INPUT}" | jq -r '.tool_output // .output // empty' 2>/dev/null || echo "")
  TOOL_NAME=$(echo "${INPUT}" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
elif command -v python3 >/dev/null 2>&1; then
  TOOL_OUTPUT=$(echo "${INPUT}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_output', d.get('output', '')))" \
    2>/dev/null || echo "")
  TOOL_NAME=$(echo "${INPUT}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" \
    2>/dev/null || echo "")
else
  exit 0
fi

[[ -z "${TOOL_OUTPUT}" ]] && exit 0

# ─────────────────────────────────────────────────────────────────────────────
# Detecção de violações Constitution e tradução amigável
# ─────────────────────────────────────────────────────────────────────────────

FRIENDLY_MSG=""

# C1 — Diagnose-first
if echo "${TOOL_OUTPUT}" | grep -qiE "(C1|diagnose-?(before|first))"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🤔 Antes de criar isso, preciso entender melhor o problema. Você pode me contar o que o cliente vai pagar por aqui?"
      ;;
    dev)
      FRIENDLY_MSG="C1 violation — diagnose-first principle: capability nova exige /acme:diagnose antes de spec/plan/code. Veja COMMON_ERRORS.md #1."
      ;;
  esac
fi

# C2 — Outcome contratual
if echo "${TOOL_OUTPUT}" | grep -qiE "(C2|outcome.?clause|po.guardian.*reject)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="📝 O pedido tá muito vago — me ajuda a deixar mais claro? Tenta responder: 'O cliente vai poder MEDIR se eu cumpri assim: ___'"
      ;;
    dev)
      FRIENDLY_MSG="C2 violation — outcome contratual vago ou ICP fit inadequado. Reescreva como: [verbo mensurável] + [métrica] + [ICP específico]. Veja COMMON_ERRORS.md #4 e #7."
      ;;
  esac
fi

# C3 — Unit economics
if echo "${TOOL_OUTPUT}" | grep -qiE "(C3|cost.?per.?outcome|unit.?economics|margin)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="💸 Esse projeto tá caro demais pra você cobrar o preço atual — você precisa: (a) cobrar mais, (b) cortar custos, ou (c) entregar menos. Posso te ajudar a decidir."
      ;;
    dev)
      FRIENDLY_MSG="C3 violation — custo/preço > 25%. Opções: (a) reduzir scope (menos slides/features), (b) aumentar pricing, (c) ADR documentando upsell. Veja COMMON_ERRORS.md #8."
      ;;
  esac
fi

# C4 — Verifiable evaluation
if echo "${TOOL_OUTPUT}" | grep -qiE "(C4|eval.?suite|shadow|acceptance.?gate|tdd.?red)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="✅ Antes de cobrar do cliente, eu preciso ter certeza que funciona — isso significa rodar uns testes/exemplos primeiro. Quer que eu prepare?"
      ;;
    dev)
      FRIENDLY_MSG="C4 violation — eval-suite (agentic) ou acceptance-gate (platform) não satisfeito. Veja COMMON_ERRORS.md #10 (TDD red phase)."
      ;;
  esac
fi

# C5 — ADR
if echo "${TOOL_OUTPUT}" | grep -qiE "(C5|ADR|adr-approval-gate|architectural.?decision)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="📋 Essa é uma mudança importante na estrutura — eu preciso documentar PORQUÊ estamos fazendo. Me explica em 1 frase: por que essa mudança agora?"
      ;;
    dev)
      FRIENDLY_MSG="C5 violation — mudança arquitetural sem ADR. Crie em docs/forge/decisions.md com template (Contexto/Decisão/Consequências). Veja COMMON_ERRORS.md #5."
      ;;
  esac
fi

# C6 — Observability
if echo "${TOOL_OUTPUT}" | grep -qiE "(C6|langfuse|telemetry|trace)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="📊 Eu preciso registrar tudo que acontece (pra você saber depois) — vou configurar isso automaticamente, ok?"
      ;;
    dev)
      FRIENDLY_MSG="C6 violation — telemetria insuficiente. ai_enabled=true exige Langfuse; ai_enabled=false aceita logs estruturados + audit-trail."
      ;;
  esac
fi

# C7 — Portability
if echo "${TOOL_OUTPUT}" | grep -qiE "(C7|portability|coupling|domain.?layer)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🔌 Você tá amarrando muito o código a uma ferramenta específica — se um dia quisermos trocar, vai dar trabalho. Vou abstrair isso."
      ;;
    dev)
      FRIENDLY_MSG="C7 violation — SDK específico (Anthropic/OpenAI/etc.) acoplado ao domain layer. Use adapter pattern em lib/<provider>-adapter/."
      ;;
  esac
fi

# C8 — Tenant context
if echo "${TOOL_OUTPUT}" | grep -qiE "(C8|tenant|multi.?tenant|RLS)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🏢 Lembra que diferentes clientes não podem ver dados uns dos outros — vou garantir que isso esteja respeitado."
      ;;
    dev)
      FRIENDLY_MSG="C8 violation — multi-tenant context não respeitado. Adicione tenant_id em queries + RLS no PostgreSQL."
      ;;
  esac
fi

# Hash mismatch (C2 path-related)
if echo "${TOOL_OUTPUT}" | grep -qiE "(hash mismatch|sha256.*divergent)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🔐 Um arquivo foi editado mas a 'impressão digital' dele no controle de versão não foi atualizada — eu corrijo agora."
      ;;
    dev)
      FRIENDLY_MSG="Hash mismatch — arquivo foi editado mas sha256 no manifest não foi atualizado. Rode: sha256sum <path> | cut -c1-16. Veja COMMON_ERRORS.md #9."
      ;;
  esac
fi

# Secret detected
if echo "${TOOL_OUTPUT}" | grep -qiE "(secret.?scan|api.?key|password|token).*(detected|found|block)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🚨 Você tem uma senha ou chave secreta no código — isso é perigoso! Vou mover pra um lugar seguro automaticamente."
      ;;
    dev)
      FRIENDLY_MSG="secret-scan bloqueou commit — secret hardcoded detectado. Mova para .env (gitignored) + use process.env. Veja COMMON_ERRORS.md #6."
      ;;
  esac
fi

# C9 — Drift vs canônico (consumer-only, Forge-13 Sprint 2)
if echo "${TOOL_OUTPUT}" | grep -qiE "(C9|drift|framework_version_required|forge-sync\\.sh)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="⚙️ Tem uma versão nova do Forge — vou atualizar suas regras automaticamente. Pode demorar 30 segundos."
      ;;
    dev)
      FRIENDLY_MSG="C9 drift detected — framework_version_required < canônico atual. Rode: bash scripts/forge-sync.sh --from \$FORGE_PATH --dry-run primeiro, depois sem --dry-run."
      ;;
  esac
fi

# project.json missing (Forge-9+)
if echo "${TOOL_OUTPUT}" | grep -qiE "(project\\.json (missing|not found|ausente)|project_type undeclared)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="📋 Esse projeto ainda não me disse que tipo de coisa ele é (plataforma? agente IA? automação?). Me ajuda a decidir?"
      ;;
    dev)
      FRIENDLY_MSG="docs/forge/project.json ausente — declare project_type ∈ {agentic_saas, platform, automation, hybrid} + ai_enabled. Copie templates/project.template.json."
      ;;
  esac
fi

# forge-router baixa confiança (Forge-14)
if echo "${TOOL_OUTPUT}" | grep -qiE "(forge.?router.*low.confidence|intent.*ambiguous|escalate.*master.?prompt)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🤷 Não entendi bem o que você quer. Tenta de novo descrevendo: O QUÊ você quer fazer + PARA QUEM (cliente, módulo, agente)?"
      ;;
    dev)
      FRIENDLY_MSG="forge-router confidence < 0.75 — intent ambíguo. Reformule com verbo + objeto explícitos OU invoque /acme:* diretamente."
      ;;
  esac
fi

# AIOS TDD RED não falha (Forge-10 / F26-bis)
if echo "${TOOL_OUTPUT}" | grep -qiE "(tdd.?red.*not.?failing|red phase.*green|tests should fail.*red)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🧪 Os testes deveriam estar falhando agora (porque ainda não construímos a coisa). Se eles passam, é porque tem placeholder ou mock incorreto."
      ;;
    dev)
      FRIENDLY_MSG="TDD RED phase não falha — test_agent --mode red gerou testes que passam sem implementação. Revise mocks, fixtures, ou remova hardcoded returns. Veja COMMON_ERRORS.md #10."
      ;;
  esac
fi

# Coverage gate Tier C (Forge-10)
if echo "${TOOL_OUTPUT}" | grep -qiE "(coverage.*below.*threshold|tier.?c.*coverage|critical_path.*<.*100)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🛡️ Esse módulo é crítico (financeiro/contratual) e ainda não está testado o suficiente. Eu preciso de mais testes antes de poder cobrar."
      ;;
    dev)
      FRIENDLY_MSG="Coverage gate fail — Tier C exige line ≥ 95% e critical_path 100%. Adicione testes em tests/{module}/unit/ e tests/{module}/integration/. Workflow forge-test bloqueia merge."
      ;;
  esac
fi

# Gate 6 CI/CD ausente para AUTONOMOUS (Forge-8)
if echo "${TOOL_OUTPUT}" | grep -qiE "(gate.?6.*cicd|cicd.checklist.*not.signed|assisted.?to.?autonomous.*ci)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🚦 Pra promover esse agente pra modo final (cobrando do cliente), eu preciso que o CI esteja rodando. Já configuramos?"
      ;;
    dev)
      FRIENDLY_MSG="Gate 6 missing — assisted→autonomous exige CI/CD ativo (forge-validate + forge-eval workflows + branch protection). Veja templates/cicd/cicd-checklist.template.md."
      ;;
  esac
fi

# Persona detect → vibe inadequado (Forge-14 / F35)
if echo "${TOOL_OUTPUT}" | grep -qiE "(persona.?detect|forge-mode.*invalid|mode.*ambiguous)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🎭 O Forge tentou detectar seu modo de operação automático mas ficou inseguro. Você pode rodar: bash scripts/forge mode vibe (ou dev / agent)."
      ;;
    dev)
      FRIENDLY_MSG="persona-detect uncertain — sinais filesystem ambíguos. Override explícito: bash scripts/forge mode <vibe|dev|agent>. Log em docs/forge/persona-detection.log."
      ;;
  esac
fi

# Provider lock-in detectado em produção (C7 extended)
if echo "${TOOL_OUTPUT}" | grep -qiE "(import.*from.*['\"]anthropic['\"].*src/(skus|agents|modules)|require\\(.*['\"]openai['\"].*src/)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="🔒 Esse código tá amarrado a um provider de IA específico — se quisermos trocar, vai dar muito trabalho. Vou abstrair em adapter."
      ;;
    dev)
      FRIENDLY_MSG="C7 violation — SDK de provider importado fora de src/llm/adapters/. Refatore via adapter pattern. Veja COMMON_ERRORS.md."
      ;;
  esac
fi

# Manifest entry órfã (Forge-13 / refatoração consumer-mode)
if echo "${TOOL_OUTPUT}" | grep -qiE "(orphan.*artifact|artifact.*órfão|manifest.?sync.*orphan)"; then
  case "${FORGE_MODE}" in
    vibe)
      FRIENDLY_MSG="📦 Tem um arquivo novo que ainda não está registrado no inventário do projeto. Vou registrar agora ou você quer revisar primeiro?"
      ;;
    dev)
      FRIENDLY_MSG="Artefato órfão — arquivo presente no filesystem mas sem entry em manifest.json. Em consumer mode, isso é OK (manifest local não duplica canônico); em canonical, adicione entry. Veja COMMON_ERRORS.md #3."
      ;;
  esac
fi

# ─────────────────────────────────────────────────────────────────────────────
# Output amigável (não bloqueia; apenas adiciona contexto)
# ─────────────────────────────────────────────────────────────────────────────

if [[ -n "${FRIENDLY_MSG}" ]]; then
  echo ""
  echo "─── 🤖 Forge Friendly Errors ───────────────"
  echo "${FRIENDLY_MSG}"
  if [[ "${FORGE_MODE}" == "vibe" ]]; then
    echo ""
    echo "💡 Quer que eu te mostre o erro técnico original também? Diga: 'modo dev'"
  fi
  echo "────────────────────────────────────────────"
fi

exit 0
