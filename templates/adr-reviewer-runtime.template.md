# ADR-002: Runtime do Reviewer DeepAgent — {{ Nome do projeto consumidor }}

> **Template do Foundry** — projeto consumidor adapta isto como `docs/adr/002-reviewer-runtime.md`.
> **Origem**: `templates/adr-reviewer-runtime.template.md` v0.1.0 do `agent-governance-framework`.

---

## Status

`{{ proposed | accepted | superseded }}`

---

## Contexto

O Novais Digital Foundry define o **reviewer DeepAgent** como camada externa de auditoria contínua (decisões F17/F18 do Foundry).

O Foundry **decide o quê** (stack `deepagents` LangChain Python + 10 SKILL.md em `reviewer/deepagents/skills/`).
O projeto consumidor **decide o como** desta ADR — onde o reviewer roda, com que cadência, com que credenciais e com que orçamento.

---

## Decisões a tomar

### D1 — Local de execução

Opções:

| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| (a) **CI workflow** (GitHub Actions / GitLab CI) | Reviewer roda em job agendado | Reprodutível, log central, sem infra extra | Custo de minutos de CI; secrets em CI |
| (b) **Cron em servidor dedicado** | VM/container com cron mensal | Controle fino sobre janela | Servidor adicional para manter |
| (c) **Worker BullMQ** (ou equivalente) | Job no backend do consumidor | Integra com filas do produto | Mistura runtime de produto com auditoria |
| (d) **Local manual** | Mantenedor roda quando precisa | Zero infra | Esquecimento; sem reprodutibilidade |

**Decisão**: `{{ a | b | c | d }}` — `{{ justificativa }}`

---

### D2 — Modelo do DeepAgent

Opções:

| Opção | Custo aprox por audit | Janela | Indicação |
|---|---|---|---|
| OpenAI `gpt-4.1-mini` | ~ $0.5 | 128k | Default — bom custo-benefício |
| OpenAI `gpt-5.5` (futuro) | ~ $2 | 256k+ | Próxima geração quando disponível |
| Anthropic `claude-sonnet-4-6` | ~ $1 | 200k | Alternativa cross-LLM (review do review) |
| Anthropic `claude-opus-4-7` | ~ $5 | 1M | Auditorias críticas / pré-release |
| Google `gemini-2.5-pro` | ~ $1 | 1M+ | Janela enorme; bom para projetos grandes |

**Decisão**: `{{ modelo }}` configurado via `DEEPAGENTS_MODEL`

**Quando trocar**: `{{ critérios — ex: custo médio audit > $10, ou pass-rate baixo }}`

---

### D3 — Provedor de telemetria

Reviewer precisa **ler traces** dos agentes em produção para auditar:
- Trace coverage (C6)
- `prompt_hash` em prod vs eval
- Distribuição de `outcome_category`
- Drift signals

Opções:

| Opção | Características |
|---|---|
| Langfuse self-hosted | Open-source, dados ficam internos |
| Langfuse cloud | Gerenciado, fácil setup |
| Helicone | Foco em custo + observability |
| Phoenix (Arize) | OSS, integra com OpenTelemetry |
| Custom em DB próprio | Controle total, custo de manutenção |

**Decisão**: `{{ provider }}`

**Acesso do reviewer**: `{{ via SDK + API key em env | via export periódico em S3/local | ... }}`

---

### D4 — Cadência

Default Foundry: **mensal** (1º dia útil do mês, último mês fechado).

| Cenário | Cadência adicional |
|---|---|
| Pós-incidente | `--month=YYYY-MM --subscription_filter=X` ad-hoc |
| Pré-release MAJOR/MINOR | Antes de tag git |
| SLA breach detectado | Imediato (humano dispara) |

**Decisão**: `{{ confirmar mensal default | adicionar trigger por evento }}`

---

### D5 — Onde o output vive

Output do `foundry-auditor`:
- `docs/foundry/audits/{YYYY-MM}.md` — relatório legível
- `docs/foundry/audits/{YYYY-MM}-findings.json` — machine-readable

**Decisão**:

- [ ] Commit no repo (visibilidade do time, histórico git) — recomendado
- [ ] Bucket S3 + dashboard (separado do código)
- [ ] Híbrido (commit do markdown; JSON em bucket)

`{{ confirmar }}`

---

### D6 — Auto-rollback em SLA breach severo

Foundry default: `auto_rollback_on_breach: false` (opt-in).

**Risco de `true`**: rollback automático sem aviso humano gera incidente comercial.
**Risco de `false`**: SLA continua quebrado até humano agir.

**Decisão**: `{{ false (default) | true com canal de notificação <X> }}`

Se `true`, declarar canal de notificação obrigatório (Slack, email, etc).

---

### D7 — Credenciais

| Credencial | Local |
|---|---|
| `OPENAI_API_KEY` (ou ANTHROPIC, GOOGLE) | `{{ secret manager | env do CI | vault }}` |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | `{{ ... }}` |
| Acesso ao repo | `{{ deploy key | PAT com scope mínimo }}` |

**Decisão**: `{{ política de credenciais }}`

---

## Consequências

- **Positivas**:
  - Auditoria contínua sem dependência de humano lembrar
  - Findings rastreáveis em git
  - Cross-LLM review reduz blind spots da self-evaluation Claude

- **Negativas**:
  - Custo recorrente de inferência
  - Dependência de provider externo (OpenAI/Anthropic/etc)
  - Falsos positivos podem gerar ruído se thresholds mal calibrados

---

## Alternativas consideradas e descartadas

- **Reviewer puro humano** (sem agent) — descartada porque escala mal além de 5-10 agentes em produção
- **Reviewer só Claude (sem cross-LLM)** — descartada porque self-evaluation de prompts produzidos pelo mesmo modelo enviesa
- **Reviewer rodando dentro do mesmo processo do agente** — descartada porque mistura runtime de auditoria com produto

---

## Aprovação

**Aprovado por**: `{{ nome }}` em `{{ data }}`
**Foundry version no momento da decisão**: `{{ x.y.z }}`
**Reviewer skill version**: `foundry-auditor@{{ version }}`

---

## Histórico desta ADR

| Data | Mudança | Quem |
|---|---|---|
| `{{ data }}` | Criação inicial a partir de `templates/adr-reviewer-runtime.template.md` | `{{ nome }}` |
