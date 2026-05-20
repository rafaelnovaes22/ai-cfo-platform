---
name: agent-governance-framework-status-fast
version: 0.1.0
description: >
  Caminho rápido para o intent #9 (status) — lê manifest.json e project.json dos
  consumers via GitHub REST API sem disparar runner. Latência < 5s vs ~60s do
  forge-headless.yml. Use APENAS para leitura de estado; nunca para execução.
author: Acme (acme-startup)
requires:
  - gh  # GitHub CLI autenticado
linked_principles:
  - C6  # leitura sem side-effect, sem custo de inferência
---

# agent-governance-framework-status-fast — Leitura rápida via gh api

## Quando usar

Quando o usuário pede **status, overview ou "tudo ok?"** sem precisar executar nenhuma lógica do Forge. Exemplos:

- "Como está o SchoolPlatform?"
- "Status geral de todos os projetos"
- "Tudo ok com o Aicfo?"
- "Qual versão do Forge está nos consumers?"

Para qualquer coisa que precise **executar** um pipeline (audit, eval, pre-merge), use `forge.skill.md`.

---

## Comandos de leitura rápida

### 1. Manifest do Forge canônico (versão atual, última atualização)

```bash
gh api repos/acme-startup/agent-governance-framework/contents/docs/forge/manifest.json \
  --jq '.content | @base64d | fromjson | {version: .framework.version, last_updated: .framework.last_updated, phase: .framework.phase}'
```

### 2. Estado de um consumer específico

```bash
# SchoolPlatform
gh api repos/acme-startup/school-platform/contents/docs/forge/project.json \
  --jq '.content | @base64d | fromjson | {project_type, ai_enabled, last_synced_at: .framework.last_synced_at, framework_version_required: .framework.framework_version_required}' \
  2>/dev/null || echo '{"error": "project.json não encontrado"}'
```

### 3. Loop por todos os consumers (status consolidado)

```bash
for CONSUMER in school-platform aicfo clickup-automation marketing-ai-agents; do
  echo "=== $CONSUMER ==="
  gh api "repos/acme-startup/$CONSUMER/contents/docs/forge/project.json" \
    --jq '.content | @base64d | fromjson | {project_type, ai_enabled, framework_version_required: .framework.framework_version_required, last_synced_at: .framework.last_synced_at}' \
    2>/dev/null || echo '{"status": "sem project.json (não Forge ou não sincronizado)"}'
done
```

### 4. Verificar drift de versão (consumer vs canônico)

```bash
CANON_VERSION=$(gh api repos/acme-startup/agent-governance-framework/contents/docs/forge/manifest.json \
  --jq '.content | @base64d | fromjson | .framework.version')

for CONSUMER in school-platform aicfo clickup-automation; do
  REQUIRED=$(gh api "repos/acme-startup/$CONSUMER/contents/docs/forge/project.json" \
    --jq '.content | @base64d | fromjson | .framework.framework_version_required' 2>/dev/null || echo "N/A")
  
  if [[ "$REQUIRED" == "$CANON_VERSION" ]]; then
    echo "✅ $CONSUMER — em dia (v$CANON_VERSION)"
  else
    echo "⚠️  $CONSUMER — precisa sync (tem $REQUIRED, canônico é $CANON_VERSION)"
  fi
done
```

### 5. Últimos runs do forge-headless (histórico de execuções)

```bash
gh run list \
  --repo acme-startup/agent-governance-framework \
  --workflow forge-headless.yml \
  --limit 10 \
  --json status,conclusion,displayTitle,createdAt,url \
  --jq '.[] | {status, conclusion, title: .displayTitle, created: .createdAt, url}'
```

---

## Formato de resposta ao usuário

Após rodar os comandos acima, sintetize no Telegram:

```
📊 Status Acme Forge — [DATA]

Forge canônico: v[VERSION] (atualizado [DATA])

Consumers:
• SchoolPlatform — [project_type] | sync v[VERSION] | [DATA]
• Aicfo     — [project_type] | sync v[VERSION] | [DATA]
• ClickUp    — [project_type] | sync v[VERSION] | [DATA]

Últimas execuções:
• [STATUS] [COMANDO] — [CONSUMER] ([DATA])
• ...

[Se drift: "⚠️ X consumer(s) desatualizados — rode forge-sync"]
```
