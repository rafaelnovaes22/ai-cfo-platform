-- Lifecycle de execução para ActionPlanItem (ADR-011 Etapa 2).
-- Sinal de validação para o self-harness loop do agente action-planning.
-- Default "pending" cobre todos os registros existentes sem backfill.

ALTER TABLE "ActionPlanItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ActionPlanItem" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "ActionPlanItem" ADD COLUMN "lastStatusUpdatedAt" TIMESTAMP(3);
