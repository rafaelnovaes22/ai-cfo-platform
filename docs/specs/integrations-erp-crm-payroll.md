---
module_key: "integrations-erp-crm-payroll"
module_name: "Integrations — ERP + CRM + Folha"
wave: 4
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#1 (resto), #38, #39"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Integrations — ERP + CRM + Folha

> Conectores com ERPs (Omie, ContaAzul, Bling), CRMs (HubSpot, RD, Pipedrive) e sistemas de folha (Sólides, Convenia). Webhooks bidirecionais.

## Outcomes principais

- `erp_connected`: ERP autenticado, sincronizando lançamentos
- `crm_pipeline_synced`: oportunidades trazidas pro forecast
- `payroll_imported`: folha importada como linha do DRE

## Features cobertas (das 60 do Aicfo)

Identificadores: #1 (resto), #38, #39

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module integrations-erp-crm-payroll` quando este módulo entrar em desenvolvimento (Onda 4).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
