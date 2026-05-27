# ADR-012 — Ambiente staging dedicado para validação de self-harness

**Status:** aceito
**Data:** 2026-05-26
**Autores:** Rafael Novaes (CEO/decisor), Claude Code (rascunho)
**Linked principles:** C2, C3, C4, C6, C8
**Supersedes:** —
**Linked docs:**
- `docs/adr/011-self-harness-per-tenant-learning.md` (pré-requisito direto — Etapa 0.5)
- `docs/adr/008-langgraph-mvp.md` (pipeline LangGraph cuja promoção esta ADR destrava)
- `docs/adr/009-vertex-ai-brasil.md` (provider primário cujo projeto staging precisa ser separado)
- `docs/adr/010-openai-fallback-dpa.md` (provider fallback que também precisa de isolamento)
- `railway.toml` (configuração atual de produção)

---

## Contexto

A ADR-011 (Self-Harness) introduziu mudanças de comportamento que **não podem ser validadas em produção sem risco para tenants ativos**:

- Aprendizado per-tenant escrevendo em contexto L1
- Gates de 95% promovendo/rebaixando agentes automaticamente
- Deleções LGPD com k-anonimidade aplicada a sinal global
- Concordância de 5 tenants validando padrões cross-tenant

A Etapa 0.5 do roadmap da ADR-011 explicitou a necessidade de staging isolado mas deixou a decisão de plataforma para uma ADR separada — esta.

### Estado atual

| Componente | Onde mora |
|---|---|
| Backend (Fastify + workers BullMQ) | Railway (`railway.toml` na raiz) |
| Postgres | Railway (DB managed) |
| Redis | Railway (Redis managed) |
| Frontend (Vite + React) | Railway |
| LLM primário | Google Vertex AI `southamerica-east1` (ADR-009) |
| LLM fallback | OpenAI gpt-4.1-mini (ADR-010) |
| Observability | LangSmith Cloud |
| CI/CD | GitHub Actions + Railway auto-deploy na branch `main` |

**Não há ambiente staging hoje.** Validação pré-prod = `npm test` local + CI verde + merge direto em `main`. Para mudanças visuais ou de schema simples isso é suficiente; para self-harness não é, porque o comportamento se manifesta apenas após múltiplas análises mensais reais.

### Por que decidir agora

Sem staging dedicado, a Etapa 1 do roadmap ADR-011 (promover LangGraph para default) fica em loop:
- Não pode ir para prod sem validação
- Não pode ser validada sem ambiente que rode com dados realistas
- Não pode ter dados realistas sem isolamento que permita seed/reset

## Opções consideradas

### Opção 1 — Railway environment paralelo (mesmo projeto, novo environment)

Railway suporta nativamente múltiplos environments por projeto (`production`, `staging`, `preview-pr-123`). Cada environment é uma cópia completa da topologia de serviços com variáveis de ambiente próprias e Postgres/Redis dedicados.

**Pros:**
- Zero overhead operacional — usa a mesma ferramenta que já dominamos
- Preview deploys por PR já é um recurso nativo do Railway
- Variáveis de ambiente isoladas — sem risco de DATABASE_URL de prod vazar para staging
- Branch deploy convention é Railway-native (uma `staging` branch → `staging` environment)
- Backup/restore entre environments é trivial

**Cons:**
- Mesma conta Railway → mesma billing (mas é endereçável via budget alerts)
- Se Railway tem outage, ambos caem juntos (irrelevante para staging)

**Custo estimado:** ~R$ 60-100/mês (Postgres pequeno + Redis pequeno + 1 instância backend; sem necessidade de réplicas)

### Opção 2 — Railway projeto separado

Um segundo projeto Railway completamente independente.

**Pros:**
- Isolamento total de billing e acesso (útil se equipe crescer)
- Pode ser destruído/recriado sem afetar prod

**Cons:**
- Overhead de manter dois projetos sincronizados (mudanças de infra precisam ser replicadas manualmente)
- Mais um lugar para configurar secrets
- Branch deploy convention precisa ser construída do zero

**Custo estimado:** ~R$ 60-100/mês (mesmo que Opção 1)

### Opção 3 — GCP Cloud Run staging

Migrar o staging para Cloud Run no mesmo projeto GCP onde já mora o Vertex AI.

**Pros:**
- Mesmo provider que o LLM primário → menor latência (Vertex e Run no mesmo região)
- GCP credits podem cobrir o custo inicialmente
- Boa preparação caso a gente migre prod para GCP no futuro

**Cons:**
- Cloud Run é stateless — Postgres e Redis precisam de Cloud SQL/Memorystore (mais caro e mais complexo)
- Operacionalmente diferente do Railway de prod — staging não validaria o setup de prod
- Curva de aprendizado para uma necessidade que dura ~6 meses (até self-harness maturar)

**Custo estimado:** ~R$ 150-250/mês (Cloud SQL é caro mesmo em tier pequeno)

### Opção 4 — Híbrido: Postgres/Redis em free tier externo + backend Railway

Postgres em Supabase free tier ou Neon free tier, Redis em Upstash free tier, backend ainda em Railway.

**Pros:**
- Quase grátis (~R$ 20/mês só pelo backend Railway)
- Cada serviço gerenciado tem dashboard/observability própria

**Cons:**
- Fragmentação operacional — 3 dashboards diferentes para investigar problemas
- Free tiers têm limites baixos que vão ser atingidos durante eval contínuo
- Variáveis de ambiente espalhadas em 3 provedores → maior superfície de ataque

**Custo estimado:** ~R$ 20-40/mês

## Decisão

**Opção 1 — Railway environment paralelo.**

Cria-se um novo `environment` chamado `staging` no projeto Railway existente do Aicfo. Cada serviço (backend, frontend, Postgres, Redis) ganha sua instância dedicada nesse environment, com variáveis isoladas.

### Por que esta opção

- **Paridade operacional**: staging usa exatamente o mesmo runtime que produção (mesmo NIXPACKS build, mesma versão de Postgres, mesmas migrations). Bug que aparece em prod aparece em staging.
- **Custo razoável** (~R$ 60-100/mês — barato comparado ao risco de degradar análise de cliente pagante)
- **Zero curva de aprendizado** — `git push` para branch específica já dispara deploy, é o padrão Railway
- **Backups e reset** são triviais (Railway Dashboard → restore from backup ou delete + recreate database)
- A Opção 3 (GCP) tem mérito estratégico mas tempo de implementação que não justifica para um ambiente cuja vida útil é ~6 meses

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  Railway Project: aicfo                                │
│                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  environment:        │    │  environment:        │  │
│  │  production          │    │  staging             │  │
│  │  ─────────────────   │    │  ─────────────────   │  │
│  │  backend (api.)      │    │  backend (api-stg.)  │  │
│  │  frontend (app.)     │    │  frontend (app-stg.) │  │
│  │  postgres            │    │  postgres            │  │
│  │  redis               │    │  redis               │  │
│  │                      │    │                      │  │
│  │  Vertex AI: project  │    │  Vertex AI: project  │  │
│  │    aicfo-prod       │    │    aicfo-staging    │  │
│  │  OpenAI: org prod    │    │  OpenAI: mesma org,  │  │
│  │                      │    │    project distinto  │  │
│  │  LangSmith: project  │    │  LangSmith: project  │  │
│  │    aicfo            │    │    aicfo-staging    │  │
│  │                      │    │                      │  │
│  │  Branch: main        │    │  Branch: staging     │  │
│  │  Auto-deploy: sim    │    │  Auto-deploy: sim    │  │
│  └──────────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Convenção de branches e deploy

```
feature branch → PR contra main → review humano + CI verde
              → merge em main → deploy automático para production
              
feature branch → push para staging → deploy automático para staging environment
              (para validação manual antes do PR contra main)
```

Para mudanças que tocam self-harness (Etapas 1-7 do roadmap ADR-011), a regra é:
1. Branch feature criada de `main`
2. Push para `staging` (force ok — staging é descartável)
3. Validação manual em `app-stg.aicfo.com.br` com tenants sintéticos
4. PR contra `main` apenas após eval suite passar em staging
5. Merge em `main` → produção

### Isolamento de provedores externos

| Provedor | Como isolar |
|---|---|
| **Vertex AI** | Novo GCP project `aicfo-staging` com service account separada; quota independente |
| **OpenAI** | Mesma org, **novo project key** (`aicfo-staging-fallback`) — OpenAI suporta multi-project billing |
| **LangSmith** | Novo project name `aicfo-staging` (mesma conta) — traces de eval não poluem auditoria de prod |
| **Stripe** | Stripe test mode (sem custo, sem cobranças reais) — keys de teste já distintas de keys de prod |
| **Sentry** | Novo project `aicfo-staging` ou tag `environment=staging` no DSN |

### Tenants sintéticos para staging

Mínimo de **3 tenants sintéticos** representativos, criados a partir de:

1. **Tenant A — varejo pequeno**: 200-400 entries/mês, vocabulário simples, classificações estáveis
2. **Tenant B — saas média**: 100-200 entries/mês, vocabulário técnico (AWS, ferramentas), receita recorrente
3. **Tenant C — serviços-b2b complexo**: 400-800 entries/mês, concentração de receita, padrões de despesa irregulares

Dados gerados a partir de **anonimização de tenants reais (com consentimento explícito)**: CNPJ fake, nomes de fornecedores trocados por placeholders, valores escalados aleatoriamente em ±15%. Permite que gates de 95% e concordância de 5-tenants tenham material realista para testar.

Procedimento de geração documentado em `scripts/seed-staging-synthetic-tenants.ts` (a criar como parte da implementação).

## Implementação

### Fases (~1 semana de calendário)

| Dia | Atividade |
|---|---|
| **D1** | Criar environment `staging` no Railway, espelhar serviços de produção, configurar domínios `api-stg.aicfo.com.br` e `app-stg.aicfo.com.br` |
| **D2** | Configurar GCP project `aicfo-staging` com Vertex AI habilitado; gerar service account JSON; configurar Postgres/Redis dedicados; criar projetos LangSmith e Stripe test |
| **D3** | Implementar `scripts/seed-staging-synthetic-tenants.ts`; gerar 3 tenants sintéticos; popular `staging` Postgres |
| **D4** | Documentar convenção de branches em `CONTRIBUTING.md` (a criar — não existe ainda); ajustar CI para validar PRs contra eval suite em staging |
| **D5** | Smoke test: rodar uma análise mensal completa em staging com Tenant A; comparar saída vs eval esperado; validar isolamento (não chega trace em LangSmith de produção) |

### Critério de "feito"

- [ ] Push para branch `staging` dispara deploy em `api-stg.aicfo.com.br`
- [ ] 3 tenants sintéticos rodam análise mensal sem erro
- [ ] Traces aparecem em `aicfo-staging` no LangSmith, **nada** vaza para projeto `aicfo` de prod
- [ ] `prisma migrate reset` em staging não afeta prod (validado por inspeção dos dois `DATABASE_URL` no Railway dashboard)
- [ ] Custo mensal real medido ≤ R$ 120/mês

## Consequências

### Positivas

- Etapa 1 da ADR-011 fica destravada — promoção LangGraph pode ser validada com risco zero para clientes pagantes
- Validação manual de mudanças de UI antes de prod (Eduardo pode testar a tela de "O que o Aicfo aprendeu" em staging antes do cliente ver)
- Eval contínuo (Etapa 5 da ADR-011) tem onde rodar sem disputar quota de Vertex AI com prod
- Habilita uso futuro de A/B testing entre prompts (PromptMemory da Etapa 7)
- Onboarding de novos contribuidores fica mais seguro — eles podem destruir staging à vontade

### Negativas

- Custo adicional de ~R$ 100/mês (sem alternativa razoável que entregue o mesmo valor)
- Mais um lugar para manter atualizado (migrations, secrets, vars de ambiente)
- Dependência crescente do Railway — se a gente quiser migrar para outro provedor, agora são dois ambientes para mover

### Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Staging diverge silenciosamente de produção (Postgres versão, NIXPACKS, etc.) | Forçar paridade via `railway.toml` (mesmo builder, mesmo `[build]`/`[deploy]` aplicado a ambos environments) + smoke test mensal |
| Tenant sintético "vaza" para prod via bug de query | Seed populado com flag `isSynthetic = true` no schema (migration nova); queries de produção filtram por `isSynthetic = false` por padrão |
| Trace de staging confunde auditoria mensal | Projetos LangSmith separados (já decidido); reviewer DeepAgent recebe URL específica do projeto `aicfo` (não `aicfo-staging`) |
| Custo dispara por uso de eval contínuo descontrolado | Budget alert no Railway em R$ 150/mês; eval contínuo com rate limit (no máximo X análises/dia em staging) |
| Branch `staging` vira "git push everything goes" e perde valor | Convenção explícita em `CONTRIBUTING.md`: staging é para validar PRs específicos, não rascunhar; ramificar a partir de `main` sempre |

## Conformidade com a Constituição

- **C2 (outcome-first)**: staging não altera o outcome contratual de produção; serve para validar mudanças antes que toquem o outcome real
- **C3 (custo ≤25%)**: custo de staging não entra no cálculo de C3 (não é custo de inferência por outcome cobrável); é custo operacional fixo. Budget de R$ 120/mês é trivial mesmo para receita atual
- **C4 (SHADOW antes de cobrar)**: staging É o ambiente onde SHADOW da Etapa 1 da ADR-011 vai rodar — sem staging, SHADOW vira "rodar em prod sem entregar", que é mais arriscado
- **C6 (telemetry)**: traces de staging em projeto LangSmith separado preservam auditabilidade dos traces de produção. Nenhum trace de tenant sintético contamina o histórico do reviewer mensal
- **C8 (anti-customização heroica)**: tenants sintéticos respeitam exatamente o mesmo schema multi-tenant de produção; nenhum `if (isStaging)` em código de produção; isolamento via configuração (environment variables) e dados (`isSynthetic` flag), não por branches de código

## Dívida documental colateral (registrada — fora do escopo desta ADR)

Durante a investigação para esta ADR, foi identificado que `railway.toml` (linha 17) ainda lista `LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_HOST` como variáveis obrigatórias em prod, quando na verdade a stack já usa LangSmith. A correção é trivial mas exige PR separado (mexer em `railway.toml` é mudança de infraestrutura — vale rastrear).

## Status

Aceito pelo CEO em 2026-05-26.
