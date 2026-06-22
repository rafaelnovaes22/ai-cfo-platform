# Frontend Handoff — action-plan

## Responsabilidade
Exibir plano de ação 3-horizontes e permitir feedback / mudança de status / aprovação do mês.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/analysis/{analysisId}/action-plan` | Plano de ação completo |
| PATCH | `/analysis/{analysisId}/action-plan/{itemId}/feedback` | Aprovar/rejeitar item (assisted) |
| PATCH | `/actions/{itemId}/status` | Atualizar status de execução |
| POST | `/analysis/{analysisId}/approve` | Aprovar/fechar análise do mês (assisted) |

## Contrato
- OpenAPI: `docs/contracts/action-plan.openapi.yml`
- Zod: `docs/contracts/action-plan.zod.ts`

## Fluxo esperado na UI
1. Tela "Plano de Ação" agrupa itens por horizonte: curto/médio/longo prazo.
2. Cada item mostra título, descrição, esforço, risco, impacto R$ e critério de conclusão.
3. Usuário pode marcar status (`pending`, `in_progress`, `blocked`, `done`, `abandoned`) com motivo.
4. No modo assisted, aprova/rejeita itens e depois aprova o mês.

## Estados importantes
- `analysisStatus`: `pending` | `generating` | `ready` | `delivered` | `approved` | `failed`.
- `horizon`: `short` | `medium` | `long`.
- `impactCents`: valores em centavos.
