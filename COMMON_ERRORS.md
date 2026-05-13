# Erros Comuns — Aicfo

Erros frequentes com causa e solução. Atualizado conforme o projeto evolui.

---

## Banco de dados / Prisma

### `P1001: Can't reach database server`
**Causa**: PostgreSQL não está rodando ou `DATABASE_URL` errada.
**Solução**:
```bash
pg_ctl status
cat .env | grep DATABASE_URL
```

---

### `P2002: Unique constraint failed on the fields: (\`tenantId\`,\`workspaceId\`)`
**Causa**: Tentativa de criar registro duplicado dentro do mesmo tenant.
**Solução**: Verificar se o registro já existe antes de inserir. Toda criação deve filtrar por `tenantId`.

---

### `P3005: The database schema is not empty`
**Causa**: Banco com tabelas mas sem histórico de migrations.
**Solução**:
```bash
npx prisma migrate resolve --applied "nome_da_migration_baseline"
```

---

## Langfuse / Telemetria

### `LangfuseNotConfiguredError` ou trace não aparece no Langfuse
**Causa**: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` ou `LANGFUSE_HOST` ausentes/incorretos no `.env`.
**Solução**: Verificar variáveis e reiniciar o servidor. Toda chamada LLM deve ir pelo wrapper em `src/observability/`.

---

### `forge-doctor` falha em C6 com "trace sem campo obrigatório"
**Causa**: Chamada LLM não passa pelos campos obrigatórios do trace (`sku`, `tenant_id`, `outcome_category`).
**Solução**: Usar o wrapper `callLLM()` de `src/observability/` — ele injeta os campos automaticamente. Não chamar o Anthropic SDK diretamente.

---

## Agentes / LangGraph

### `GraphRecursionError: Recursion limit of 25 reached`
**Causa**: Grafo LangGraph entrou em loop (nó A chama nó B que volta para A).
**Solução**: Revisar as arestas condicionais do grafo em `src/skus/{sku}/nodes/`. Adicionar nó terminal `END` explícito.

---

### Nó retorna `undefined` inesperadamente
**Causa**: O estado do grafo não foi inicializado com todos os campos esperados.
**Solução**: Verificar o schema do state em `src/skus/{sku}/state.ts` e garantir que o nó de entrada popula todos os campos obrigatórios.

---

## Testes

### Testes falham com `LANGFUSE_KEY not set`
**Causa**: Testes tentam inicializar o tracer Langfuse sem as variáveis de ambiente.
**Solução**: Criar `.env.test` com valores mock, ou mockar o módulo `src/observability/` nos testes unitários.

---

### `forge-doctor` falha em C8 com "aios test_agent sem modes"
**Causa**: `templates/aios/agents/test_agent/config.json.template` não declara `modes: [red, verify]`.
**Solução**: Rodar `forge-sync` para atualizar o template do canônico:
```bash
bash /caminho/para/agent-governance-framework/scripts/forge-sync.sh --from /caminho/para/agent-governance-framework
```

---

## Forge / Lifecycle

### `outcome-clause-guard` bloqueia edição de spec
**Causa**: Spec sem cláusula de outcome cobrável no frontmatter.
**Solução**: Adicionar ao frontmatter:
```markdown
---
outcome: "Cliente recebe DRE Facilitado com narrativa em <5 min após importar lançamentos"
---
```

---

### `/acme:promote` recusa com "eval suite desatualizada"
**Causa**: O `prompt_hash` no manifest não bate com o hash atual dos prompts (mudança sem re-eval).
**Solução**: Rodar `/acme:eval` para atualizar a suite, depois tentar promover novamente.

---

### `forge-doctor --consumer` falha em C9 (drift)
**Causa**: O `agent-governance-framework` canônico foi atualizado mas o Aicfo está desatualizado.
**Solução**:
```bash
cd /c/Users/Rafael/Projetos/Aicfo
bash /c/Users/Rafael/Projetos/agent-governance-framework/scripts/forge-sync.sh --from /c/Users/Rafael/Projetos/agent-governance-framework
bash scripts/forge-doctor.sh --consumer
```

---

## TypeScript / Build

### `SyntaxError: Cannot use import statement in a CommonJS module`
**Causa**: O projeto usa ESM (`"type": "module"` no package.json) mas algum arquivo usa `require()`.
**Solução**: Converter para `import/export` ESM. Não misturar CJS e ESM.

---

### `ERR_MODULE_NOT_FOUND: Cannot find module './foo'`
**Causa**: TypeScript compilado não inclui extensão `.js` nos imports — obrigatório em ESM.
**Solução**: Sempre importar com extensão: `import { foo } from './foo.js'` (mesmo o arquivo sendo `.ts`).

---

## Multi-tenancy

### Dados de tenants diferentes misturados
**Causa**: Query sem filtro `tenantId`, ou `tenantId` lido do body em vez da sessão.
**Solução**: Todo acesso ao banco deve filtrar por `tenantId` da sessão autenticada:
```typescript
// Correto
const tenantId = session.user.tenantId
const dados = await prisma.workspace.findMany({ where: { tenantId } })

// Errado — NUNCA
const { tenantId } = req.body
```

---

## BullMQ / Queue

### Job não processa / fica preso em "waiting"
**Causa**: Worker não está rodando, ou Redis está inacessível.
**Solução**:
```bash
docker compose up -d redis
# verificar que o worker sobe junto com o server
npm run dev
```
