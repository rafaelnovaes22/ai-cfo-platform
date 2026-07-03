# Runbook — Gate 2 (abrir 5000 clientes)

> Status 2026-07-03: **preparado, execução adiada** por decisão do Rafael até haver base pagante que justifique o custo do teste (~R$820). Tudo abaixo está pronto para rodar em uma sessão.

## Por que dá para esperar

Capacidade medida em staging (2026-07-03, 2 réplicas, `WORKER_CONCURRENCY_GRAPH=6`): **11,5 análises/min ≈ 690/h**, contra pico estimado de onboarding de 100-200/h (Anexo B do roadmap). Folga de 3-6× já no estado atual. O load test de 5000 é confirmação, não habilitação.

## O que já está pronto

| Item do gate | Estado |
|---|---|
| 2.3 Rate limit Redis-backed | ✅ Em produção (#285); calibrado 300/min global, 30/min auth |
| Backpressure (teto 1000 pendentes + 503) | ✅ Em produção (#277); validado a 200 burst |
| Réplicas GitOps | ✅ `numReplicas` no railway.toml (#291) |
| Runner modo burst (2.5) | ✅ `loadtest-run.mjs --mode=burst` (validado a 200) |
| Sampler Redis/backlog (2.4) | ✅ `loadtest-sample.mjs` |
| 5000 tenants de teste | ✅ Semeados em staging (`loadtest+1..5000@acme.test`) |
| 2.1 Teto de workers | Decidir no dia (ver alavancas abaixo) |
| 2.2 Breaking point Vertex | Pende do run de 5000 |
| 2.5 Load test 5000 | **ADIADO** — gate para abrir 5000 |

## Alavancas de escala (2.1)

Throughput escala ~linear com réplicas até o limite do Vertex: 6,2/min com 1 réplica → 11,5/min com 2 (medido). Alavancas, em ordem:
1. `numReplicas` no [railway.toml](../../railway.toml) (PR → deploy) — dobra web + worker juntos.
2. `WORKER_CONCURRENCY_GRAPH` (env por serviço) — só workers; pico Vertex = réplicas × concurrency × 6 chunks.
3. Se precisar separar web de worker no futuro, reavaliar a decisão do #286 com os dados do run de 500 (o split foi descartado lá).

## Execução (quando chegar a hora)

1. Envs em staging (janela do teste; reverter depois):
   `railway variables --service aicfo-staging --set "AUTH_RATE_LIMIT_MAX=10000" --set "RATE_LIMIT_MAX=10000" --set "WORKER_CONCURRENCY_GRAPH=12"`
   (os rate limits são artefato do IP único do teste; GRAPH=12 → 24 jobs, pico ~144 chamadas Vertex, é o experimento do 2.2)
2. Sampler em paralelo (Gate 2.4):
   `REDIS_URL=<Redis-staging público> node scripts/loadtest-sample.mjs --out=loadtest-5000.csv`
3. O run (Gate 2.5, wall ~4h com GRAPH=12):
   `tsx scripts/loadtest-run.mjs --mode=burst --count=5000 --inflight=50`
4. Pós-run: terminal states + custo por outcome via SQL (query no doc do [Gate 1.6](2026-07-03-loadtest-500-gate-1-6.md)); 429/fallback do Vertex nos logs do worker (`railway logs --filter "429 OR RESOURCE_EXHAUSTED OR fallback"`); pico de memória Redis no CSV.

## Critérios de aprovação (do plano)

- Fallback OpenAI segura os 429 do Vertex sem retry-storm (jobs terminam, custo monitorado)
- Backpressure degrada graciosamente (503 + retry, sem OOM/queda)
- Redis aguenta o backlog de pico (CSV: `used_memory` < `maxmemory` com folga)
- Zero análises zumbi (reaper) e `cost_per_outcome` dentro do C3

## Custo estimado do run

5000 × R$0,16 (média real medida com planilha de ano completo) ≈ **R$820**; pior caso com degradação/fallback ~R$2.200. Alternativa de baixo custo (~R$150-250): planilha sintética de 1 mês, com menos realismo de chunking.
