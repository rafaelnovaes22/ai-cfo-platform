---
case_id: "classification-0039"
module: "classification"
outcome: "ledger_classified"
source_mode: "real"
priority: "P1"
created_at: "2026-06-15"
---

# Case classification-0039 — Serviço CONTRATADO de freelancer é custo (mesma produtora)

## Input (LedgerEntry)
- `description`: "Locução freelancer convidado (voz feminina)"
- `amountCents`: 150000
- `direction`: "unknown"
- `date`: "2026-04-18"
- `business_profile`: "A empresa presta serviços de produção de conteúdo audiovisual e comunicação; a receita vem de edição de vídeo, assessoria de imprensa, produção de reels, cobertura de eventos, produção de podcast e locução institucional/comercial para clientes. Custos incluem aluguel de estúdio, softwares, impulsionamento, deslocamento, freelancers e honorários contábeis."

## Ground truth
```yaml
expected_category: "custo_servicos"
expected_confidence_min: 0.6
acceptable_alternatives: ["despesas_pessoal"]
```

## Justificativa
Contrasta com classification-0038: aqui a empresa CONTRATA um freelancer de locução (serviço de terceiros) — é custo_servicos, não receita. Mesmo com a palavra "locução" e o mesmo perfil, "freelancer convidado" indica serviço contratado pela empresa. Valida a distinção serviço prestado (receita) vs contratado (despesa).

## Tags
real, custo-servico-contratado, produtora, direction-unknown
