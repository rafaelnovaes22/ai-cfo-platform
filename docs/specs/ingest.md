---
module_key: "ingest"
module_name: "Ingest — Parsers de Lançamentos"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "(input layer SKU piloto)"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Ingest — Parsers de Lançamentos

> Recebe lançamentos do cliente em 4 formatos: planilha colada (clipboard), PDF do contador (OCR + tabela), Excel/CSV (xlsx, xls, csv), formulário manual. Output: `RawLedger[]`.

## Outcomes principais

- `ingest_completed`: ≥50 lançamentos extraídos com shape válido
- `ingest_partial`: <50 ou linhas órfãs detectadas, retorna pra revisão manual
- `ingest_failed`: formato não reconhecido ou arquivo corrompido

## Features cobertas (das 60 do Aicfo)

Identificadores: (input layer SKU piloto)

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module ingest` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
