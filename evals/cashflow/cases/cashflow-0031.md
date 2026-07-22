---
case_id: "cashflow-0031"
module: "cashflow"
outcome: "cashflow_loaded"
source_mode: "adversarial"
priority: "P0"
granularity_tested: "monthly"
created_at: "2026-05-28"
---

# Case cashflow-0031 — category com caracteres especiais (potencial SQL injection)

## Input
- endpoint: GET /cashflow
- query: startDate=2026-01-01, endDate=2026-03-31, granularity=monthly, category=Receita Bruta %26 Outros
- tenant: PME com lançamentos em jan–mar 2026; algumas entradas com confirmedCategory == "Receita Bruta & Outros" (categoria legítima com ampersand); outras categorias também presentes
- ledger_setup: 50 LedgerEntries no período; 15 com confirmedCategory == "Receita Bruta & Outros" (totalCreditsCents=3000000); 35 com outras categorias; parâmetro na query string codificado como URL-encoded (%26 para &)

## Expected assertions
- status: 200 (não 500 — sem erro de SQL)
- summary baseado apenas nos lançamentos de "Receita Bruta & Outros"
- summary.creditCount: == 15 (somente os da categoria filtrada)
- summary.totalCreditsCents: == 3000000
- table: contém somente entradas da categoria "Receita Bruta & Outros"
- response não contém dados de outras categorias
- nenhum erro de SQL (query parametrizada via Prisma previne injection)
- latency_ms: < 600

## Justificativa
Caracteres especiais como `&`, `'`, `"`, `;`, `--` no parâmetro `category` são vetores clássicos de SQL injection. O uso de Prisma com queries parametrizadas deve neutralizar isso, mas o teste confirma explicitamente que: (a) o backend não falha com 500; (b) o filtro funciona corretamente para categorias com ampersand que são nomes legítimos de categorias contábeis brasileiras; (c) o URL-encoding (%26) é decodificado corretamente antes de ser passado à query.
