---
case_id: "{{ sku_code }}-{{ NNNN }}"
sku_code: "{{ sku_code }}"
category: "{{ codigo-categoria }}"
expected_outcome_status: "{{ DELIVERED / SKIPPED / FLAGGED }}"
created_by: "{{ nome ou Eval Engineer }}"
created_at: "{{ YYYY-MM-DD }}"
source: "{{ real-tenant / synthetic / edge-case / regression }}"
tenant_anonymized: true
priority: "{{ P0 / P1 / P2 }}"
tags: ["{{ tag1 }}", "{{ tag2 }}"]
---

# Eval Case {{ case_id }}

> Caso de eval suite para o SKU `{{ sku_code }}`. Roda automaticamente em `npm run eval:{{ sku_code }}` e em `/acme:eval`.

---

## 1. Cenário

{{ Descrição em 1-2 frases do que está acontecendo neste caso.
   Ex: "Cliente novo entra em contato via WhatsApp pedindo proposta para serviço fora do escopo do tenant" }}

---

## 2. Input

### 2.1. Payload bruto

```json
{
  "channel": "{{ whatsapp/email/webhook }}",
  "raw_message": "{{ texto cru exatamente como recebido }}",
  "metadata": {
    "from": "{{ identificador anonimizado }}",
    "timestamp": "{{ ISO-8601 }}",
    "{{ outros campos }}": "{{ ... }}"
  }
}
```

### 2.2. Contexto do tenant (L0/L1)

```yaml
tenant_dna_summary: |
  {{ trecho relevante do DNA, anonimizado }}
icp_match: {{ true / false }}
tenant_offerings_relevant:
  - "{{ oferta 1 se relevante }}"
baseline_cost_per_outcome: R$ {{ X }}
```

---

## 3. Output esperado (gabarito)

### 3.1. Classificação esperada

```yaml
category: "{{ codigo-categoria }}"
confidence_min: 0.{{ X }}
outcome_status: "{{ DELIVERED / SKIPPED / FLAGGED }}"
```

### 3.2. Reasoning esperado (pontos que o agente DEVE cobrir)

- [ ] {{ ponto crítico 1 — ex: "identificar que pedido está fora do ICP" }}
- [ ] {{ ponto crítico 2 — ex: "não encaminhar para SDR" }}
- [ ] {{ ponto crítico 3 — ex: "responder com cortesia indicando que não é o serviço" }}

### 3.3. Ação esperada (output do composer)

```text
{{ Texto exato ou padrão que o agente deve produzir (ou rejeitar produzir) }}
```

### 3.4. Custo aceitável

- Custo máximo por outcome neste caso: R$ {{ X }} (≤ 25% do preço — C3)

---

## 4. Justificativa do gabarito

{{ Por que essa é a resposta certa? Qual o raciocínio humano por trás?
   Que regra de negócio do tenant está sendo aplicada? }}

> Esta seção é o que o reviewer DeepAgents/GPT-5.5 lê para entender o gabarito quando audita disagreements.

---

## 5. Casos relacionados

- **Variação positiva**: `{{ case-id }}` (mesma categoria, condições levemente diferentes)
- **Caso negativo paralelo**: `{{ case-id }}` (parece igual, mas não conta)
- **Edge case derivado**: `{{ case-id }}` (foi descoberto a partir deste)

---

## 6. Histórico de execução (preenchido pelo runner)

| Data | Modelo | Resultado | Acurácia | Notas |
|---|---|---|---|---|
| {{ auto-preenchido }} | {{ ... }} | {{ PASS/FAIL }} | {{ ... }} | {{ ... }} |

---

## 7. Curador (humano que assinou o gabarito)

- **Nome**: {{ ... }}
- **Função**: {{ PO Guardian / SDR sênior / domain expert }}
- **Data**: {{ YYYY-MM-DD }}
- **Confiança no gabarito**: {{ alta / média / baixa - se baixa, justificar }}

---

## 8. Anotações para drift detection

> Se este caso começar a falhar consistentemente em produção, o reviewer abre issue. Pontos a observar:

- {{ ex: "se modelo passar a classificar como categoria X, investigar drift de prompt" }}
- {{ ex: "se custo subir > R$ Y, investigar growth de contexto" }}
