-- Plano estável incremental (ADR-011): itens do plano persistem entre regenerações.
-- Adiciona tenantId (denormalizado), leverKey (alavanca canônica), matchKey
-- (identidade de reconciliação) e supersededAt. Backfill em itens legados.

ALTER TABLE "ActionPlanItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ActionPlanItem" ADD COLUMN "leverKey" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "ActionPlanItem" ADD COLUMN "matchKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ActionPlanItem" ADD COLUMN "supersededAt" TIMESTAMP(3);

-- Backfill: tenantId vem da análise dona; matchKey legado = id (garante unicidade
-- por linha, evitando colisão na constraint única ao migrar itens antigos sem alavanca).
UPDATE "ActionPlanItem" ai
  SET "tenantId" = ma."tenantId"
  FROM "MonthlyAnalysis" ma
  WHERE ai."analysisId" = ma."id";

UPDATE "ActionPlanItem" SET "matchKey" = "id" WHERE "matchKey" = '';

-- tenantId agora obrigatório (todas as linhas preenchidas pelo backfill).
ALTER TABLE "ActionPlanItem" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX "ActionPlanItem_analysisId_matchKey_horizon_key"
  ON "ActionPlanItem"("analysisId", "matchKey", "horizon");
CREATE INDEX "ActionPlanItem_tenantId_idx" ON "ActionPlanItem"("tenantId");
