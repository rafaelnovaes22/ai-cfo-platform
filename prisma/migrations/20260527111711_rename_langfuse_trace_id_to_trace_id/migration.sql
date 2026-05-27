-- RENAME COLUMN preserves existing data (6 non-null trace IDs).
-- Drift cleanup: campo armazenava trace IDs do LangSmith desde 0.22.0,
-- nome era legado de Langfuse. Esta migration renomeia para `traceId`
-- (provider-agnostic, alinhado a C7 da Constitution).
ALTER TABLE "MonthlyAnalysis" RENAME COLUMN "langfuseTraceId" TO "traceId";
