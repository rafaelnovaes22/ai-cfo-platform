# Frontend Handoff — export

## Responsabilidade
Exportar análise mensal em PDF (mensal, investidores, sócios).

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/analysis/{analysisId}/export/{type}` | Download do PDF |

## Contrato
- OpenAPI: `docs/contracts/export.openapi.yml`
- Zod: `docs/contracts/export.zod.ts`

## Fluxo esperado na UI
1. Na tela de DRE/Plano de Ação, botão "Exportar" abre modal com opções: `monthly`, `investors`, `partners`.
2. Clique dispara download do PDF via `apiDownload` (resposta binária, não JSON).
3. Se análise não estiver pronta (`ready`/`delivered`/`approved`), backend retorna 422.

## Estados importantes
- `type`: `monthly` | `investors` | `partners`.
- Resposta: `application/pdf` com `Content-Disposition: attachment`.
