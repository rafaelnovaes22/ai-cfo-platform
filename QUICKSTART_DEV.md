# Quickstart — Dev novo no Aicfo

Guia para rodar o projeto localmente do zero em ~15 minutos.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|---|---|---|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| PostgreSQL | 15+ | `psql --version` |
| Git | qualquer | `git --version` |
| Claude Code | atual | `claude --version` |

---

## 1. Instalar dependências

```bash
npm install
```

---

## 2. Configurar variáveis de ambiente

```bash
cp .env.example .env   # ou .env.staging.example conforme ambiente
```

Edite `.env` com os valores reais (peça ao Rafael):

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/aicfo_dev"
ANTHROPIC_API_KEY="sk-ant-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_HOST="https://cloud.langfuse.com"
```

---

## 3. Criar e migrar o banco

```bash
createdb aicfo_dev
npx prisma migrate dev
npm run seed:dev   # se disponível
```

---

## 4. Rodar o servidor

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` (ou porta configurada no `.env`).

---

## 5. Rodar os testes

```bash
# Unitários
npm run test

# Com watch
npm run test:watch

# Cobertura
npm run test:coverage
```

---

## 6. Estrutura de pastas principal

```
src/
├── skus/                  # SKUs verticais (spec + nodes + prompts + evals)
│   └── monthly-analysis/  # SKU piloto — DRE Facilitado
├── llm/                   # Camada LLM (C7 — isolamento de provider)
├── observability/         # Langfuse tracing (C6)
├── persistence/           # Acesso a banco via Prisma (C7 — isolamento)
├── auth/                  # Autenticação multi-tenant
├── billing/               # Billing e planos
├── queue/                 # BullMQ jobs
└── api/                   # Fastify routes + handlers

aios/                      # Pipeline multi-agente de implementação
├── orchestrator.py        # Orquestra spec → build → test → review
└── config.yaml            # Stack, módulos, coverage targets

templates/                 # Templates Foundry (aios, cicd, spec, economics)
docs/
├── foundry/                 # Documentação do framework
├── adr/                   # Architecture Decision Records
└── product-vision.md      # Visão do produto + roadmap de ondas
```

---

## 7. Comandos do dia a dia

```bash
# Gerar client Prisma após mudar schema
npx prisma generate

# Criar nova migration
npx prisma migrate dev --name descricao

# Build TypeScript
npm run build

# Lint
npm run lint

# Validar framework Foundry
bash scripts/foundry-doctor.sh --consumer
```

---

## 8. Pipeline para um nó novo (TDD-first)

```bash
# 1. Spec
python aios/orchestrator.py spec --module monthly-analysis

# 2. RED — testes que devem FALHAR
python aios/orchestrator.py test --module monthly-analysis --mode red
# → confirme que os testes falham antes de prosseguir

# 3. Build
python aios/orchestrator.py build --module monthly-analysis

# 4. VERIFY — testes que devem PASSAR
python aios/orchestrator.py test --module monthly-analysis --mode verify

# 5. Review (gate TDD + Constitution)
python aios/orchestrator.py review --module monthly-analysis
```

---

## 9. Regras importantes

- **Langfuse obrigatório** — toda chamada LLM deve ter trace; sem trace = violação C6
- **SHADOW antes de cobrar** — nenhuma análise chega ao cliente sem `/novais-digital:promote` validando o modo
- **C3 custo**: tokens / preço ≤ 25% — verificar `templates/delivery-economics.template.md`
- **Multi-tenant**: toda query ao banco passa `tenantId` da sessão — nunca do body
- **Prompts versionados**: mudança de prompt → novo `prompt_hash` → re-eval obrigatória

---

## 10. Dúvidas comuns

Ver [COMMON_ERRORS.md](COMMON_ERRORS.md) para erros frequentes com solução.
Ver [CLAUDE.md](CLAUDE.md) para o guia completo.
