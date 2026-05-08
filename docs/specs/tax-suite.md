---
module_key: "tax-suite"
module_name: "Tax Suite — Controle Tributário"
wave: 5
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#34, #35, #36, #53"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Tax Suite — Controle Tributário

> Suite tributária: controle de impostos (DARFs, ISS, ICMS, etc), sugestão de regime ideal (Simples vs Presumido vs Real), alertas de risco fiscal, simulação de cenários tributários.

## Outcomes principais

- `tax_obligation_tracked`: obrigação tributária identificada com vencimento
- `tax_regime_suggested`: análise de qual regime minimiza carga
- `tax_risk_flagged`: alerta de risco fiscal (substitution tributária, DAS atrasado, etc)
- `tax_scenario_simulated`: simulação cenários (mudança regime, mudança CNAE, etc)

## Features cobertas (das 60 do Aicfo)

Identificadores: #34, #35, #36, #53

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module tax-suite` quando este módulo entrar em desenvolvimento (Onda 5).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
