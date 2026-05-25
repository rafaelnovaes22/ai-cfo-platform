---
artifact_id: "monthly-analysis"
client_id: "aicfo"
document_type: "process-map"
process_name: "monthly-analysis"
linked_principle: "C1"
linked_spec: "docs/specs/monthly-analysis.md"
created_at: "2026-05-25"
last_updated: "2026-05-25"
process_type: "self-serve-product-flow"
data_confidence: "medium"
agent_readiness_score: 0.85
agent_readiness_rationale: |
  Score elevado porque (a) o produto inteiro foi desenhado como agentic_saas desde dia 1
  (não é automação de processo legado humano), (b) os decision points têm dados estruturados
  como input (lançamentos com data/descrição/valor), (c) cada decision tem uma taxonomia
  declarada (DRE categories, severidades de gargalo, horizontes do plano).
  
  Reduções do score 1.0 → 0.85: ainda dependemos de SHADOW de 14 dias com clientes reais para
  validar o `data_confidence` em segmentos não-cobertos pela eval suite atual (agência,
  indústria leve, serviços B2B). Após SHADOW de 5+ tenants, o score deve subir para 0.95.
generated_via: "manual translation — produto self-serve não tem diagnóstico/process-mapping individual; reconstruído da spec + AIOS pipeline"
---

# Process Map — `monthly-analysis` (Aicfo, self-serve)

> **Nota sobre type**: Aicfo é um produto self-serve, não uma automação de processo humano legado. Este "process-map" documenta o **fluxo agentic interno** do SKU + a **jornada self-serve do usuário**, satisfazendo a pre-condition do Forge sem inventar um processo que não existe.

---

## 1. Trigger event

```yaml
trigger_event: "client_imports_ledger_for_reference_month"
trigger_source: "UI action (cliente loga e clica 'Iniciar análise')"
trigger_payload:
  tenantId: <uuid>
  monthRef: "YYYY-MM"
  ledger_entries: [<lista de lançamentos via upload | paste | manual>]
```

Disparado exclusivamente por ação do cliente final (não há trigger automático ou batch). O fluxo abaixo executa síncrono (LangGraph) com latência alvo p95 < 5 min.

---

## 2. Atores

| Ator | Papel | Tipo |
|---|---|---|
| **Cliente final** (CEO/sócio/CFO PME) | Importa lançamentos, lê análise, decide ações | Humano |
| **Sistema Aicfo** (LangGraph) | Orquestra o pipeline `ingest → classification → dre-narrative → action-plan → financial-qa-review → finalize` | Agentic |
| **Rafael (operador/founder)** | Audita amostras em SHADOW, aprova promoções, revisa eval suites | Humano |
| **CEO Acme** (mesma pessoa em founder-solo) | Signatário de aprovações (c4_thresholds, baseline-cost) — recebe via approvers cruzados quando time crescer | Humano |
| **Contador externo do cliente** (opcional) | Pode receber export PDF/Excel da análise como referência (não é ator técnico) | Humano externo |

---

## 3. Decision points (pontos onde o sistema decide algo não-trivial)

| # | Decision | Quem decide | Inputs | Output |
|---|---|---|---|---|
| D1 | Aceitar import? | `ingest` (parser) | shape do arquivo, encoding, número de linhas | aceita / rejeita com mensagem |
| D2 | Categoria DRE de cada lançamento | `classification` (Gemini Flash) | descrição normalizada, valor, direção | 1 entre 23 categorias da taxonomia DRE |
| D3 | Confidence cap por clareza da descrição | `clarity-judge` (Gemini Flash) | descrição | clear / partial / ambiguous |
| D4 | Existe anomalia high? | `anomaly-detection` (rule-based) | DRE agregado + entries normalizadas | lista de anomalies com severidade |
| D5 | Margem bruta crítica/atenção/saudável? | `margin-diagnosis` (rule-based) | DRE.margemBruta/margemOperacional | enum status + drivers |
| D6 | Risco de fluxo de caixa? | `cashflow-risk` (rule-based) | normalized entries com dates/directions | enum status + reasons |
| D7 | Qual problema vira card `critical_gap`? | `narrative-synthesis` (Gemini Flash) | DRE + anomalies + margin + cashflow | 1 card com title + body + evidence |
| D8 | Qual ponto vira card `attention`? | `narrative-synthesis` | mesmo | 1 card |
| D9 | Qual ponto vira card `healthy`? | `narrative-synthesis` | mesmo | 1 card |
| D10 | Ação curto/médio/longo prazo | `action-planning` (Gemini Flash) | narrative cards + DRE + dre-classified | plano com ≥5 ações |
| D11 | A análise é publicável? | `financial-qa-review` (determinístico + LLM) | tudo acima | publishable=true/false + retryTargets |
| D12 | Re-tentar ou finalizar? | `qa-gate` (rule-based) | qa-review + retry counts | retry narrative, retry action, ou finalize |

---

## 4. Automatable hypotheses (que decisões devem ficar com IA vs. humano)

| Decision | Hipótese de automação | Justificativa |
|---|---|---|
| D1 (aceitar import) | 100% automatizado | regra trivial (shape validation) |
| D2 (categoria DRE) | 100% automatizado em GA; 90%+85%+75% gate por modo | precisão medida via eval suite (`classification` 87.5% atual) |
| D3 (confidence cap) | 100% automatizado | regra determinística sobre output do judge |
| D4-D6 (anomalies/margin/cashflow) | 100% automatizado | rule-based, sem LLM, determinístico |
| D7-D9 (cards) | 100% automatizado + audit `financial-qa-review` | LLM + guardião determinístico contra alucinação |
| D10 (action plan) | 100% automatizado + audit | mesmo padrão |
| D11 (publishable?) | 95% automatizado | gate determinístico cobre 80% dos casos; LLM `financial-qa-review` cobre os 20% restantes; humano só em SHADOW |
| D12 (retry?) | 100% automatizado | rule-based, max 1 retry por target |

**Resumo**: 0 decisões mantidas em humano em GA. Em SHADOW, Rafael revisa **toda análise** antes de cliente ver (cliente não recebe output em SHADOW).

---

## 5. Limitations / data confidence

| Categoria | Confidence | Razão |
|---|---|---|
| Acurácia de categorização DRE | medium-high | 87.5-100% em eval suite (varia por modelo); SHADOW vai validar em segmentos não cobertos |
| Qualidade narrativa (cards) | medium | eval `dre-narrative` 93.8% via assertion_shape (math); llm_as_judge ainda em iteração para qualidade textual |
| Qualidade do plano de ação | medium | eval `action-plan` em iteração; o `financial-qa-review` mitiga riscos de hallucination |
| Detecção de fluxo de caixa | medium | rule-based simples; pode subir após Onda 2 (cashflow agent dedicado) |

**Limitação principal**: o cliente final é responsável por importar lançamentos completos e corretos. Lixo entra → análise inferior. Mitigação: rejeitar imports abaixo de 50 lançamentos OU com >30% sem categoria.

---

## 6. Outputs do processo (mapeados para outcomes da spec)

| Decision points → outcome |
|---|
| D1+D2+D3 produzem dado para → `dre_classified` outcome |
| D4+D5+D6+D7-D9 → `narrative_generated` outcome |
| D10 → `action_plan_generated` outcome |
| D11+D12 → composição final = `analysis_delivered` outcome |
| Export action (UI) → `report_exported` outcome (separado, sob demanda) |

---

## 7. Aprovação

- [x] Spec linkada (`docs/specs/monthly-analysis.md` v0.2.0)
- [x] Decision points enumerados e mapeados para outcomes da spec
- [x] `agent_readiness_score: 0.85` justificado
- [x] Limitations declaradas; sem `data_confidence: low` em decision crítica
- [ ] Re-avaliação após SHADOW de 14 dias com 5+ tenants reais

**Aprovado para Gate de pre-condition do `/acme:plan`**: ✅
