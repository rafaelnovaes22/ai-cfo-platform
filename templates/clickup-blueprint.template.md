---
target_workspace: "{{ Nome do workspace ClickUp }}"
purpose: "internal-governance|client-portal|hybrid"
constitution_version: "0.2.0"
created_at: "{{ YYYY-MM-DD }}"
last_updated: "{{ YYYY-MM-DD }}"
version: "0.1.0"
---

# ClickUp Blueprint — {{ target_workspace }}

> Template para mapear estrutura ClickUp ao princípio C5 (Three-tier context).
> Aplicável quando o projeto usa ClickUp como sistema de governança operacional **interno**.
> Para projetos sem ClickUp, este template não se aplica.

---

## 1. Propósito declarado

**Tipo de uso**: `{{ purpose }}`

| Valor | O que significa |
|---|---|
| `internal-governance` | ClickUp 100% interno — equipe acompanha trabalho; cliente nunca acessa |
| `client-portal` | Cliente tem acesso a Spaces específicos como portal de visibilidade |
| `hybrid` | Misto — algumas áreas internas, outras compartilhadas com cliente |

**Justificativa**: {{ por que essa escolha }}

> Princípio C8 (Anti-customização) recomenda manter ClickUp **interno** quando possível. Cliente externo prefere produto próprio (UI dedicada) a ClickUp do fornecedor.

---

## 2. Estrutura recomendada (Sincra-aderente)

Aplicando hierarquia Tier 1 / Tier 2 / Tier 3 ao ClickUp:

```
🏢 Workspace: {{ target_workspace }}

📂 Space 1 — ESTRATÉGICO (Tier 1, read-mostly)
   ├─ 📜 DNA & Manifesto                  (raramente muda)
   ├─ 🎯 ICP & Personas
   ├─ 📦 Catálogo de Ofertas
   ├─ ⚖️  Princípios (espelho Constitution)
   └─ 🧠 Knowledge Layer                  (BUSINESS_PROCESS, ONTOLOGY, BUSINESS_RULE, REFERENCE_DATA)

📂 Space 2 — COMERCIAL (Tier 2, pipeline)
   ├─ 🎣 Leads                            NOVO → CONTATADO → QUALIFICADO → DESQUALIFICADO
   ├─ 🩺 Diagnósticos                     PROPOSTO → CONTRATADO → SESSÃO → ANÁLISE → ENTREGUE → CONVERTIDO/NÃO
   ├─ 📜 Propostas                        RASCUNHO → ENVIADA → NEGOCIANDO → ACEITA/RECUSADA
   └─ 🏢 Clientes (master)                consolida cliente em todos os produtos/SKUs

📂 Space 3 — PLATAFORMA (Tier 2+3) — opcional, se houver SKUs high-touch
   ├─ 📋 Subscriptions                    NEGOCIANDO → SETUP → SHADOW → ASSISTED → AUTONOMOUS → SUNSET
   ├─ 🌊 Engagements                      PROPOSED → CONTRACTED → IN_DELIVERY → DELIVERED
   ├─ ✅ Setup/Onboarding                 BACKLOG → DOING → REVIEW → DONE
   ├─ 🔁 Outcomes em produção             sync DB→ClickUp via webhook
   ├─ ⚠️  Incidentes / SLA Breach         NOVO → INVESTIGANDO → MITIGADO → RESOLVIDO
   └─ 🧪 Eval Suites                      DRAFT → ACTIVE → DEPRECATED

📂 Space 4 — PRODUTOS (Tier 2+3) — opcional, se houver produtos self-serve
   ├─ 🚀 Roadmap por produto              BACKLOG → SPECING → BUILDING → RELEASED
   ├─ 🐛 Bugs & Issues                    REPORTADO → TRIAGE → FIX → RESOLVIDO
   ├─ 💬 Feedback / Beta Users            RECEBIDO → PROCESSADO → ATENDIDO/IGNORADO
   ├─ 📊 Métricas                         1 task por métrica (target/atual/trend)
   └─ 🎓 Lifecycle Stage                  DISCOVERY → MVP → BETA → GA → MATURITY → SUNSET

📂 Space 5 — ENGENHARIA INTERNA (Tier 3)
   ├─ 🛠️  Ondas/Sprints
   ├─ 🧪 Pesquisa & Spike
   ├─ 🏗️  Refactors / Tech Debt
   └─ ✅ Sprint atual

📂 Space 6 — AUDITORIA & GOVERNANÇA (Tier 3)
   ├─ 📊 Auditorias Mensais (DeepAgent)   1 task/mês com relatório anexado
   ├─ 🚨 Issues abertas pelo Reviewer     NOVO → ATRIBUÍDO → CORRIGINDO → RESOLVIDO
   ├─ 🕳️  Bypass Log
   └─ 📋 ADRs                             PROPOSTA → APROVADA → SUPERSEDED
```

> Adapte: nem todo projeto tem Plataforma E Produtos. Mantenha apenas Spaces aplicáveis.

---

## 3. Estrutura específica deste projeto

Liste **apenas** os Spaces/Listas que este projeto usa:

### Space {{ N }} — {{ Nome }}

**Tier**: {{ 1/2/3 }}
**Propósito**: {{ ... }}

| Lista | Status workflow | Mapeia para tabela DB | Owner |
|---|---|---|---|
| {{ Nome lista }} | {{ A → B → C → D }} | {{ ex: Subscription }} | {{ time }} |
| {{ ... }} | {{ ... }} | {{ ... }} | {{ ... }} |

(Repetir por Space)

---

## 4. Sincronização DB ↔ ClickUp

### 4.1. Tabela ↔ Lista (mapping)

| Tabela DB | Lista ClickUp | Direção sync | Trigger |
|---|---|---|---|
| `Subscription` | Space 3 / Subscriptions | bidirecional | DB→CU em status change; CU→DB em webhook |
| `Outcome` | Space 3 / Outcomes em produção | DB→ClickUp apenas | Job batch a cada 1h |
| `Diagnostic` | Space 2 / Diagnósticos | bidirecional | manual + webhook |
| {{ ... }} | {{ ... }} | {{ ... }} | {{ ... }} |

### 4.2. Webhook ClickUp → projeto

Endpoint do projeto: `{{ POST /webhooks/clickup }}`

Eventos consumidos:
- [ ] taskStatusUpdated
- [ ] taskCreated
- [ ] taskAssigneeUpdated
- [ ] {{ outros }}

### 4.3. ClickUp API → projeto (cron jobs)

| Job | Frequência | O que faz |
|---|---|---|
| `clickup-sync-status` | a cada hora | Empurra mudanças de status DB→ClickUp |
| `clickup-drift-detector` | mensal | Compara estado real ClickUp vs blueprint |
| {{ ... }} | {{ ... }} | {{ ... }} |

---

## 5. Permissões internas

| Role | Acesso |
|---|---|
| **Mantenedor / CEO** | Todos os Spaces, leitura+edição |
| **Engenharia** | Spaces 3, 4, 5, 6 — leitura+edição; Spaces 1, 2 — leitura |
| **Comercial** | Spaces 1, 2 — leitura+edição; outros — leitura |
| **Operação** | Spaces 3, 4, 6 — leitura+edição; outros — leitura |
| **Cliente externo** | ❌ Sem acesso ao ClickUp interno |

---

## 6. Bootstrap automatizado (opcional)

Se o projeto consumidor implementa script de bootstrap (recomendado quando consumidor já tem cliente ClickUp):

### Pré-requisitos
- API token ClickUp com permissão de criar Spaces/Listas
- Workspace ID
- Dependência: cliente API ClickUp (`@clickup/sdk` ou similar)

### Comando padrão

```bash
npm run clickup:bootstrap -- --workspace={{ ID }} --blueprint=docs/clickup-blueprint.md
```

### Comportamento esperado
- **Idempotente**: rodar 2x produz mesmo resultado
- **Não-destrutivo**: se Space/Lista já existe com nome correto, mantém; só cria o que falta
- **Loga drift**: ao final, gera relatório de divergências entre blueprint e estado real

### Hook de drift detection (Foundry-4)

Hook mensal compara estado ClickUp real vs blueprint e abre issue em Space 6 se houver divergência > X%.

---

## 7. Validação pelo reviewer DeepAgent

Reviewer audita ClickUp em conjunto com manifest:

| Check | Como valida |
|---|---|
| **Drift Spaces** | Compara Spaces declarados no blueprint vs Spaces reais via API |
| **Drift Listas** | Compara Listas declaradas vs reais |
| **Drift Status workflows** | Compara workflows declarados vs configurados |
| **Sync DB↔ClickUp** | Conta entidades em DB vs tasks em ClickUp; desvio > 5% = WARN |

Issues abertas pelo reviewer vão para Space 6 → Issues abertas pelo Reviewer.

---

## 8. Histórico de mudanças no blueprint

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | {{ YYYY-MM-DD }} | Estrutura inicial |
| {{ }} | {{ }} | {{ ... }} |

---

## 9. Aprovação

- [ ] Mantenedor leu e aprovou estrutura
- [ ] Workspace ClickUp atual mapeado (estado as-is) antes de aplicar bootstrap
- [ ] Permissões §5 configuradas
- [ ] Webhook handler do projeto consumidor instalado

**Aprovado por**: `{{ nome }}` em `{{ data }}`
