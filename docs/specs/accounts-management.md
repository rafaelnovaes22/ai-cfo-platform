---
module_key: "accounts-management"
module_name: "Accounts Management — AP + AR"
wave: 6
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#17, #18, #19, #20"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Accounts Management — AP + AR

> Contas a pagar e a receber unificadas: gestão inteligente de pagamentos (priorização por relevância de fornecedor), gestão de recebíveis com previsão de inadimplência (modelo ML).

## Outcomes principais

- `payable_prioritized`: ordem de pagamento sugerida (priorização inteligente)
- `receivable_aged`: aging de recebíveis com risco
- `default_predicted`: previsão de inadimplência por cliente (probabilidade)

## Features cobertas (das 60 do Aicfo)

Identificadores: #17, #18, #19, #20

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module accounts-management` quando este módulo entrar em desenvolvimento (Onda 6).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
