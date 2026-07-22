# Backend — hub

**Status:** complete
**Commit:** 8f51c09
**Implementado em:** 2026-05-11

## Entregáveis

- `src/hub/routes.ts` — GET /hub (snapshot home), GET /analyses (histórico últimas 12)

## Comportamento

- GET /hub: retorna subscription (plan, mode, status) + latestAnalysis com DRE snapshot (5 métricas), cards por tipo, action plan summary por horizonte
- GET /analyses: lista as últimas 12 análises com status, impacto total e datas
- Sem LLM — consulta determinística ao banco
- Alimenta a tela home pós-login do frontend (latestAnalysis null quando ainda não há análise)
