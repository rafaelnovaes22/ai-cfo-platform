---
case_id: "cashflow-0022"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0022 — Requisição sem Authorization header

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-01-31, granularity=monthly
- tenant: n/a (requisição anônima)
- ledger_setup: não relevante; a requisição não deve chegar ao layer de dados

## Expected assertions
- status: 401
- body.type: string (URI de erro, ex: "https://example.com/errors/unauthorized")
- body.title: string contendo "Unauthorized" ou equivalente
- body.status: == 401
- Content-Type: "application/problem+json" (RFC 7807 ProblemDetail)
- latency_ms: < 200

## Justificativa
Gate de segurança P0: endpoint protegido não deve retornar nenhum dado financeiro sem autenticação válida. Além do status 401, o formato ProblemDetail (RFC 7807) é obrigatório para consistência com o contrato de erros do Fastify definido no projeto. A ausência de Authorization header é o vetor de ataque mais básico e deve ser bloqueado no middleware de autenticação antes de qualquer acesso ao banco.
