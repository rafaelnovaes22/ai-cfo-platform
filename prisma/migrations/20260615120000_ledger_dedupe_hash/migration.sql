-- Deduplicação de lançamentos por conteúdo. Reenviar o mesmo extrato (ou um que
-- sobreponha período já enviado) duplicava LedgerEntry em MonthlyAnalysis-containers
-- distintos; o cashflow agrega por tenant+período e somava as duplicatas, inflando
-- o resultado (visto em prod: WhatsApp contava 99 lançamentos de um arquivo com 78).
--
-- dedupeHash = md5("YYYY-MM-DD|descrição|amountCents|direction#ocorrência"), idêntico
-- ao computado em runtime por src/ingest/dedupe.ts. O índice de ocorrência é por
-- (tenant, conteúdo, análise) = por upload: preserva lançamentos legitimamente
-- idênticos no mesmo extrato e detecta cópias entre análises.
--
-- ATENÇÃO: o passo 3 é DESTRUTIVO (remove duplicatas já existentes). Fazer backup
-- do banco antes de aplicar em produção.

-- 1. Coluna (nullable para permitir backfill antes da constraint).
ALTER TABLE "LedgerEntry" ADD COLUMN "dedupeHash" TEXT;

-- 2. Backfill: hash com ocorrência por (tenantId, conteúdo, analysisId).
WITH ranked AS (
  SELECT
    "id",
    md5(
      to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD') || '|' ||
      "description" || '|' ||
      "amountCents"::text || '|' ||
      "direction"::text || '#' ||
      (ROW_NUMBER() OVER (
        PARTITION BY
          "tenantId",
          to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
          "description",
          "amountCents",
          "direction",
          "analysisId"
        ORDER BY "createdAt", "id"
      ) - 1)::text
    ) AS h
  FROM "LedgerEntry"
)
UPDATE "LedgerEntry" e
SET "dedupeHash" = ranked.h
FROM ranked
WHERE e."id" = ranked."id";

-- 3. Remove duplicatas existentes (mesmo tenant+hash), mantendo a mais antiga.
DELETE FROM "LedgerEntry" a
USING "LedgerEntry" b
WHERE a."tenantId" = b."tenantId"
  AND a."dedupeHash" = b."dedupeHash"
  AND a."dedupeHash" IS NOT NULL
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- 4. Constraint que impede reinserção do mesmo lançamento (NULLs são distintos no Postgres).
CREATE UNIQUE INDEX "LedgerEntry_tenantId_dedupeHash_key" ON "LedgerEntry"("tenantId", "dedupeHash");
