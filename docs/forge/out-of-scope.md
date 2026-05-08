# Acme Forge — Out of Scope

> Lista explícita do que **NÃO** entra no Acme Forge, com justificativa.
> Mudança em qualquer item destes exige nova ADR.

---

## 1. Componentes externos não absorvidos

### `rohitg00/awesome-claude-code-toolkit`
**Razão**: meta-lista (135 agents, 35 skills, 42 commands). Redundante após adoção dos repos específicos. Útil apenas como catálogo de consulta, não como dependência.

### Multi-provider de `feiskyer/claude-code-settings` (LiteLLM, OpenRouter, DeepSeek)
**Razão**: ADR 001 fixa Claude como primário. Reviewer DeepAgents/GPT-5.5 entra como única exceção (modelo independente para auditoria). Adicionar OpenRouter/DeepSeek/Vertex agora é over-engineering — só reavaliar se ADR 001 mudar.

### Skills de marketing/C-suite/compliance de `alirezarezvani/claude-skills`
**Razão**: escopo do Forge é **engenharia de SKUs SaaS²**. Skills de growth marketing, decisões C-level e compliance LGPD genérica são responsabilidade da camada de produto/comercial — não do framework de engenharia. Se Forge for promovido a `~/.claude/` global no futuro (pós F2), reavaliar.

### Personas BMAD completas (BA, PM, Architect, SM, Dev, UX)
**Razão**: as 8 Guardians do `sdlc-guardian-agents` cobrem o mesmo terreno com semântica mais aderente ao Forge (SHADOW/AUTONOMOUS, outcome cobrável). Adotar BMAD personas + Guardians criaria sobreposição confusa. Do BMAD, absorvemos **apenas o helper pattern** (redução de tokens em L0).

### `sdlc-guardian-agents` extensions Node.js / state machine
**Razão**: hooks nativos do Claude Code (`.claude/settings.json`) cobrem o caso de uso sem dependência adicional. As "guardians" do `sdlc-guardian` são instructions + tools, não state machine real — portamos a estrutura semântica, não o runtime.

---

## 2. Decisões arquiteturais excluídas

### ClickUp como interface
**Razão**: ADR 001 fixa "cliente nunca loga — regra Acme SaaS²". Sincra é referência **metodológica** (camadas L0/L1/L2, entidades, artefatos, handoffs), mas a ferramenta ClickUp **não** entra no stack Acme SaaS². Admin é via API + ClickUp interno para operação da Acme, não para clientes.

### Multi-CLI (Copilot CLI, OpenCode, Codex, Aider)
**Razão**: Forge é **Claude Code-nativo** nesta versão. `developer-kit` e outros multi-CLI exigem trade-off de generalidade que dilui valor para a Acme. Reavaliar em Forge-5+.

### Treinamento de modelo próprio
**Razão**: princípio "build vs buy radical" da metodologia. Acme orquestra APIs, não treina modelos. Decisão fixa.

### Frontend admin elaborado multi-página
**Razão**: ADR 001 — admin via API + ClickUp interno. Dashboard cliente em Next.js é o único frontend planejado, e é entregável da Onda 4 da Acme, não do Forge.

### Multi-region / multi-cloud deploy
**Razão**: early stage (1–3 clientes). Single region. ADR 001.

### Plugin público no marketplace anthropics/skills
**Razão**: defer até Forge-5+. Ver F5 em [`decisions.md`](./decisions.md).

### Generalização do Forge para outros projetos do workspace
**Razão**: F2 — projeto-only primeiro. CarInsight, FacilIAuto, novais-digital têm contextos distintos. Tentar generalizar agora cria abstrações prematuras. Reavaliar pós Forge-5.

---

## 3. Comportamentos que o Forge NÃO automatiza

### Auto-promoção de subscription (SHADOW → ASSISTED → AUTONOMOUS)
**Razão**: promoção é decisão de produto/comercial, não automática. Comando `/acme:promote` valida gates **e mostra** o resultado, mas humano (CEO ou Tech Lead) executa a transição.

### Cobrança automática
**Razão**: billing é responsabilidade da camada de produto (Onda 4 Acme). Forge calcula e disponibiliza dados via `billing-calculator`, mas não dispara invoices.

### Comunicação automática com cliente
**Razão**: relatório executivo mensal e resposta a SLA breach são responsabilidades comerciais, não do framework de engenharia.

### Auto-resolução de FAIL do reviewer
**Razão**: reviewer abre issue, humano resolve. Sem loops automáticos de "auto-fix" baseados em LLM — viola princípio Constitution #1 (diagnose-before-design).

---

## 4. Padrões deliberadamente NÃO seguidos

### "Tudo é skill" (anthropics/skills genérico)
**Razão**: Forge usa três primitives distintos com propósitos diferentes:
- **Skills L0/L1/L2** = contexto de domínio Sincra
- **Subagents Guardian** = papéis de revisão/garantia
- **Slash commands** = pipeline executável

Forçar tudo a ser skill perde a semântica.

### "Auto-rationalization" sem verification gate
**Razão**: o framework adota deliberadamente o anti-padrão tabular do `addyosmani/agent-skills` — toda skill lista desculpas comuns + rebuttals + verification gate observável. Sem isso, agents se auto-justificam para pular passos.

### Comentários defensivos no código gerado
**Razão**: princípio do Claude Code — comentários só quando o WHY é não-óbvio. Forge **não força** comentários explicativos em código gerado.

### Documentação rotacional ("docs/2024", "docs/2025")
**Razão**: tudo em `docs/` é versionado por git. Datas vivem em commits, não em paths.

---

## 5. Casos de uso fora do escopo

### Engenharia de produto não-SaaS²
Forge serve SKUs verticais SaaS² (outcome cobrável + multi-tenant). Não serve para:
- Sites/landing pages (use stack Next.js padrão)
- Apps mobile
- ETLs / pipelines de dados puro
- Modelos preditivos / ML training

### Onboarding de cliente Cenário A (PMO clássico)
PMO está em sunset (D3). Forge **não** estende suporte ao Cenário A. Skills L0 leem de `legacy-pmo/` apenas como leitura de dados de migração — sem evolução.

---

## 6. Risco e reversibilidade

Cada item desta lista pode ser **reincorporado** mediante:
1. Identificação de necessidade real (não suposição)
2. Nova ADR justificando trade-off
3. Atualização desta lista com data de remoção do "out of scope"

**Não absorver hoje ≠ proibido para sempre.** É uma escolha consciente de escopo para Forge-0 a Forge-5.
