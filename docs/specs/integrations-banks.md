---
module_key: "integrations-banks"
module_name: "Integrations — Bancos Multi-Conta"
wave: 4
tier: "C"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#1 (parte), #21"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Integrations — Bancos Multi-Conta

> Conexão OAuth/Open Finance com bancos brasileiros (Itaú, BB, Santander, Nubank, Inter, etc). Sincroniza saldo + extrato em tempo real. Multi-conta por tenant.

## Outcomes principais

- `bank_connected`: conta bancária autenticada e sincronizando
- `statement_synced`: extrato puxado, transações categorizadas
- `balance_updated`: saldo current atualizado em <5min

## Features cobertas (das 60 do Aicfo)

Identificadores: #1 (parte), #21

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module integrations-banks` quando este módulo entrar em desenvolvimento (Onda 4).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
