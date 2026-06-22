# Frontend Handoff — ingest

## Responsabilidade
Importar lançamentos financeiros para uma análise mensal via upload, clipboard ou lançamento manual.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| POST | `/ingest/upload?referenceMonth=YYYY-MM` | Upload de arquivo (.xlsx, .xls, .csv, .pdf) |
| POST | `/ingest/clipboard` | Colar planilha/texto |
| POST | `/ingest/manual` | Lançamentos manuais em lote |

## Contrato
- OpenAPI: `docs/contracts/ingest.openapi.yml`
- Zod: `docs/contracts/ingest.zod.ts`

## Fluxo esperado na UI
1. Usuário seleciona mês de referência (ex: `2026-06`).
2. Escolhe método de import:
   - **Arquivo**: drag-and-drop ou input file → `POST /ingest/upload` (multipart/form-data).
   - **Colar**: textarea com preview → `POST /ingest/clipboard`.
   - **Manual**: tabela editável com validação inline → `POST /ingest/manual`.
3. Resposta contém `analysisId`, `entryCount`, `orphanCount`, `outcome`.
4. Se `outcome === "completed"`, redirecionar para `/analise/{analysisId}` (polling no `/analysis/{id}/status`).
5. Se `outcome === "partial"`, mostrar lançamentos órfãos e permitir correção antes de prosseguir.

## Estados importantes
- `outcome`: `completed` | `partial` | `failed`.
- `orphanCount > 0`: lançamentos que não puderam ser parseados.
- Status da análise: `pending` → `generating` → `ready`/`failed`.

## Limites (espelhados em `app/src/lib/limits.ts`)
- Texto clipboard: 1.000.000 caracteres.
- Lançamentos manuais: 200 por request.
- Descrição: 200 caracteres.
- Valor: até R$ 20.000.000.

## Telas relacionadas
- `/importar`
- `/analise/{analysisId}`
