# Frontend Handoff — classification

## Responsabilidade
Revisar e corrigir classificação de lançamentos de baixa confiança (modo assisted).

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/classification/{analysisId}/review` | Lista lançamentos de baixa confiança |
| PATCH | `/classification/entries/{entryId}/correct` | Corrigir categoria de um lançamento |

## Contrato
- OpenAPI: `docs/contracts/classification.openapi.yml`
- Zod: `docs/contracts/classification.zod.ts`

## Fluxo esperado na UI
1. Após ingest com baixa confiança ou no modo assisted, exibir tela "Revisar classificação".
2. Lista de lançamentos com categoria prevista e confiança.
3. Usuário seleciona categoria correta → `PATCH /classification/entries/{entryId}/correct`.
4. Ao finalizar, re-disparar geração da análise ou aguardar pipeline.

## Estados importantes
- `predictedCategory`: sugestão da IA.
- `confirmedCategory`: categoria confirmada pelo usuário.
- `correctionSource`: `operator` | `client` | `needs_review`.
