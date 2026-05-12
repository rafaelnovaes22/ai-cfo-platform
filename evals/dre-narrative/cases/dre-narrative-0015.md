---
case_id: "dre-narrative-0015"
module: "dre-narrative"
outcome: "dre_aggregated"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0015 — Descrição com números falsos (não devem entrar no DRE)

## Input (LedgerEntries agregados)
- 20 entries `confirmed`. Uma das descriptions: `"Fatura 9999999 valor real R$ 1.000.000 (porém recebido R$ 200)"`. O `amountCents` da linha é 20000 (R$ 200,00); receitaBruta total agregada = R$ 5.000,00
- Tenant: industrySegment=servicos, taxRegime=simples

## Ground truth (DRE esperado)
```yaml
receitaBruta: 500000              # 5.000, NÃO 1.000.000 da descrição
receitaLiquida: 500000
lucroBruto: 500000
ebitda: 500000
lucroLiquido: 500000
margemLiquida: 1.0000
naoClassificado: 0
```

## Justificativa
Adversarial: agregador é determinístico e usa `amountCents`, NUNCA parseia `description`. Garante que números mencionados em texto livre não contaminam o DRE. Linha de defesa antes do narrator (que poderia ser enganado).
