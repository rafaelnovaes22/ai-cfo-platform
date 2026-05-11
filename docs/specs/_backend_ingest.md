# Backend — ingest

**Status:** complete
**Commit:** 46f94b0
**Implementado em:** 2026-05-11

## Entregáveis

- `src/ingest/routes.ts` — endpoints POST /ingest/upload, /ingest/clipboard, /ingest/manual
- `src/ingest/service.ts` — orquestração, re-import idempotente, gate ≥50 entradas
- `src/ingest/normalize.ts` — normalização de datas, valores (centavos), direção
- `src/ingest/parsers/csv.ts` — parser CSV com detecção automática de colunas
- `src/ingest/parsers/excel.ts` — parser XLSX/XLS via biblioteca xlsx
- `src/ingest/parsers/pdf.ts` — parser PDF contábil via pdf-parse (CJS/ESM compat)
- `src/ingest/parsers/text.ts` — parser de texto colado (clipboard)
- `src/ingest/schemas.ts` — schemas Zod para validação dos endpoints
- `src/ingest/types.ts` — tipos compartilhados ParseResult, RawLedger

## Comportamento

- Re-import apaga lançamentos anteriores do mesmo mês (idempotente)
- Gate: se entradas ≥ 50 → enfileira classification (BullMQ)
- Suporta 4 fontes: arquivo (multipart), clipboard (texto), JSON manual, PDF
