---
target_artifact: "{{ ex: products/novais-digital-fin/spec.md OR src/skus/triagem-comercial/spec.md }}"
artifact_type: "product|platform-sku|diagnostic"
current_stage: "discovery|mvp|beta|ga|maturity|sunset"
constitution_version: "0.2.0"
last_review: "{{ YYYY-MM-DD }}"
next_review: "{{ YYYY-MM-DD + 30d }}"
version: "0.1.0"
---

# Lifecycle Stage — {{ target_artifact }}

> Template para declarar e justificar o **stage** atual de um agente/produto/SKU.
> Cada stage tem critérios objetivos para promover ao próximo.
> Reviewer DeepAgent valida se artefatos correspondem ao stage declarado.

---

## 1. Stage atual

**Status declarado**: `{{ current_stage }}`

**Justificativa do stage**:
```
{{ Por que este artefato está neste stage hoje. Cite métricas, datas,
   eventos relevantes. }}
```

---

## 2. Definição dos stages

### Discovery
**O que é**: hipótese de produto/SKU, sem código de produção, sem usuários.
**Objetivo**: validar problema vale a pena resolver.
**Atividades típicas**: pesquisa de cliente, prototipagem, benchmarks.

### MVP (Minimum Viable Product)
**O que é**: versão mínima com código rodando, mas não vendível ainda.
**Objetivo**: validar que tecnologia entrega outcome em condições controladas.
**Atividades típicas**: smoke tests, demo internas, ajustes de prompt.

### Beta
**O que é**: produto/SKU operando com **usuários reais** mas com:
- Pricing subsidiado ou gratuito
- Comunicação clara de "estamos em beta"
- Volumes baixos (< N usuários ou < M outcomes/mês)
- Sem SLA contratual

**Objetivo**: descobrir problemas reais de produção e ajustar antes de cobrança plena.

### GA (General Availability)
**O que é**: produto/SKU vendável com pricing pleno, SLA contratual, comunicação comercial pública.
**Objetivo**: gerar receita recorrente / outcomes cobráveis em volume.

### Maturity
**O que é**: produto/SKU estável, sem mudanças disruptivas, otimização contínua.
**Objetivo**: maximizar margem; reduzir custos; aumentar retenção.

### Sunset
**O que é**: produto/SKU descontinuado, em fase de desligamento.
**Objetivo**: migrar usuários, encerrar contratos, remover código legacy.

---

## 3. Critérios para promover ao próximo stage

### Promover Discovery → MVP

- [ ] Pesquisa de cliente concluída (≥ N entrevistas)
- [ ] Hipótese de outcome cobrável formulada (cláusula §1 da spec)
- [ ] Prototipagem funcional em sandbox
- [ ] Time tem capacidade alocada para construção
- [ ] Aprovação do mantenedor/decisor

### Promover MVP → Beta

- [ ] Código deploy-ready em ambiente de produção
- [ ] Telemetria Langfuse instrumentada (C6)
- [ ] Eval suite com ≥ 10 casos passing
- [ ] Termos de uso de Beta redigidos (se produto self-serve)
- [ ] Sistema de coleta de feedback de beta users
- [ ] Comunicação clara de "produto em beta"

### Promover Beta → GA

- [ ] Eval suite com ≥ 30 casos passing
- [ ] Threshold de qualidade atingido em produção (definido por SKU/produto)
- [ ] Razão custo/preço ≤ 25% validada com volume real (C3)
- [ ] Sem incidente P0 nos últimos 30 dias
- [ ] Termos de uso GA aprovados juridicamente
- [ ] Pricing GA definido e comunicável
- [ ] Reviewer DeepAgent emitiu auditoria mensal sem FAIL crítico
- [ ] ≥ N usuários/clientes ativos no Beta

### Promover GA → Maturity

- [ ] Produto/SKU estável por ≥ 6 meses
- [ ] Churn mensal ≤ X%
- [ ] Margem operacional ≥ Y%
- [ ] Roadmap de melhorias incrementais (não disruptivas)
- [ ] Documentação completa para suporte

### Promover Maturity → Sunset

- [ ] Decisão estratégica de descontinuação documentada (ADR)
- [ ] Comunicação aos usuários ≥ 90 dias antes
- [ ] Migração para alternativa proposta (se houver)
- [ ] Plano de remoção de código legado

---

## 4. Métricas vigentes

### Stage atual ({{ current_stage }})

Registre métricas relevantes ao stage:

| Métrica | Valor atual | Meta para próximo stage | Status |
|---|---|---|---|
| Usuários ativos | {{ N }} | {{ ≥ M }} | {{ ✅/⚠️/❌ }} |
| Eval cases passing | {{ X }} | {{ ≥ Y }} | {{ ... }} |
| Razão custo/preço (C3) | {{ X% }} | {{ ≤ 25% }} | {{ ... }} |
| Incidentes P0 (30d) | {{ N }} | 0 | {{ ... }} |
| {{ outras }} | {{ }} | {{ }} | {{ }} |

---

## 5. Bloqueios para promoção

Liste o que falta para promover ao próximo stage:

| Bloqueio | Owner | Prazo |
|---|---|---|
| {{ ex: precisa de 20 mais casos de eval }} | {{ nome }} | {{ data }} |
| {{ ... }} | {{ }} | {{ }} |

---

## 6. Histórico de stages

| Stage | Entrou em | Saiu em | Motivo |
|---|---|---|---|
| {{ ex: Discovery }} | {{ 2026-01-15 }} | {{ 2026-02-20 }} | Promoção para MVP |
| {{ ex: MVP }} | {{ 2026-02-20 }} | {{ ... }} | {{ ... }} |
| {{ stage atual }} | {{ ... }} | — | em curso |

---

## 7. Próxima revisão

**Data**: {{ next_review }}

**Trigger**:
- [ ] Revisão calendarizada (default: 30 dias)
- [ ] Trigger por evento (ex: atingir N usuários, fechar Q sem incidente)
- [ ] Trigger por reviewer (auditoria mensal sinalizou)

---

## 8. Aprovação

- [ ] Mantenedor leu e aprovou stage atual
- [ ] Métricas (§4) verificáveis e fresh (≤ 7 dias)
- [ ] Bloqueios (§5) priorizados em backlog do projeto consumidor

**Aprovado por**: `{{ nome }}` em `{{ data }}`
