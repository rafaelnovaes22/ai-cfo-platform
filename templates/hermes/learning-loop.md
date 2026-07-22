---
name: foundry-learning-loop
version: "1.0.0"
description: >
  Hermes skill que orquestra o loop de aprendizado do Novais Digital Foundry.
  Recebe callback do foundry-headless após cada run, decide "should I persist?",
  e propõe PRs com patches ao agent-memory.md do consumer.
triggers:
  - foundry_run_completed
  - foundry_webhook_callback
requires:
  - gh CLI autenticado com repo+workflow scope
  - GH_TOKEN env var
  - FOUNDRY_REPO env var (ex: novais-digital/agent-governance-framework)
  - TELEGRAM_CHAT_ID (para notificações)
linked_principles:
  - C1  # learning vinculado a diagnostic real
  - C6  # toda memória tem source_run_id + trace_id
  - C7  # fatos em markdown agnóstico, sem menção a modelo
  - C8  # nunca hardcodar por tenant; fatos ficam em docs/clients/{id}/
rate_limits:
  max_prs_per_consumer_per_day: 1
  min_novelty_score_to_persist: 0.6  # 0-1; fatos triviais não geram PR
---

# Foundry Learning Loop

Skill Hermes que fecha o loop de aprendizado entre execuções do Novais Digital Foundry e o agent-memory.md de cada consumer.

## Fluxo principal

```
foundry-headless callback
      ↓
1. parse_snapshot()       — lê learning snapshot do artifact
2. assess_novelty()       — verifica se há algo novo (vs agent-memory atual)
3. decide_persist()       — LLM decide se vale um PR (score ≥ 0.6)
4. propose_pr()           — gh api PR com patches ao agent-memory.md
5. notify_telegram()      — informa Rafael sobre o aprendizado
6. rate_limit_check()     — máx 1 PR de learning por consumer por dia
```

## Trigger: foundry_run_completed

O Hermes recebe este evento via webhook HMAC-signed do `foundry-headless.yml`.

Payload esperado:
```json
{
  "event": "foundry_run_completed",
  "timestamp": "2026-05-18T10:00:00Z",
  "run_id": "12345678",
  "run_url": "https://github.com/novais-digital/agent-governance-framework/actions/runs/12345678",
  "consumer": "school-platform",
  "command": "/novais-digital:implement",
  "exit_code": 0,
  "learning_snapshot_path": "docs/learnings/2026-05/20260518T100000-12345.md",
  "learning_snapshot_content": "...",
  "caller_id": "telegram:123456789",
  "hmac_signature": "sha256=..."
}
```

### Validação HMAC

```python
import hmac, hashlib, os

def verify_signature(payload: bytes, signature: str) -> bool:
    secret = os.environ["HERMES_WEBHOOK_SECRET"].encode()
    expected = "sha256=" + hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

Rejeitar silenciosamente (HTTP 200 sem ação) se assinatura inválida.

## Passo 1: parse_snapshot()

```python
def parse_snapshot(snapshot_content: str) -> dict:
    """
    Extrai frontmatter YAML + seções markdown do learning snapshot.
    Retorna dict com: session_id, consumer, command, exit_code, confidence,
                      client_id, is_internal, gate_summary, new_patterns, pitfalls
    """
    # parse YAML frontmatter entre --- delimiters
    # parse markdown sections by ## headers
    ...
```

Ignorar snapshots com `is_internal: true` E `confidence: local` — não geram PR.
Snapshots com `confidence: shadow` ou superior sempre são avaliados.

## Passo 2: assess_novelty()

Compara fatos candidatos do snapshot com o `agent-memory.md` atual do consumer.

```python
def assess_novelty(snapshot: dict, current_memory_content: str) -> list[dict]:
    """
    Para cada fato candidato em new_patterns e pitfalls:
    - Verifica se já existe fato semelhante em agent-memory.md
    - Calcula novelty_score (0-1)
    - Retorna apenas fatos com novelty_score >= min_novelty_score_to_persist
    """
    ...
```

Fetch do agent-memory.md atual:
```bash
gh api repos/novais-digital/agent-governance-framework/contents/docs/clients/{consumer}/agent-memory.md \
  --jq '.content' | base64 -d
```

## Passo 3: decide_persist()

Codex decide se os fatos novos merecem ser persistidos.

**Prompt para Codex:**
```
Você é o curador de memória do Novais Digital Foundry. Analise os fatos candidatos abaixo e decida quais persistir em agent-memory.md.

Critérios de persistência:
- O fato é acionável? (muda comportamento futuro do agente)
- O fato é específico e verificável? (não genérico demais)
- O fato complementa (não duplica) a memória existente?
- O fato é seguro? (sem PII, sem credenciais, sem lógica por tenant)
- O fato tem rastreabilidade? (source_run_id + date)

Para cada fato, responda: PERSIST | SKIP | NEEDS_REVIEW
Com justificativa em uma linha.

Memória atual:
{current_memory_content}

Fatos candidatos:
{candidate_facts}
```

Se todos os fatos forem SKIP → não criar PR, registrar no log.

## Passo 4: propose_pr()

Cria PR no consumer repo com patches ao agent-memory.md.

```python
def propose_pr(consumer: str, new_facts: list[dict], run_id: str, snapshot_path: str):
    """
    1. Fetch SHA do agent-memory.md atual via gh api
    2. Adiciona novos fatos nas seções corretas (§ integration_quirks, etc.)
    3. Cria branch foundry-learning/{consumer}/{date}-{run_id[:8]}
    4. Push do arquivo atualizado
    5. gh pr create com body estruturado
    """
    branch = f"foundry-learning/{consumer}/{today}-{run_id[:8]}"
    pr_title = f"[foundry-learning] {consumer}: {len(new_facts)} novos fatos aprendidos"
    pr_body = f"""
## Learning PR — {consumer}

Fatos aprendidos na run [{run_id}]({run_url}) de `{command}`.

### Fatos adicionados

{format_facts_table(new_facts)}

### Fonte

- Learning snapshot: `{snapshot_path}`
- Confidence: `{confidence}`
- Decidido por: Hermes/Codex (foundry-learning-loop v1.0.0)

### Revisão

- [ ] Fatos são corretos e acionáveis
- [ ] Nenhum PII ou credencial incluído (C8)
- [ ] Rastreabilidade OK (source_run_id presente em todos)

> Merge para fechar o loop de aprendizado. Próxima sessão carregará estes fatos via SessionStart.
"""
```

**Política de rate limiting:**
```python
def check_rate_limit(consumer: str) -> bool:
    """Retorna True se pode criar PR (máx 1/consumer/dia)."""
    # Verificar PRs abertos com label foundry-learning e consumer={consumer}
    # gh pr list --repo ... --label foundry-learning --search "consumer:{consumer}"
    ...
```

## Passo 5: notify_telegram()

Formata e envia notificação ao Telegram do Rafael.

**Mensagem de sucesso:**
```
🧠 *Foundry aprendeu algo novo*

📦 Consumer: `{consumer}`
🏃 Run: `{command}` ([#{run_id}]({run_url}))
✅ {len(new_facts)} fatos persistidos em `agent-memory.md`

Fatos:
{facts_summary}

[Ver PR]({pr_url})
```

**Mensagem sem novidade:**
```
ℹ️ *Foundry run concluída — sem novidades*

📦 Consumer: `{consumer}`
🏃 Run: `{command}` (#{run_id})
💤 Nada novo para persistir (score abaixo do limiar)
```

## Segurança e compliance

| Regra | Implementação |
|---|---|
| C8: sem tenant hardcode | Fatos sempre têm `client_id` como dado, nunca em código |
| C6: rastreabilidade | Cada fato tem `source_run_id` + `date` obrigatórios |
| C7: portabilidade | Fatos em markdown puro, sem referência a modelo específico |
| PII guard | Antes de criar PR, grep por CPF/email/token patterns no conteúdo |
| HMAC validation | Todo webhook validado antes de qualquer ação |
| Rate limiting | Máx 1 PR/consumer/dia para evitar spam de PRs |

## Configuração

Variáveis de ambiente Hermes (Railway):

```env
# Já definidas em templates/hermes/railway/env.example
GH_TOKEN=ghp_...               # PAT com repo+workflow scope
FOUNDRY_REPO=novais-digital/agent-governance-framework
HERMES_WEBHOOK_SECRET=...      # HMAC secret compartilhado com foundry-headless.yml

# Específicas do learning loop
FOUNDRY_LEARNING_MIN_NOVELTY=0.6
FOUNDRY_LEARNING_MAX_PRS_PER_DAY=1
FOUNDRY_LEARNING_NOTIFY_TELEGRAM=true
```

## Registro no skill catalog

Adicionar ao `skills.json` do Hermes Railway:

```json
{
  "name": "foundry-learning-loop",
  "file": "skills/foundry-learning-loop.md",
  "version": "1.0.0",
  "auto_trigger": ["foundry_run_completed"],
  "manual_trigger": false
}
```
