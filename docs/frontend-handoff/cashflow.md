# Frontend Handoff — cashflow

## Responsabilidade
Visão de fluxo de caixa por período e granularidade.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| GET | `/cashflow?startDate&endDate&granularity&category&bankAccountId` | Dados do fluxo de caixa |
| GET | `/cashflow/summary?date` | Resumo do dia |

## Contrato
- OpenAPI: `docs/contracts/cashflow.openapi.yml`
- Zod: `docs/contracts/cashflow.zod.ts`

## Fluxo esperado na UI
1. Tela "Fluxo de Caixa" mostra saldo inicial, saldo acumulado, entradas, saídas e gráfico.
2. Seletor de granularidade: diário, semanal, mensal, trimestral.
3. Período é derivado do mês de referência da análise ativa.
4. Tabela detalhada por categoria com colunas de período.

## Estados importantes
- `granularity`: `daily` | `weekly` | `monthly` | `quarterly`.
- `openingBalanceCents`/`closingBalanceCents` podem ser `null` se não houver saldo anterior.
- Todos os valores monetários são em centavos.

## Telas relacionadas
- `/fluxo-de-caixa`
