---
case_id: "cashflow-0023"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0023 — JWT expirado

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-01-31, granularity=monthly
- tenant: tenant válido, mas o token JWT possui `exp` no passado (ex: expirado há 2 horas)
- ledger_setup: não relevante; a requisição deve ser rejeitada no middleware de auth antes de atingir o handler

## Expected assertions
- status: 401
- body.type: string (URI de erro)
- body.title: string contendo "Unauthorized" ou "Token expired" ou equivalente
- body.status: == 401
- Content-Type: "application/problem+json"
- response não contém nenhum campo financeiro (sem `summary`, `chart`, `table`)
- latency_ms: < 200

## Justificativa
Token expirado é uma condição de autenticação comum em SPAs após o usuário deixar a aba aberta. O middleware deve rejeitar o token expirado com 401, não com 403 (que indicaria token válido mas sem permissão) nem 500. O ProblemDetail ajuda o frontend a diferenciar "precisa logar novamente" de outros erros e acionar o fluxo de refresh token automaticamente.
