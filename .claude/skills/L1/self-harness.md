---
name: self-harness
tier: L1
version: "1.0.0"
description: >
  Ensina o pattern de self-harness (loop fechado de aprendizado) do Novais Digital Foundry.
  Cada agente criado com o Foundry pode aprender com os dados do projeto do cliente,
  acumulando memória entre sessões sem violar C5/C6/C7/C8.
  Implementado no Foundry-20. Orquestrado pelo Hermes Learning Loop (Railway/Codex).
linked_principles:
  - C1  # learning vinculado a diagnostic real
  - C5  # soul/memory em Tier 1/2 de dados, não em código
  - C6  # rastreabilidade: source_run_id + trace_id em cada fato
  - C7  # portabilidade: fatos em markdown agnóstico
  - C8  # anti-hardcode: sem lógica por tenant no código
use_when:
  - Ao bootstrapar um novo projeto consumer no Foundry
  - Ao ativar aprendizado em projeto existente (retroativo)
  - Ao entender como o loop de aprendizado funciona end-to-end
  - Ao depurar por que um agente não está "lembrando" de sessões anteriores
---

# Self-Harness Pattern

O **self-harness** é o mecanismo pelo qual agentes construídos com o Novais Digital Foundry aprendem com os dados do projeto do cliente e melhoram de sessão para sessão.

## Os 5 pilares (herança do Hermes Agent)

| Pilar | No Foundry | Arquivo |
|---|---|---|
| **SOUL** | Identidade durável do agente para o projeto | `docs/clients/{id}/agent-soul.md` |
| **MEMORY** | Fatos aprendidos do cliente | `docs/clients/{id}/agent-memory.md` |
| **SKILLS** | Procedimentos específicos do projeto | `docs/clients/{id}/learned-skills/*.md` |
| **LOOP** | Snapshot → Hermes/Codex → PR → próxima sessão | `hooks/stop/learning-snapshot.sh` + `templates/hermes/learning-loop.md` |
| **CRONS** | (via Hermes Railway) — `/novais-digital:audit-monthly` agendado | configurado no Hermes dashboard |

## Arquitetura do loop completo

```
SessionStart hook
  └─ foundry-context.sh carrega agent-soul.md + agent-memory.md
       ↓ contexto injetado no sistema
  
Execução da sessão (/novais-digital:implement, etc.)
  └─ Agente tem acesso aos fatos aprendidos anteriormente
  
Stop hook
  └─ learning-snapshot.sh captura o que aconteceu
       → docs/learnings/YYYY-MM/{session-id}.md
       ↓ webhook → Hermes Railway
       
Hermes Learning Loop (Railway/Codex)
  └─ learning-loop skill:
     1. parse_snapshot()   — lê o snapshot
     2. assess_novelty()   — compara com agent-memory atual
     3. decide_persist()   — Codex decide o que vale persistir
     4. propose_pr()       — gh api PR com novos fatos
     5. notify_telegram()  — avisa Rafael
     
PR merged
  └─ agent-memory.md atualizado
       ↓ próxima sessão
       
SessionStart hook (loop fecha)
  └─ foundry-context.sh carrega o agent-memory.md ATUALIZADO
```

## Como bootstrapar o self-harness em um novo projeto

### Passo 1: Criar agent-soul.md

```bash
# 1. Copiar o template
cp templates/hermes/learning/agent-soul.template.md \
   docs/clients/{client_id}/agent-soul.md

# 2. Preencher campos a partir do diagnostic.md do cliente
# Campos obrigatórios: project_name, delivery_type, primary_outcome
# Campos recomendados: communication_style, key_constraints, what_to_avoid
```

O `agent-soul.md` define a **identidade** do agente para este projeto. Pense nele como:
- "Quem você é neste contexto"
- "Como você deve agir neste projeto especificamente"
- "O que você já sabe sobre este cliente"

### Passo 2: Criar agent-memory.md inicial

```bash
# 1. Copiar o template
cp templates/hermes/learning/agent-memory.template.md \
   docs/clients/{client_id}/agent-memory.md

# 2. Preencher com fatos já conhecidos do diagnostic.md
# Cada fato usa o formato:
# § [confidence:local] [YYYY-MM-DD] [run:local] Descrição do fato
```

Bootstrap recomendado — fatos para extrair do `diagnostic.md`:
- Stack técnica → `§ tech_constraints`
- Integrações com sistemas externos → `§ integration_quirks`
- Restrições operacionais → `§ tech_constraints`
- Categorias de dados pessoais → `§ pii_categories`

### Passo 3: Verificar que hooks estão registrados

O `foundry-context.sh` já está configurado para carregar soul + memory automaticamente se os arquivos existirem. Verificar em `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{"hooks": [{"type": "command", "command": "bash hooks/session-start/foundry-context.sh"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "bash hooks/stop/learning-snapshot.sh"}]}]
  }
}
```

### Passo 4: Configurar Hermes Learning Loop (opcional, ativa loop automático)

Ver `templates/hermes/learning-loop.md` para setup completo no Railway.

Sem esta etapa, o loop funciona de forma **semi-automática**: snapshots são gerados, mas a curadoria é feita pelo learning-curator guardian ao invés do Hermes/Codex.

## Formato de fato correto (§ format)

```
§ [confidence:{nivel}] [{YYYY-MM-DD}] [run:{run_id}] {descrição concisa e acionável}
```

| Nível de confidence | Quando usar |
|---|---|
| `local` | Observação informal, não confirmada em execução formal |
| `shadow` | Observado em run de SHADOW mode (draft PR, não merged) |
| `assisted` | Confirmado em run de ASSISTED mode (humano aprovou) |
| `autonomous` | Confirmado em run de AUTONOMOUS mode (sem supervisão) |

### Exemplos bem formados

```
§ [confidence:shadow] [2026-05-18] [run:gh-1234] Webhook Stripe tem retry automático — processar idempotentemente por event_id
§ [confidence:assisted] [2026-05-20] [run:gh-1350] Drizzle push funciona em staging mas exige migrate em produção
§ [confidence:autonomous] [2026-05-25] [run:gh-1500] Pattern retry com backoff expo cobre 99% dos erros transientes
```

### Exemplos mal formados (rejeitar)

```
§ [] [] [run:] O projeto usa TypeScript       ← genérico + sem metadados
§ [confidence:local] [2026-05-18] [run:local] Email do admin é admin@example.com  ← PII!
§ [confidence:shadow] [2026-05-18] [run:gh-1] if (client === 'school-platform') usar rota /api/v2  ← tenant hardcode!
```

## Compliance C1-C8

| Princípio | O que o self-harness faz |
|---|---|
| C1 (diagnose-first) | Learning só conta se `source_diagnostic` != "none" em snapshot |
| C5 (three-tier) | Soul/memory em `docs/clients/` (Tier 1/2), learned-skills em `docs/clients/{id}/learned-skills/` — NUNCA em `.claude/skills/` canônicas |
| C6 (telemetria) | Todo fato tem `source_run_id` + `date`; snapshots têm `session_id` + `trace_id` + `run_id` |
| C7 (portabilidade) | Fatos em markdown puro; sem referência a `claude-opus`, `gpt-4o` ou qualquer modelo específico |
| C8 (anti-hardcode) | `client_id` como dado (filename, parâmetro), nunca em lógica de código |
| C3 (economics) | Snapshot captura `tokens_used` + `cost_estimate`; Hermes inclui custo no "should persist?" |
| C4 (pilot-before-canonical) | `confidence: local` = não confirmado; `shadow` = pilot; `autonomous` = canonical |

## O que cada guardian aprende

| Guardian | Seção em agent-memory | O que aprende |
|---|---|---|
| `po-guardian` | `§ process_patterns` | Linguagem do decisor, o que conta como outcome válido |
| `artifact-architect` | `§ tech_constraints` | Stack, constraints de deploy, padrões de arquitetura |
| `unit-economist` | `§ economics_real` | Custo real de hora, variação de volume |
| `eval-engineer` | `docs/clients/{id}/learned-skills/eval-patterns.md` | Edge cases reais, false positives comuns |
| `observability-guardian` | `§ telemetry_hints` | Campos extras úteis nos traces deste projeto |
| `security-privacy-guardian` | `§ pii_categories` | Categorias de PII presentes (não dados reais) |
| Agents AIOS | `docs/clients/{id}/learned-skills/integration-patterns.md` | Padrões de integração com sistemas do cliente |

## Depuração

**Problema**: Agent não lembra de sessões anteriores

```bash
# 1. Verificar se agent-soul.md existe
ls docs/clients/*/agent-soul.md

# 2. Verificar se foundry-context.sh está no SessionStart hook
grep -A5 "SessionStart" .claude/settings.json

# 3. Verificar se learning snapshots estão sendo gerados
ls docs/learnings/$(date +%Y-%m)/

# 4. Verificar se foundry-context.sh encontra os arquivos
bash hooks/session-start/foundry-context.sh | jq '.message' | grep -i "soul\|memory"
```

**Problema**: Snapshots gerados mas fatos não persistidos

```bash
# 1. Verificar se Stop hook está registrado
grep -A5 "Stop" .claude/settings.json

# 2. Verificar snapshot mais recente
ls -t docs/learnings/*/*.md | head -1 | xargs cat

# 3. Se Hermes não está ativo, rodar learning-curator manualmente:
# /novais-digital:learn {client_id}
```
