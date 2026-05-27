-- Muda o default de mode em Subscription de 'shadow' para 'assisted'.
-- Clientes em shadow passam a ver resultados completos (DRE, narrative, action plan).
-- Novas subscrições já são criadas com mode='assisted' via auth/service.ts.

ALTER TABLE "Subscription" ALTER COLUMN "mode" SET DEFAULT 'assisted';

-- Promove todos os tenants existentes em shadow para assisted.
UPDATE "Subscription" SET "mode" = 'assisted' WHERE "mode" = 'shadow';
