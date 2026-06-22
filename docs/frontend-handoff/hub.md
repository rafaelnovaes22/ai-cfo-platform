# Frontend Handoff — hub

## Responsabilidade
Home do aplicativo: snapshot da assinatura, última análise, histórico e séries temporais.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/hub` | Snapshot da home |
| GET | `/analyses` | Histórico de análises |
| GET | `/analyses/trend` | Série temporal DRE (últimos 12 meses) |
| GET | `/analyses/anomaly-timeline` | Timeline de anomalias |
| GET | `/analysis/{analysisId}/status` | Status enxuto de uma análise (polling) |
| POST | `/analysis/{analysisId}/retry` | Reprocessar análise com falha |

## Contrato
- OpenAPI: `docs/contracts/hub.openapi.yml`
- Zod: `docs/contracts/hub.zod.ts`

## Fluxo esperado na UI
1. `/hub` renderiza cards de resumo: lucro líquido, margem, quantidade de cards por tipo, plano de ação.
2. Lista de análises anteriores com status e mês de referência.
3. Gráficos usam `/analyses/trend` (receita vs. lucro vs. EBITDA) e `/analyses/anomaly-timeline`.
4. Após upload, faz polling em `/analysis/{id}/status` até `ready`/`failed`; em `failed`, mostra botão "Tentar novamente".

## Estados importantes
- `latestAnalysis.mode`: define o que é visível ao cliente (shadow = não entrega cards/plano).
- `status`: `pending` | `generating` | `ready` | `delivered` | `approved` | `failed`.
