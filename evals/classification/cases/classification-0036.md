---
case_id: "classification-0036"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-06-11"
---

# Case classification-0036 — Serviço-fim de produtora de conteúdo (receita, não despesa)

## Input (LedgerEntry)
- `description`: "Cobertura jornalística evento - Sindicato Comerciários"
- `amountCents`: 450000
- `direction`: "unknown"
- `date`: "2026-04-22"
- `tenant_context`: { industrySegment: "geral", taxRegime: "simples_nacional" }
- `business_profile`: "Produtora de conteúdo / assessoria de imprensa. Receita-fim: cobertura jornalística, assessoria de imprensa, locução, narração, produção de podcast/vídeo — serviços vendidos a clientes."

## Ground truth
```yaml
expected_category: "receita_bruta"
expected_confidence_min: 0.80
acceptable_alternatives: []
```

## Justificativa
Regressão do extrato real CID & CID (2026-06-11): sem contexto de negócio, "cobertura jornalística" era classificada como `despesas_comerciais` (como se a empresa contratasse cobertura). Com o perfil inferido dos lançamentos, o classificador reconhece que é o serviço-fim que a produtora VENDE → `receita_bruta`. Direção `unknown` força a decisão pela semântica + perfil.

## Tags
real, receita-servico-fim, business-profile, regressao-cid
