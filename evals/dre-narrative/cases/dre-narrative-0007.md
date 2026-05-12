---
case_id: "dre-narrative-0007"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "synthetic"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0007 — Precedência confirmedCategory > predictedCategory

## Input (LedgerEntries agregados)
- 100 entries: 60 com `confirmedCategory="receitaBruta"` (R$ 60.000,00) + 40 com `predictedCategory="cmv"` mas `confirmedCategory="despesasAdministrativas"` (R$ 4.000,00)
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 6000000
cmv: 0                       # predicted ignorado porque confirmed existe
despesasAdministrativas: 400000
totalDespesasOperacionais: 400000
ebitda: 5600000
margemLiquida: 0.9333
naoClassificado: 0
```

## Justificativa
Valida precedência declarada na §4: quando `confirmedCategory != null`, `predictedCategory` é ignorado. Os 40 entries com confirmed=despesasAdministrativas vão para essa linha, NÃO para cmv. Exemplo NEGATIVO §1.1 da spec.
