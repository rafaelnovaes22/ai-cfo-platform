---
module_key: "anomaly-fraud-detection"
module_name: "Anomaly & Fraud Detection"
wave: 7
tier: "B"
status: "stub"
constitution_version: "0.2.0"
features_covered: "#15 (versão dedicada), #16"
created_at: "2026-05-08"
last_updated: "2026-05-08"
---

# Anomaly & Fraud Detection

> Detecção dedicada de anomalias estatísticas (variação >Nσ) e padrões de fraude/desvio (lançamentos duplicados, valores arredondados suspeitos, fornecedores recém-criados, etc).

## Outcomes principais

- `anomaly_detected`: anomalia estatística sinalizada com evidência
- `fraud_pattern_flagged`: padrão suspeito detectado (Benford, duplicates, etc)
- `investigation_opened`: incidente formal aberto pra audit-governance

## Features cobertas (das 60 do Aicfo)

Identificadores: #15 (versão dedicada), #16

Mapeamento completo em [`docs/product-vision.md`](../product-vision.md).

## Detalhamento

**Status atual: stub** — spec detalhada será gerada via `/acme:spec --module anomaly-fraud-detection` quando este módulo entrar em desenvolvimento (Onda 7).

A geração detalhada incluirá:
- Cláusula de outcome (C2)
- Endpoints expostos pelo backend
- Pipeline de agentes (se aplicável)
- Eval suite mínima (≥10 casos por outcome)
- Unit economics se houver custo de inferência relevante (C3)
- Riscos específicos
- Configuração por tenant (C8)
