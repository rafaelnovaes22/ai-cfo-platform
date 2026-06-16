# Auditoria de validação de entrada — 2026-06-11

> Disparada por 3 falhas vistas em produção (mobile): valor absurdo aceito no
> lançamento manual, PDF arbitrário de 10MB no upload de DRE, textarea de colar
> sem limite. Varredura completa de backend (todas as rotas HTTP), parsers de
> ingest e formulários do frontend. Baseline para o reviewer DeepAgent mensal.

## Achados críticos — corrigidos no PR #176

| # | Onde | Gap | Correção |
|---|---|---|---|
| C1 | `src/ingest/normalize.ts` | `normalizeAmountCents` aceitava `1e308`/`Infinity` (overflow → 500 no Int4 do Postgres) | Guard `Number.isFinite` + teto `MAX_AMOUNT_CENTS` (R$20M) |
| C2 | `src/ingest/schemas.ts` | `ManualEntry.date` sem regex; `amount` sem bounds; `description` sem max; `entries` sem max; clipboard `text` sem max | Bounds em todos: date `YYYY-MM-DD`, amount finito ≤R$20M, description ≤200, entries ≤200, text ≤1M chars |
| C3 | `src/ingest/parsers/pdf-text.ts` | Parse de PDF sem timeout nem cap de bytes (DoS por PDF malformado) | Timeout 30s + guard 20MB |
| C4 | `src/ingest/routes.ts` upload | Extensão desconhecida caía silenciosamente no parser CSV | Whitelist `pdf/xlsx/xls/csv` com 400 |
| C5 | `app/.../Import.tsx` | "até 10 MB" sem checar `file.size`; textarea sem maxLength; form manual sem bounds; input number aceitava digitação interminável | Validação client-side completa + `app/src/lib/limits.ts` (limites espelhados) |
| C6 | `app/.../TransactionModal.tsx` | Teto de R$99,99M em reais estoura o Int4 em cents (R$21,4M) | Teto unificado R$20M |

## Achados médios — corrigidos no PR de hardening (este)

| # | Onde | Gap | Correção |
|---|---|---|---|
| M1 | workspace, tenant-config, classification, dre-narrative, action-plan | Params `:id` como `z.string()` livre | `.uuid()` em todos |
| M2 | `whatsapp/link` `token`; cashflow `category`; whatsapp messages `cursor`; tenant-config `scopes` | Strings/arrays sem max | `.max()` em todos (1000/100/500; scopes ≤20×50) |
| M3 | cashflow `startDate/endDate`; whatsapp messages `from/to` | Range de datas ilimitado (full scan) | Refine: ≤60 meses (cashflow), ≤12 meses (messages) |
| M4 | `/auth/login`, `/auth/register` | Sem rate limit dedicado (brute force; o comentário do server.ts prometia mas não existia) | `config.rateLimit` 10/min por IP (`AUTH_RATE_LIMIT_MAX`) |

## Achados baixos — documentados, sem ação imediata

| # | Onde | Observação |
|---|---|---|
| B1 | `LedgerEntry.description` no Postgres | `String` sem limite no schema Prisma; mitigado pelos max(200) nas bordas. Migration de `@db.VarChar` fica para quando houver outra migration no modelo |
| B2 | Response schemas (`ActionItemSchema.title/description`) | São saída, não entrada; sem risco direto |
| B3 | `excel.ts`/`csv.ts` sem timeout | Caps de 20MB/50k linhas tornam o pior caso aceitável; reavaliar se aparecer lentidão em trace |

## O que a auditoria confirmou que JÁ estava correto

- Rate limit global 100/min por IP (`server.ts`)
- CORS com whitelist de origem
- Assinatura HMAC-SHA256 no webhook WhatsApp (`X-Hub-Signature-256`)
- Multipart 20MB; caps de Excel/CSV (20MB / 50k linhas, ADR-003)
- Regex de `referenceMonth` e datas do cashflow; e-mail e E.164 validados
- Enums fechados para status/planos/roles/horizons
- Sem mass assignment: nenhum spread de `req.body` em Prisma create/update
- Tenancy: toda query filtra por `req.auth.tenantId` (C8)
- Body limit padrão do Fastify (1MB) adequado para rotas JSON

## Convenções estabelecidas

1. **Todo schema Zod de entrada tem bounds**: string com `.max()`, número com `.min()/.max()/.finite()`, array com `.max()`, id de rota com `.uuid()`, data com regex.
2. **Limites canônicos** em `src/ingest/schemas.ts` (backend) espelhados em `app/src/lib/limits.ts` (frontend). Mudou um, muda o outro.
3. **Teto monetário por lançamento**: R$20M (`MAX_AMOUNT_CENTS = 2e9`, cabe no Int4).
4. Parsers de arquivo têm **cap de bytes + linhas e/ou timeout** (paridade entre excel/csv/pdf).
