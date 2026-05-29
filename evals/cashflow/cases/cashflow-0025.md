---
case_id: "cashflow-0025"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0025 — startDate > endDate (intervalo de datas invertido)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-03-31, endDate=2026-01-01, granularity=monthly
- tenant: tenant válido com lançamentos no período jan–mar 2026
- ledger_setup: não relevante; a validação deve ocorrer antes de qualquer query ao banco

## Expected assertions
- status: 400
- body.type: string (URI de erro, ex: "https://aicfo.com.br/errors/validation-error")
- body.title: string contendo "Bad Request" ou "Validation Error" ou equivalente
- body.status: == 400
- body.detail: string descrevendo o problema (ex: "startDate must be before or equal to endDate")
- Content-Type: "application/problem+json"
- response não contém campos `summary`, `chart`, `table`
- latency_ms: < 200

## Justificativa
Uma data inicial posterior à data final é logicamente inválida e o Zod schema de validação deve rejeitar antes de qualquer acesso ao banco — tanto por segurança (prevenção de queries malformadas) quanto por experiência do usuário (mensagem de erro clara). O ProblemDetail com `detail` descritivo permite que o frontend exiba a mensagem de validação diretamente no campo de data sem lógica extra.
