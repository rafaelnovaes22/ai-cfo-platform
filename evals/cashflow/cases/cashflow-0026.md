---
case_id: "cashflow-0026"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "n/a"
created_at: "2026-05-28"
---

# Case cashflow-0026 — granularity com valor inválido ("anual")

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-12-31, granularity=anual
- tenant: tenant válido com lançamentos ao longo de 2026
- ledger_setup: não relevante; a validação do enum deve ocorrer antes de qualquer query ao banco

## Expected assertions
- status: 400
- body.type: string (URI de erro)
- body.title: string contendo "Bad Request" ou "Validation Error"
- body.status: == 400
- body.detail: string mencionando o campo `granularity` e os valores aceitos (ex: "granularity must be one of: daily, weekly, monthly, quarterly")
- Content-Type: "application/problem+json"
- response não contém campos `summary`, `chart`, `table`
- latency_ms: < 200

## Justificativa
O campo `granularity` é um enum Zod com valores fixos (daily, weekly, monthly, quarterly). Valores fora do enum devem ser rejeitados com 400 e mensagem que liste as opções válidas — evita que o backend tente processar uma granularidade desconhecida, o que poderia causar divisão por zero, loop infinito ou resultado incorreto na agregação do chart. A mensagem de detalhe com os valores válidos acelera o debugging durante integração do frontend.
