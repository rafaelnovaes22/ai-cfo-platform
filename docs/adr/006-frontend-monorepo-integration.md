---
adr_id: "006"
title: "Integração do frontend React no monorepo Aicfo — substituição do Supabase pelo backend Fastify"
status: "ratificada"
constitution_version: "0.3.0"
created_at: "2026-05-18"
last_updated: "2026-05-18"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C2, C7, C8]
related_adrs: ["001", "005"]
---

# ADR-006 — Integração do frontend React no monorepo e substituição do Supabase

> **Status**: ✅ Ratificada
> **Data proposta**: 2026-05-18
> **Decisor**: CEO + Tech Lead
> **Bloqueia**: nada (esta ADR documenta decisão já executada nas Waves 3-6)
> **Princípios Constitution afetados**: C2 (outcome-first), C7 (portability over lock-in), C8 (anti-customização heroica)

---

## 1. Contexto

Em 2026-05-14 (commit `2b87805`) o frontend React foi trazido para este repositório pelo dev Eduardo. Ele estava construído sobre **Supabase Auth + Supabase Postgres JS client** — dependência externa de BaaS que criava lock-in (viola C7) e duplicava fonte de verdade com o backend Fastify/Prisma (viola C2).

O backend Fastify existia como fonte canônica do outcome `monthly-analysis` desde a Onda 0. A presença do frontend no monorepo tornou tecnicamente possível e necessária a migração.

---

## 2. Decisão

**Substituir Supabase integralmente** (auth + dados) pelo backend Fastify como única fonte de verdade. O frontend passa a consumir o backend via api client tipado gerado a partir da spec OpenAPI (`openapi-typescript`).

Escopo da mudança:
- `app/src/lib/api/` — fetch wrapper + types gerados + namespaces por módulo
- `app/src/lumen/auth/AuthContext.tsx` — reescrito; JWT do backend em localStorage
- `app/src/lumen/data/useAnalyses.ts` — wrapper sobre `GET /analyses`
- `app/src/lumen/data/useTransactions.ts` — wrapper sobre `GET /classification/:id/review`
- `app/src/lumen/data/useActionItems.ts` — wrapper sobre `GET /analysis/:id/action-plan`
- Páginas: Hub, Plan, Transactions, Import, Dashboard — todas recabeiradas para endpoints Fastify
- Removidos: `app/src/integrations/supabase/`, `app/src/lumen/data/mock.ts`, dependência `@supabase/supabase-js`

---

## 3. Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter Supabase como BaaS + sincronizar com Prisma | Dois writepaths, eventual consistency — lock-in duplo, viola C2 e C7 |
| Manter Supabase só para Auth, usar backend para dados | Auth fragmentada; dois tokens; maior surface de segurança; complica refresh flow |
| Manter frontend em repo separado consumindo Fastify | Opção válida a longo prazo; irrelevante agora que o monorepo já existe |

---

## 4. Consequências

### Positivas
- **C7**: zero dependências externas de BaaS; portabilidade total do stack
- **C2**: backend é única fonte de verdade do outcome — sem divergência semântica
- **C8**: sem hardcode de credenciais Supabase em frontend
- **Tipos sempre sincronizados**: `npm run api:types` em `app/` regenera `types.ts` a partir do OpenAPI servido pelo backend
- **CashFlow mockado intencionalmente**: módulo ainda não implementado no backend (Onda 2); frontend exibe banner "em breve" sem endpoint fake

### Negativas / trade-offs
- **CRUD livre removido**: Supabase permitia CRUD de `transactions` e `analyses` direto do cliente; backend só suporta ingest em lote + correção pontual. Aceito — é o modelo correto do produto.
- **Sem offline**: sem Supabase Realtime ou cache local agressivo. Aceitável para MVP.
- **Password reset dependente de Resend**: sem `RESEND_API_KEY` configurado, o link cai no log em dev. Produção requer key válida.

---

## 5. Compliance Constitution

| Princípio | Check |
|---|---|
| C2 — Outcome-first | ✅ Backend Fastify é fonte canônica; frontend não decide outcome |
| C7 — Portability | ✅ Supabase removido; api client é fetch puro + tipos gerados |
| C8 — Anti-hardcode | ✅ Sem `if (tenantId === '...')` ou `clients/{nome}/` no frontend |

---

## 6. Referências

- Commits: `2b87805` (bring frontend), `feat(frontend): Wave 3-6` (integração completa)
- Plano de integração: `.claude/plans/pure-spinning-quiche.md`
- Frontend app: `app/` (Vite + React 18 + TanStack Query + React Router 6)
- Api client: `app/src/lib/api/client.ts`, `app/src/lib/api/index.ts`
