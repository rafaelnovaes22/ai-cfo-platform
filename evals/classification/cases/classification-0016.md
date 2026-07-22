---
case_id: "classification-0016"
module: "classification"
outcome: "ledger_classified"
source_mode: "synthetic"
priority: "P1"
created_at: "2026-05-12"
---

# Case classification-0016 — Custo direto de serviço (sub-contratado)

## Input (LedgerEntry)
- `description`: "PAGAMENTO SUBCONTRATADO PROJETO CLIENTE BETA"
- `amountCents`: 320000
- `direction`: "debit"
- `date`: "2026-04-25"
- `tenant_context`: { industrySegment: "servicos_gerais", taxRegime: "lucro_presumido" }

## Ground truth
```yaml
expected_category: "custo_servicos"
expected_confidence_min: 0.75
acceptable_alternatives: ["despesas_pessoal"]
```

## Justificativa
Sub-contratado alocado a projeto de cliente é custo direto de entrega de serviço (`custo_servicos` — CSP). Modelo pode confundir com `despesas_pessoal` se interpretar como freelancer genérico; alternativa aceitável.

## Tags
synthetic, csp, subcontratado
