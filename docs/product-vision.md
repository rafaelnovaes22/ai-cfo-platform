---
status: "draft"
constitution_version: "0.2.0"
created_at: "2026-05-08"
last_updated: "2026-05-08"
total_features: 60
total_modules: 30
total_waves: 8
---

# Aicfo — Product Vision

> Visão do produto em ondas, mapeando as 60 features iniciais em 30 módulos arquiteturais.

---

## Norte

**Aicfo = CFO-IA self-serve para PMEs.** Centraliza dados financeiros, projeta caixa, recomenda decisões e gera relatórios — substituindo trabalho operacional financeiro por agentes auditáveis.

ICP: CEO/sócio/CFO de PME (R$ 500k-R$ 10M faturamento) que olha finanças mas não tem ferramenta dedicada e decide no escuro porque o contador entrega só 30-45 dias depois.

Modelo: SaaS² (Service-as-a-Software). Cobrança = mensalidade fixa (planos Lite/Pro/Business) + variável por outcome em planos avançados.

---

## 30 módulos em 8 ondas

| Onda | Tema | Módulos | Tier predominante |
|---|---|---|---|
| **0** | Fundação | 4 | C (Rafael implementa) |
| **1** | SKU Piloto: monthly-analysis | 6 | B (agente itera) |
| **2** | Operação em Tempo Real | 5 | B |
| **3** | Inteligência de Decisão | 4 | B |
| **4** | Conectividade | 4 | C/B |
| **5** | Tributário | 1 | B |
| **6** | Operacional Pesado | 3 | B/C |
| **7** | Auditoria & Detecção | 2 | B |
| **8** | Planejamento | 1 | B |

---

## Detalhamento por onda

### Onda 0 — Fundação

Pré-requisito de tudo. Rafael implementa manualmente (Tier C) por serem peças de segurança/billing crítico.

| Módulo | Features cobertas | Por que Tier C |
|---|---|---|
| `auth-tenant` | (transversal — login, JWT, multi-tenant) | Segurança crítica; autenticação errada = risco P0 |
| `workspace-setup` | #42 personalização por tipo de negócio | Onboarding define todo o contexto do tenant |
| `billing` | (modelo SaaS² — Stripe, planos, invoices) | Pagamento errado = bloqueio de receita |
| `tenant-config` | #50 camada de segurança e controle de acesso | Permissões erradas = vazamento entre tenants |

### Onda 1 — SKU Piloto `monthly-analysis`

O coração do produto. Já validado visualmente (3 telas no Figma do dev frontend). Pipeline AIOS roda Tier B (agente gera, Rafael itera) com gates humanos C4.

| Módulo | Features cobertas |
|---|---|
| `ingest` | (input layer — planilha colada, PDF do contador, Excel/CSV, manual) |
| `classification` | #6 classificação automática, #7 aprendizado contínuo |
| `dre-narrative` | #8 fechamento DRE/balanço, #14 justificativa inteligente das decisões da IA, #15 detecção de anomalias (preview) |
| `action-plan` | #13 motor de decisão financeira, #45 sistema de recomendação para aumento de lucro, #46 redução de custos |
| `hub` | #23 dashboard executivo simplificado (CEO) |
| `export` | #28 relatórios mensais, #29 investidores, #30 sócios |

**Promotion gate**: Onda 1 precisa estar em AUTONOMOUS antes de Onda 2 começar.

### Onda 2 — Operação em Tempo Real

Adiciona visão diária/intra-mês em cima do fechamento mensal da Onda 1. Tier B.

| Módulo | Features cobertas |
|---|---|
| `cashflow` | #2 fluxo em tempo real, #3 projeção 7/30/90d, #57 visualização burn rate e runway |
| `kpis` | #24 KPIs automáticos (CAC/LTV/payback/margem/burn/runway), #25 atualização automática |
| `score` | #40 score financeiro da empresa |
| `alerts` | #41 alertas proativos (ruptura de caixa, queda de margem), #56 metas não atingidas |
| `dashboard-ceo` | #23 dashboard executivo (versão refinada), #58 suporte à decisão estratégica |

### Onda 3 — Inteligência de Decisão

A camada IA mais avançada. Recomendações, simulações, copiloto NL. Tier B com eval extra.

| Módulo | Features cobertas |
|---|---|
| `decision-engine` | #13 motor de decisão (versão evoluída pós-piloto), #59 recomendações baseadas em comportamento histórico |
| `scenarios` | #4 simulação dinâmica de impacto financeiro, #5 cenários (pessimista/base/agressivo), #26 simulador de crescimento, #27 estrutura de custos |
| `benchmarking` | #48 benchmarking histórico interno, #49 por segmento (depende de base de dados) |
| `conversational-agent` | #31 agente conversacional financeiro (perguntas em NL) |

### Onda 4 — Conectividade

Sai do "import manual" e conecta com sistemas externos. Tier C predominante (integrações são alto risco).

| Módulo | Features cobertas |
|---|---|
| `integrations-banks` | #1 (parte), #21 integração bancária multi-conta |
| `integrations-erp-crm-payroll` | #1 (resto), #38 integração CRM, #39 correlação vendas↔caixa |
| `payment-execution` | #22 execução automatizada de pagamentos, #52 integração com automação |
| `revenue-forecast` | #37 previsão de faturamento, #39 correlação vendas↔caixa (refinada) |

### Onda 5 — Tributário

Risco e complexidade altos, mas Tier B com revisão extra de eval (não Tier C). Justificativa: lógica tributária é regra-densa mas auditável; LLM acelera mas humano revisa toda mudança.

| Módulo | Features cobertas |
|---|---|
| `tax-suite` | #34 controle tributário, #35 sugestão regime ideal, #36 alertas de risco fiscal, #53 simulação de cenários tributários |

### Onda 6 — Operacional Pesado

| Módulo | Features cobertas |
|---|---|
| `accounts-management` | #17 contas a pagar, #18 contas a receber, #19 previsão inadimplência, #20 priorização inteligente |
| `bank-reconciliation` | #9 conciliação bancária automática (Tier C — alto risco) |
| `profitability` | #10 rentabilidade por cliente, #11 produto, #12 canal |

### Onda 7 — Auditoria & Detecção

| Módulo | Features cobertas |
|---|---|
| `anomaly-fraud-detection` | #15 detecção de anomalias (versão dedicada), #16 fraudes e desvios |
| `audit-governance` | #32 governança com rastreabilidade total, #33 auditoria automatizada, #51 logs completos da IA |

### Onda 8 — Planejamento

| Módulo | Features cobertas |
|---|---|
| `financial-planning` | #54 planejamento financeiro anual, #55 orçamentário com ajuste dinâmico |

---

## Mapeamento completo das 60 features → módulo

| # | Feature | Módulo | Onda |
|---|---|---|---|
| 1 | Centralização total dos dados | `integrations-banks` + `integrations-erp-crm-payroll` | 4 |
| 2 | Fluxo de caixa em tempo real | `cashflow` | 2 |
| 3 | Projeção de caixa 7/30/90d | `cashflow` | 2 |
| 4 | Simulação dinâmica de impacto | `scenarios` | 3 |
| 5 | Projeções inteligentes (cenários) | `scenarios` | 3 |
| 6 | Classificação automática | `classification` | 1 |
| 7 | Aprendizado contínuo classificação | `classification` | 1 |
| 8 | Fechamento financeiro automatizado | `dre-narrative` | 1 |
| 9 | Conciliação bancária automática | `bank-reconciliation` | 6 |
| 10 | Rentabilidade por cliente | `profitability` | 6 |
| 11 | Rentabilidade por produto | `profitability` | 6 |
| 12 | Rentabilidade por canal | `profitability` | 6 |
| 13 | Motor de decisão financeira | `action-plan` (piloto) → `decision-engine` (Onda 3) | 1+3 |
| 14 | Justificativa inteligente | `dre-narrative` | 1 |
| 15 | Detecção de anomalias | `dre-narrative` (preview) → `anomaly-fraud-detection` | 1+7 |
| 16 | Detecção de fraudes | `anomaly-fraud-detection` | 7 |
| 17 | Contas a pagar | `accounts-management` | 6 |
| 18 | Contas a receber | `accounts-management` | 6 |
| 19 | Previsão de inadimplência | `accounts-management` | 6 |
| 20 | Priorização de pagamentos | `accounts-management` | 6 |
| 21 | Integração bancária multi-conta | `integrations-banks` | 4 |
| 22 | Execução automatizada de pagamentos | `payment-execution` | 4 |
| 23 | Dashboard executivo (CEO) | `hub` (piloto) → `dashboard-ceo` (Onda 2) | 1+2 |
| 24 | KPIs automáticos | `kpis` | 2 |
| 25 | Atualização automática KPIs | `kpis` | 2 |
| 26 | Simulador de crescimento | `scenarios` | 3 |
| 27 | Simulador de estrutura de custos | `scenarios` | 3 |
| 28 | Relatórios mensais | `export` | 1 |
| 29 | Relatórios investidores | `export` | 1 |
| 30 | Relatórios sócios | `export` | 1 |
| 31 | Agente conversacional NL | `conversational-agent` | 3 |
| 32 | Governança com rastreabilidade total | `audit-governance` | 7 |
| 33 | Auditoria automatizada | `audit-governance` | 7 |
| 34 | Controle tributário | `tax-suite` | 5 |
| 35 | Sugestão regime tributário | `tax-suite` | 5 |
| 36 | Alertas de risco fiscal | `tax-suite` | 5 |
| 37 | Previsão de faturamento | `revenue-forecast` | 4 |
| 38 | Integração CRM | `integrations-erp-crm-payroll` | 4 |
| 39 | Correlação vendas↔caixa | `revenue-forecast` | 4 |
| 40 | Score financeiro da empresa | `score` | 2 |
| 41 | Alertas proativos de risco | `alerts` | 2 |
| 42 | Personalização por tipo de negócio | `workspace-setup` | 0 |
| 43 | Redução massiva trabalho operacional | (transversal — emergente do conjunto) | — |
| 44 | Escalabilidade sem aumento de equipe | (transversal — emergente) | — |
| 45 | Recomendação aumento lucro | `action-plan` | 1 |
| 46 | Recomendação redução custos | `action-plan` | 1 |
| 47 | Análise de eficiência operacional | `kpis` + `score` | 2 |
| 48 | Benchmarking interno (histórico) | `benchmarking` | 3 |
| 49 | Benchmarking por segmento | `benchmarking` | 3 |
| 50 | Camada de segurança e acesso | `tenant-config` | 0 |
| 51 | Logs completos de decisões IA | `audit-governance` | 7 |
| 52 | Integração com automação | `payment-execution` | 4 |
| 53 | Simulação cenários tributários | `tax-suite` | 5 |
| 54 | Planejamento financeiro anual | `financial-planning` | 8 |
| 55 | Planejamento orçamentário dinâmico | `financial-planning` | 8 |
| 56 | Alertas de metas não atingidas | `alerts` | 2 |
| 57 | Visualização burn rate / runway | `cashflow` + `kpis` | 2 |
| 58 | Suporte à decisão estratégica CEO | `dashboard-ceo` | 2 |
| 59 | Recomendações baseadas em histórico | `decision-engine` | 3 |
| 60 | Interface simples orientada à decisão | (transversal — UX) | — |

**Cobertura**: 57 das 60 features mapeadas em módulos diretos; 3 são transversais (emergem do conjunto, não têm módulo dedicado).

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-08 | Versão inicial — 60 features → 30 módulos → 8 ondas |
