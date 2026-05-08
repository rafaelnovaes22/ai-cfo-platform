---
diagnostic_code: "{{ kebab-case }}"
target_client: "{{ Nome do cliente / 'genérico' se template padrão }}"
status: "draft|sold|in_delivery|delivered|converted|not_converted"
fee_brl: 0
delivery_days: 5
constitution_version: "0.2.0"
linked_proposal: "{{ path }}"
linked_unit_economics: "{{ path }}"
owners:
  consultant: ""
  technical_reviewer: ""
created_at: "{{ YYYY-MM-DD }}"
delivered_at: null
version: "0.1.0"
---

# Diagnostic Spec — {{ target_client }}

> Template para **Diagnóstico/Fase 0** — porta de entrada paga que precede oferta de Plataforma ou Produto.
> Para SKUs verticais, use [`platform-sku-spec.template.md`](./platform-sku-spec.template.md).
> Para produtos self-serve, use [`product-spec.template.md`](./product-spec.template.md).

---

## 1. Por que Diagnóstico (C1 — Diagnose-before-design)

Princípio fundador da Constitution. Diagnóstico:

- ✅ **Qualifica** o cliente (quem não topa pagar diagnóstico raramente vira cliente)
- ✅ **Mede baseline** (quanto custa hoje fazer manualmente)
- ✅ **Define outcome cobrável** (o que vai virar SKU/Produto)
- ✅ **Filtra incompatibilidade** antes de contrato grande

---

## 2. Objetivo único do diagnóstico

```
{{ Identificar 1-3 processos do cliente que satisfaçam critérios de
   automatização cobrável e propor pricing por outcome com baseline
   validada. }}
```

### O que NÃO é diagnóstico

- ❌ Consultoria estratégica geral
- ❌ Auditoria de TI ampla
- ❌ Roadmap de transformação digital
- ❌ Implementação de qualquer agente (isso é fase posterior)

---

## 3. Pricing e prazos

| Componente | Valor |
|---|---|
| Fee one-time | R$ {{ X }} (faixa típica: 5.000–10.000) |
| Prazo de entrega | {{ N }} dias úteis (recomendado: 5) |
| Abatimento se converter em Plataforma/Produto | {{ 100% / 50% / sem abatimento }} |
| Garantia | {{ devolver fee se não identificar ≥ 1 candidato qualificado / sem garantia }} |

**Justificativa do preço**:
```
{{ ... }}
```

---

## 4. Entregáveis

| # | Entregável | Formato |
|---|---|---|
| 1 | Relatório executivo (5–10 páginas) | PDF |
| 2 | 3 candidatos de processo automatizável com critérios aplicados | seção PDF |
| 3 | Baseline de custo atual por candidato | seção PDF |
| 4 | Definição operacional de outcome cobrável para o candidato top | seção PDF |
| 5 | Proposta de pricing | seção PDF |
| 6 | Sessão de devolução (1h, online ou presencial) | reunião |

---

## 5. Processo de execução em {{ N }} dias

| Dia | Atividade | Output |
|---|---|---|
| **D+1** | Sessão 90min com decisor (roteiro §6) | Transcrição |
| **D+1** | Auditoria de processos (com gestores) | Notas estruturadas |
| **D+2** | Auditoria de dados/ferramentas (read-only) | Inventário |
| **D+3** | Análise: identificar candidatos, validar critérios | Tabela analítica |
| **D+4** | Cálculo de unit economics + draft do relatório | Relatório draft |
| **D+5** | Revisão interna + sessão de devolução | Relatório final + sessão |

---

## 6. Roteiro da sessão 90min com decisor

> Adaptar conforme contexto. Estrutura padrão:

### Bloco 1 — Dor (15min)
- O que mais consome sua semana hoje?
- Quais 3 problemas mais te tiram o sono?
- O que você gostaria de "demitir"?

### Bloco 2 — Operação (30min)
- Quais processos a empresa repete mais?
- Em qual processo você vê o time perdendo mais tempo?
- Onde você sente que erra mais?
- Onde existe gargalo de pessoa (se X sair, para)?

### Bloco 3 — Volume e baseline (20min)
- Para cada candidato: quantas vezes/mês acontece?
- Quem executa? Quanto recebe? Quanto tempo leva?
- Quanto custa hoje fazer 1 unidade desse processo?

### Bloco 4 — Tolerância a erro (15min)
- Para cada candidato: o que acontece se errar?
- Erro é recuperável ou permanente?
- Quem audita / pega erros hoje?

### Bloco 5 — Disponibilidade de dados (10min)
- Esse processo deixa rastro digital? Onde?
- Quem tem acesso aos sistemas?
- Você consegue conectar com WhatsApp / email / planilha / ERP?

---

## 7. Critérios de qualificação por candidato

Cada candidato é avaliado contra 4 critérios. **Qualificado = 4/4**.

| Critério | Definição |
|---|---|
| **Repetitivo** | ≥ 50–100 execuções/mês no cliente típico |
| **Mensurável** | Evento binário "feito"/"não feito" claro |
| **Atribuível** | Isolável da operação humana paralela |
| **Tolerante a erro recuperável** | Erro não causa dano permanente |

| Candidato | Repetitivo | Mensurável | Atribuível | Tolerante | Total |
|---|---|---|---|---|---|
| C1 | {{ ✅/❌ }} | {{ ✅/❌ }} | {{ ✅/❌ }} | {{ ✅/❌ }} | {{ X/4 }} |
| C2 | {{ }} | {{ }} | {{ }} | {{ }} | |
| C3 | {{ }} | {{ }} | {{ }} | {{ }} | |
| C4 | {{ }} | {{ }} | {{ }} | {{ }} | |
| C5 | {{ }} | {{ }} | {{ }} | {{ }} | |

---

## 8. Recomendação top: candidato selecionado

| Campo | Valor |
|---|---|
| **Processo escolhido** | {{ ... }} |
| **Razão (vs outros candidatos)** | {{ ... }} |
| **Outcome unit proposto** | {{ ex: lead-qualificado }} |
| **Volume mensal estimado** | {{ N }} |
| **Baseline humano** | R$ {{ X }} por outcome (custo atual) |
| **Pricing proposto por outcome** | R$ {{ Y }} |
| **Setup fee proposto** | R$ {{ Z }} |
| **Plataforma mensal proposta** | R$ {{ W }}/mês |

---

## 9. Output do reviewer DeepAgent (auditoria)

Reviewer audita Diagnóstico contra Constitution:

- C1: ✅ Diagnóstico **é** o cumprimento do C1 — válido por construção
- C2: ✅/⚠️ outcome unit declarado e exemplos positivos/negativos
- C3: ✅/⚠️ unit economics projetados em §8 fazem sentido vs baseline
- C5: N/A em diagnóstico
- C6: N/A (diagnóstico não roda agente; só audita)

---

## 10. Material comercial

### Posicionamento (1 frase)

```
{{ ex: "Em 5 dias e por R$ 7.500, identificamos os 3 processos da
   sua empresa onde 1 agente de IA pode te economizar pelo menos
   100 horas-pessoa por mês — ou devolvemos seu dinheiro." }}
```

### Garantia visível ao cliente

- [ ] Identificar ≥ 1 candidato qualificado (4/4 critérios) ou devolução
- [ ] Sem garantia formal
- [ ] Outro: {{ ___ }}

---

## 11. Aprovação

- [ ] Cliente aprovou o relatório
- [ ] Cliente assinou contrato Plataforma/Produto subsequente OU declarou não-conversão
- [ ] Diagnóstico arquivado em `docs/diagnostics/`
- [ ] Reviewer DeepAgent registrou no relatório mensal

**Aprovado por**: `{{ nome }}` em `{{ data }}`

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | {{ YYYY-MM-DD }} | Spec inicial |
