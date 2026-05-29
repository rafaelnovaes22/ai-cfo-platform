---
module: cashflow
eval_method: assertion_shape
run_type: staging
base_url: https://aicfo-staging-production.up.railway.app
tenant_id: 23e198a7-e011-4eec-a4dc-957257443438
started_at: 2026-05-28T20:24:39.791Z
total_cases: 30
passed: 30
failed: 0
pass_rate: 100.0%
pass_rate_threshold: 100.0%
threshold_met: true
run_hash: bbd47e02
---

# Staging Run — cashflow — 2026-05-28

**Veredito**: ✅ APROVADO — pass rate 100.0% vs threshold 100%

## Resumo

| Métrica | Valor |
|---|---|
| Base URL | `https://aicfo-staging-production.up.railway.app` |
| Tenant | `23e198a7-e011-4eec-a4dc-957257443438` |
| Cenários executados | 30 |
| Passaram | 30 |
| Falharam | 0 |
| Pass rate | 100.0% |

## Resultados por cenário

| ID | Descrição | Status HTTP | Latência | Resultado | Falhas |
|---|---|---|---|---|---|
| R01 | Q1/2026 granularity=monthly | 200 | 625ms | ✅ | — |
| R02 | Janeiro/2026 granularity=monthly | 200 | 414ms | ✅ | — |
| R03 | H1/2026 granularity=monthly | 200 | 141ms | ✅ | — |
| R04 | Ano completo granularity=monthly | 200 | 147ms | ✅ | — |
| R05 | Fev/2026 granularity=monthly com category | 200 | 146ms | ✅ | — |
| R06 | Q2/2026 granularity=monthly | 200 | 140ms | ✅ | — |
| R07 | Q1/2026 granularity=quarterly | 200 | 139ms | ✅ | — |
| R08 | H1/2026 granularity=quarterly | 200 | 147ms | ✅ | — |
| R09 | Ano completo granularity=quarterly | 200 | 155ms | ✅ | — |
| R10 | Últimos 7 dias granularity=daily | 200 | 140ms | ✅ | — |
| R11 | Dia único granularity=daily | 200 | 155ms | ✅ | — |
| R12 | Janeiro granularity=daily | 200 | 151ms | ✅ | — |
| R13 | Q1 granularity=daily (stress 90d) | 200 | 142ms | ✅ | — |
| R14 | Janeiro granularity=weekly | 200 | 147ms | ✅ | — |
| R15 | Q1 granularity=weekly | 200 | 135ms | ✅ | — |
| R16 | GET /cashflow/summary hoje | 200 | 140ms | ✅ | — |
| R17 | GET /cashflow/summary data específica | 200 | 139ms | ✅ | — |
| R18 | GET /cashflow/summary data futura | 200 | 143ms | ✅ | — |
| R19 | Período futuro sem dados | 200 | 137ms | ✅ | — |
| R20 | Category inexistente no período | 200 | 157ms | ✅ | — |
| R21 | Q1 sem filtros — verifica estrutura completa | 200 | 137ms | ✅ | — |
| R22 | requestId presente no response | 200 | 155ms | ✅ | — |
| R23 | creditCount + debitCount consistente | 200 | 143ms | ✅ | — |
| R24 | 401 sem auth header | 401 | 131ms | ✅ | — |
| R25 | 400 startDate > endDate | 400 | 130ms | ✅ | — |
| R26 | 400 granularity inválida | 400 | 132ms | ✅ | — |
| R27 | Cross-tenant: ?tenantId ignorado | 200 | 139ms | ✅ | — |
| R28 | 365 dias granularity=daily (stress) | 200 | 145ms | ✅ | — |
| R29 | Category com caractere especial & | 200 | 148ms | ✅ | — |
| R30 | Q1 com table detalhada por categoria | 200 | 142ms | ✅ | — |

## Latência p95

p95: **414ms** (threshold: 800ms) ✅
