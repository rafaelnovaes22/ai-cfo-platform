---
module_key: "bank-reconciliation"
module_name: "Bank Reconciliation — Conciliação Bancária"
wave: 6
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#9"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Bank Reconciliation — Conciliação Bancária

> Conciliação automática entre extrato bancário (módulo banks) e lançamentos contábeis. Casamento por valor + data + descrição (fuzzy). Tier C porque erros viram problema contábil.

## Outcomes principais

- `transaction_reconciled`: lançamento casado com transação bancária
- `reconciliation_partial`: casamento parcial, requer revisão manual
- `reconciliation_drift`: divergência sustentada → alerta P1

## Features cobertas (das 60 do Aicfo)

Identificadores: #9

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/novais-digital:spec --module bank-reconciliation` quando este módulo entrar em desenvolvimento (Onda 6).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
