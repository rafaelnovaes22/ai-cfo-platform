-- AlterTable
-- directionInferred = true quando a direção do lançamento veio do fallback
-- "positivo = crédito" num arquivo sem coluna Tipo preenchida e sem sinais
-- sistemáticos (ex: planilha do cliente com valores todos positivos).
-- Nesses casos o classificador LLM pode corrigir a direção pela natureza
-- da categoria prevista. Default false preserva o comportamento de extratos
-- bancários, entrada manual e DRE importada (direção é fato).
ALTER TABLE "LedgerEntry" ADD COLUMN "directionInferred" BOOLEAN NOT NULL DEFAULT false;
