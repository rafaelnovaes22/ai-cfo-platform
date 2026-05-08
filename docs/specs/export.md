---
module_key: "export"
module_name: "Export — Relatórios Exportáveis"
wave: 1
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#28, #29, #30"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Export — Relatórios Exportáveis

> Gera PDF/Excel da análise mensal em 3 sabores: Mensal (interno), Investidores (com KPIs comerciais), Sócios (focado em distribuição/dividendos).

## Outcomes principais

- `report_exported_monthly`: PDF mensal gerado
- `report_exported_investors`: PDF investidores com KPIs (#24)
- `report_exported_partners`: PDF sócios com cálculo de distribuição

## Features cobertas (das 60 do Aicfo)

Identificadores: #28, #29, #30

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module export` quando este módulo entrar em desenvolvimento (Onda 1).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
