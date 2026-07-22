---
module_key: "billing"
module_name: "Billing (Stripe)"
wave: 0
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "(modelo SaaS²)"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Billing (Stripe)

> Cobrança self-serve via Stripe — planos Lite/Pro/Business, invoices, upgrades/downgrades, webhook de pagamento.

## Outcomes principais

- `subscription_started`: plano ativo, cobrança recorrente configurada
- `payment_processed`: invoice paga, sem dunning
- `plan_changed`: upgrade/downgrade efetivado

## Features cobertas (das 60 do Aicfo)

Identificadores: (modelo SaaS²)

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module billing` quando este módulo entrar em desenvolvimento (Onda 0).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
