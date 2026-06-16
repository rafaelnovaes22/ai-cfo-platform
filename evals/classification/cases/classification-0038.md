---
case_id: "classification-0038"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P0"
created_at: "2026-06-15"
---

# Case classification-0038 — Serviço-fim prestado a cliente é receita (produtora)

## Input (LedgerEntry)
- `description`: "Locução comercial rádio - Supermercados Preço Bom"
- `amountCents`: 730000
- `direction`: "unknown"
- `date`: "2026-04-30"
- `business_profile`: "A empresa presta serviços de produção de conteúdo audiovisual e comunicação; a receita vem de edição de vídeo, assessoria de imprensa, produção de reels, cobertura de eventos, produção de podcast e locução institucional/comercial para clientes. Custos incluem aluguel de estúdio, softwares, impulsionamento, deslocamento, freelancers e honorários contábeis."

## Ground truth
```yaml
expected_category: "receita_bruta"
expected_confidence_min: 0.7
acceptable_alternatives: []
```

## Justificativa
A empresa é produtora de mídia. "Locução comercial rádio - Supermercados Preço Bom" é serviço PRESTADO ao cliente (o supermercado) — receita_bruta, mesmo com direction=unknown e a palavra "comercial". Sem o perfil do negócio injetado, o classificador tendia a custo_servicos e o resolveDirectionFix propagava o erro para a direção (bug visto em prod 2026-06-15).

## Tags
real, receita-servico-fim, produtora, direction-unknown
