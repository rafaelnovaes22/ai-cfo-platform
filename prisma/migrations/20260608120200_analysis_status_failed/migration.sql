-- AlterEnum
-- Status 'failed' para análises cujo pipeline esgotou as tentativas.
-- Antes ficavam presas em 'generating' (spinner infinito) ou voltavam a
-- 'pending' (escondidas no frontend) — agora o erro é visível ao usuário.
ALTER TYPE "AnalysisStatus" ADD VALUE 'failed';
