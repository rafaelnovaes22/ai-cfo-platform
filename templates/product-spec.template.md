---
product_code: "{{ kebab-case }}"
product_name: "{{ Nome humano legível }}"
category: "self-serve-product"
status: "discovery|mvp|beta|ga|maturity|sunset"
constitution_version: "0.2.0"
linked_diagnostic: "{{ docs/diagnostics/{cliente}.md or N/A se produto self-serve }}"
linked_unit_economics: "{{ path }}"
linked_lifecycle: "{{ path }}"
owners:
  product_lead: ""
  tech_lead: ""
created_at: "{{ YYYY-MM-DD }}"
last_updated: "{{ YYYY-MM-DD }}"
version: "0.1.0"
---

# Product Spec — {{ product_name }}

> Template para **produtos self-serve** onde o cliente loga e consome via UI.
> Para SKUs verticais (cliente não loga, entrega async), use [`platform-sku-spec.template.md`](./platform-sku-spec.template.md).
> Para Diagnóstico/Fase 0, use [`diagnostic-spec.template.md`](./diagnostic-spec.template.md).

---

## 1. Cláusula de outcome (C2 — obrigatório)

### 1.1. Definição em uma frase

```
{{ Produto entrega X quando cliente faz Y, mediante condições Z }}
```

> Exemplo (Acme Fin): *"Análise financeira mensal entregue quando cliente importa ≥ N lançamentos, gerando DRE estruturado + 3 cards de Leitura da história + Plano de ação com R$ projetado."*

### 1.2. Outcomes principais cobráveis

Liste os outcomes **mensuráveis** que o produto entrega. Mesmo em pricing por mensalidade fixa, outcomes precisam estar declarados (alimentam reviewer + drift detection):

| # | Outcome | Definição | Frequência típica |
|---|---|---|---|
| 1 | `{{ codigo }}` | {{ ... }} | {{ por mês/semana/sob demanda }} |
| 2 | `{{ codigo }}` | {{ ... }} | {{ ... }} |
| 3 | `{{ codigo }}` | {{ ... }} | {{ ... }} |

### 1.3. Três exemplos POSITIVOS (casos onde produto entrega valor)

| # | Cenário | Output esperado |
|---|---|---|
| 1 | {{ ... }} | {{ ... }} |
| 2 | {{ ... }} | {{ ... }} |
| 3 | {{ ... }} | {{ ... }} |

### 1.4. Três exemplos NEGATIVOS (casos onde produto NÃO deve gerar output)

| # | Cenário | Por que não entrega |
|---|---|---|
| 1 | {{ ... }} | {{ ... }} |
| 2 | {{ ... }} | {{ ... }} |
| 3 | {{ ... }} | {{ ... }} |

### 1.5. Termos de uso visíveis ao cliente

Diferente da Plataforma (cláusula contratual custom), produtos self-serve têm **Termos de Uso** padronizados:

```
{{ Cliente concorda que produto X gera Y mediante Z. Limites de uso:
   - {{ limite 1 }}
   - {{ limite 2 }}
   Garantias:
   - {{ garantia 1 }}
   Não garante:
   - {{ ... }} }}
```

---

## 2. ICP do produto

| Campo | Valor |
|---|---|
| **Persona primária** | {{ ex: sócio de PME, controller, contador, gestor financeiro }} |
| **Tamanho de empresa** | {{ ex: 1-50 funcionários, faturamento R$ 500k-5M }} |
| **Vertical** | {{ ex: agnóstico, agências, indústria leve }} |
| **Pain principal** | {{ ex: não tem visibilidade financeira sem pagar consultor }} |
| **Como descobre o produto** | {{ ex: SEO, anúncio, indicação, marketplace }} |

> ICP de Produto pode diferir do ICP da Plataforma high-touch. Documentar separadamente.

---

## 3. UX e fluxo

### 3.1. Onboarding

```
{{ Tela 1 → Tela 2 → ... → Primeira interação útil
   Tempo total esperado: < N minutos }}
```

### 3.2. Telas principais

Liste as 3-7 telas centrais do produto:

| # | Tela | Função | Ação principal |
|---|---|---|---|
| 1 | {{ Hub / Dashboard }} | {{ visão geral }} | {{ ver análise atual }} |
| 2 | {{ Detalhe }} | {{ ... }} | {{ ... }} |
| 3 | {{ ... }} | {{ ... }} | {{ ... }} |

### 3.3. Inputs do cliente

Como dados entram no produto:

- [ ] Upload de arquivo ({{ formatos }})
- [ ] Integração via OAuth ({{ provedores }})
- [ ] Lançamento manual em formulário
- [ ] Webhook / API
- [ ] Outros: {{ ... }}

---

## 4. Pipeline de agentes

### 4.1. Agentes/etapas internas (não-visível ao cliente)

| Etapa | Agente | Modelo | Responsabilidade | Output |
|---|---|---|---|---|
| 1 | `{{ ingestor }}` | {{ Sonnet }} | Parsing/validação do input | {{ schema }} |
| 2 | `{{ analyzer }}` | {{ Opus/Sonnet }} | Análise primária | {{ ... }} |
| 3 | `{{ composer }}` | {{ Sonnet }} | Geração do output final | {{ ... }} |
| 4 | `{{ qa-gate }}` | (regra) | Validação automática | passa ou retry |

### 4.2. Telemetria (C6)

Toda chamada LLM precisa estar instrumentada. Template:

```ts
import { langfuseTrace } from "@/observability/{{ provider }}";

const trace = langfuseTrace.observe({
  name: "{{ agent_name }}",
  input: { tenantId, payload },
  metadata: { product: "{{ product_code }}", outcomeType: "{{ ... }}" },
});
const response = await llm.call(...);
trace.end({ output: response, costBrl: calculateCost(response.usage) });
```

---

## 5. Eval suite

- **Localização**: `evals/{{ product_code }}/cases/`
- **Casos mínimos**: 30 (gate de promoção Beta → GA)
- **Cobertura**: cada outcome principal (§1.2) tem ≥ 10 casos
- **Atualização**: trimestral OU após drift detectado pelo reviewer

Cada caso usa [`templates/eval-case.template.md`](./eval-case.template.md).

---

## 6. Unit economics

> Detalhe completo em arquivo separado linkado em `linked_unit_economics`. Resumo:

| Métrica | Valor |
|---|---|
| Custo médio inferência por outcome principal | R$ {{ X }} |
| Custo médio mensal por usuário ativo | R$ {{ X }} |
| Pricing (ARPU mensal) | R$ {{ X }} |
| **Razão custo/preço** | **{{ X }}%** {{ ✅ ≤25% / ❌ }} |
| CAC blended estimado | R$ {{ X }} |
| Payback estimado | {{ N meses }} |

> C3 aplica como `custo_inferência_mensal_por_usuário ≤ 25% × ARPU`.

---

## 7. Lifecycle stage atual

Status declarado no frontmatter (`status: discovery|mvp|beta|ga|maturity|sunset`).

| Stage atual | Critérios para promover |
|---|---|
| **{{ status }}** | {{ ver linked_lifecycle.md }} |

Detalhe em [`templates/lifecycle-stage.template.md`](./lifecycle-stage.template.md) preenchido em arquivo separado.

---

## 8. Configuração por tenant (C8)

Cliente novo do produto = **configuração**, não branch.

| Campo | Tipo | Default | Exemplo |
|---|---|---|---|
| `tone_of_voice` | string | "neutro-profissional" | "informal" |
| `industry_segment` | enum | "geral" | "agência", "indústria", "serviços" |
| `outras_overrides` | ... | ... | ... |

Storage: tabela `TenantContext.productConfig.{{ product_code }}` ou equivalente no DB do produto.

---

## 9. Stack técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | {{ ex: Lovable, Next.js, React+Vite }} | {{ time-to-market vs. controle }} |
| Auth | {{ ex: Supabase Auth, Auth0 }} | {{ ... }} |
| Backend / API | {{ ex: Supabase Edge Functions, Next.js API }} | {{ ... }} |
| LLM | {{ provedor primário + fallback }} | {{ ... }} |
| Observability | {{ Langfuse / outro }} | {{ ... }} |
| Pagamentos | {{ Stripe / Paddle / outro }} | {{ ... }} |

> Princípio C7 (Portability): isolar dependências de modelo/provedor em camada de abstração mesmo em produtos beta.

---

## 10. Riscos específicos do produto

| Risco | Mitigação |
|---|---|
| {{ risco 1 }} | {{ ... }} |
| {{ risco 2 }} | {{ ... }} |

---

## 11. Métricas de sucesso

### Operacionais
- Outcomes/usuário ativo/mês: {{ meta }}
- Tempo médio até primeiro outcome (TTFO): {{ < N min }}
- Taxa de sucesso de geração de outcome: {{ ≥ X% }}

### Comerciais
- Conversão trial → paid: {{ ≥ X% }}
- Churn mensal: {{ ≤ X% }}
- NPS: {{ ≥ X }}

### Técnicas (C3)
- Custo de inferência / ARPU: {{ ≤ 25% }}
- Latência p95 do outcome principal: {{ < N segundos }}
- Trace coverage: {{ ≥ 99% }}

---

## 12. Histórico de versões

| Versão | Data | Mudança | Autor |
|---|---|---|---|
| 0.1.0 | {{ YYYY-MM-DD }} | Spec inicial | {{ nome }} |

---

## Checklist de pronto (para sair de Discovery → MVP)

- [ ] §1 cláusula de outcome completa (C2)
- [ ] §1.5 termos de uso redigidos
- [ ] §2 ICP definido com persona primária
- [ ] §3 fluxo de onboarding < N min mapeado
- [ ] §4 pipeline implementado (mesmo que minimalista)
- [ ] §6 unit economics validados em sample (C3)
- [ ] §7 stage atual e critérios de promoção declarados
- [ ] §9 stack documentado
- [ ] Telemetria Langfuse instrumentada (C6)
- [ ] Camada de abstração LLM presente (C7)

## Checklist Beta → GA

- [ ] ≥ N usuários ativos pagantes
- [ ] Eval suite com ≥ 30 casos passing
- [ ] Razão custo/ARPU validada com volume real (C3)
- [ ] Sem incidente P0 nos últimos 30 dias
- [ ] Reviewer DeepAgent emitiu auditoria mensal sem FAIL crítico
- [ ] Termos de uso aprovados juridicamente
