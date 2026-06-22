# Frontend Handoff — dre-narrative

## Responsabilidade
Exibir DRE Facilitado e os cards de narrativa (gargalo / atenção / saudável).

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/analysis/{analysisId}/dre` | DRE agregada completa |
| GET | `/analysis/{analysisId}/narrative` | Cards de narrativa |
| PATCH | `/analysis/{analysisId}/narrative/{cardId}/feedback` | Aprovar/rejeitar card (modo assisted) |

## Contrato
- OpenAPI: `docs/contracts/dre-narrative.openapi.yml`
- Zod: `docs/contracts/dre-narrative.zod.ts`

## Fluxo esperado na UI
1. Tela DRE mostra receita bruta → lucro líquido, com toggles R$ / % / vs. mês anterior.
2. Seção "Leitura da história" exibe 3 cards com título, corpo e evidências numéricas.
3. No modo assisted, usuário pode aprovar (`approved: true`) ou rejeitar (`approved: false`) cada card com comentário.

## Estados importantes
- `cardType`: `critical_gap` | `attention` | `healthy`.
- `clientApproved`: `true` | `false` | `null`.
- DRE entrega valores em centavos; UI divide por 100 para exibição.
