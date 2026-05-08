---
name: process-mapper
description: Mapeia processo as-is do cliente em formato agent-ready — trigger, steps numerados (ator/ação/input/output), decision points com critérios, métricas atuais, e hipóteses de pontos automatizáveis. Skill Tier 2 — produz docs/clients/{client}/process-{name}.md, input canônico para artifact-prompt-builder (L2).
tier: 2
vocabulary_aliases: [L1, Tactical, Meso]
linked_principles: [C1, C5, C7]
helper_pattern: none
cache_strategy: none
reads_from_tier: [1, 2]
must_not_read: [3]
requires_helper:
  - skill: company-dna
    field: dna
    optional: true
  - skill: offerings-loader
    field: offerings
    optional: false
version: 0.1.0
activation:
  paths:
    - docs/clients/*/process-*.md
    - docs/clients/*/diagnostic.md
  keywords: [process map, processo as-is, fluxo, swimlane, decision point, automatable, agent-ready]
  explicit_invocation: "@process-mapper"
parameters_required:
  - client_id
  - process_id
  - process_name
parameters_optional:
  - source_diagnostic_path
  - mapping_method
---

# process-mapper — Skill Tier 2 (Tático)

## Propósito

Transforma a descrição de um processo do cliente em **representação estruturada agent-ready**: trigger explícito, steps numerados com ator/input/output, decision points com critérios objetivos, métricas atuais (tempo, throughput, qualidade), e hipóteses iniciais de **automatable points**.

O output é o input canônico de `artifact-prompt-builder` (L2) e do `eval-case-author` (L2): sem mapa do processo as-is, prompt de SKU vira chute e eval-cases não têm gabarito.

## Quando ativa

1. **Path-scoped** — turno toca `docs/clients/{client}/process-*.md` ou `docs/clients/{client}/diagnostic.md`
2. **Keyword-scoped** — termo de `activation.keywords`
3. **Explícita** — `@process-mapper client_id=acme process_id=triagem-tickets-tier1 process_name="Triagem N1 de tickets"`
4. **Indireta** — chamada por `@diagnostic-runner` no handoff Bloco 3 quando processo é central

## Inputs Tier 1 (via helper pattern)

| Helper | Por que precisa |
|---|---|
| `@offerings-loader` | Validar se já existe SKU/produto cobrindo este processo (deduplicação) |
| `@company-dna` (opcional) | Glossário/vocabulário da organização provedora — terminologia consistente entre processos mapeados |

## Inputs Tier 2 (parâmetros)

Obrigatórios:

```yaml
client_id: <slug do cliente>
process_id: <slug do processo, ex: triagem-tickets-tier1>
process_name: <nome humano-legível>
```

Opcionais:

```yaml
source_diagnostic_path: docs/clients/{client_id}/diagnostic.md  # se já houver
mapping_method: interview | observation | document_analysis | hybrid  # default: interview
swimlane_actors: [analista-n1, supervisor, sistema-crm]  # se conhecidos
```

## O que entrega (return value)

Em memória:

```yaml
process_mapped: true
artifact_path: docs/clients/acme/process-triagem-tickets-tier1.md
client_id: acme
process_id: triagem-tickets-tier1
mapping_summary:
  steps_count: <N>
  decision_points_count: <N>
  actors_unique: [analista-n1, supervisor, sistema-crm]
  triggers: [novo_ticket_recebido]
  outputs_terminal: [ticket_resolvido, ticket_escalado]
metrics_baseline:
  avg_handle_time_minutes: <N>
  throughput_daily: <N>
  human_error_rate: <0–1>
automatable_hypotheses:
  - step_id: 3
    confidence: high | medium | low
    rationale: "Decision point determinístico baseado em campo X"
  - step_id: 7
    confidence: medium
    rationale: "..."
agent_readiness_score: 0.0–1.0  # heurística
generated_at: 2026-04-30T...
```

Em disco: arquivo markdown estruturado em **6 seções**:

1. **Identificação** (frontmatter YAML + cabeçalho)
2. **Trigger e contexto** (o que inicia, quando, com qual frequência)
3. **Atores** (lista nominal de roles + sistemas, com responsabilidade clara)
4. **Steps** (numerados, formato tabela: `# | ator | ação | input | output | tempo médio | erro típico`)
5. **Decision points** (numerados, formato: `# | step | critério | branches | dado disponível?`)
6. **Métricas e automatable hypotheses** (baseline numérico + hipóteses de automação rankeadas)

## Estrutura canônica do output (formato agent-ready)

```yaml
# frontmatter
---
client_id: <>
process_id: <>
process_name: <>
mapped_at: YYYY-MM-DD
mapped_by: <skill ou humano>
forge_skill_version: process-mapper@0.1.0
linked_principles: [C1, C5, C7]
---
```

```markdown
## Trigger
- evento: novo_ticket_recebido
- canal: email | webhook | manual
- volume_diario_baseline: 120
- sazonalidade: pico segunda-feira

## Atores
| role | tipo | responsabilidade |
|---|---|---|
| analista-n1 | humano | classificar e responder |
| supervisor | humano | escalonamento |
| sistema-crm | sistema | persistir ticket |

## Steps
| # | ator | ação | input | output | t_médio | erro típico |
|---|---|---|---|---|---|---|
| 1 | sistema-crm | recebe ticket | email | ticket_id | <1s | — |
| 2 | analista-n1 | classifica categoria | corpo do ticket | category | 2 min | classificação errada (8%) |
| ... | ... | ... | ... | ... | ... | ... |

## Decision Points
| # | step | critério | branches | dado disponível |
|---|---|---|---|---|
| D1 | 3 | category == "billing"? | sim → step 5 / não → step 4 | sim |

## Métricas baseline
- avg_handle_time: 11 min
- throughput_daily: 120 tickets
- human_error_rate: 0.08

## Automatable hypotheses
1. **Step 2 (classificar categoria)** — confidence: high — campo derivável determinístico
2. **Step 4 (resposta padrão)** — confidence: medium — depende de tom/contexto
3. **D1** — confidence: high — regra explícita
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou descrever em prosa, fica mais natural" | Prosa não é agent-ready; downstream (artifact-prompt-builder) precisa estrutura tabular | Forçar formato tabela mesmo se descrição original veio em texto |
| "Step com vários atores em paralelo, junto tudo" | Perde rastreabilidade; cada ator deve ter linha própria | Quebrar em múltiplas linhas com mesmo `#` ou subdivisão `2a, 2b` |
| "Sem dados de tempo/erro, deixo em branco" | `metrics_baseline` é mandatório; valor desconhecido é dado válido (`null` + nota) | Marcar `t_médio: null` + `data_confidence_step_2: low` |
| "Decision point óbvio, não preciso formalizar critério" | Critério tácito vira ambiguidade no prompt do agente; fonte de erro #1 em SKUs | Toda decision branch tem critério explícito + indicação se dado está disponível |
| "Vou ler runs reais pra puxar tempo médio mais preciso" | Runs são Tier 3 — quebra C5 | Pedir ao cliente; ou marcar `data_confidence: low` se baseado em estimativa |
| "Hipóteses de automação vêm na spec, não no map" | Sem hipóteses no map, prompt-builder começa do zero — desperdício | `automatable_hypotheses` é entregável obrigatório |
| "Vou usar diagrama Mermaid, é mais visual" | Diagrama é complemento, não substituto; agente não consome diagrama | Tabelas primeiro; Mermaid opcional em apêndice |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] `trigger` declarado com tipo, canal e `volume_diario_baseline`
- [x] `atores` ≥ 1 com `role`, `tipo` (humano|sistema), `responsabilidade`
- [x] `steps` ≥ 2 numerados com todos os campos do formato canônico
- [x] Cada `decision_point` referencia `step` existente, tem `critério` explícito, `branches` declaradas
- [x] `metrics_baseline` com `avg_handle_time_minutes`, `throughput_daily`, `human_error_rate` (mesmo que `null` + `data_confidence: low`)
- [x] `automatable_hypotheses` ≥ 1 com `step_id`, `confidence`, `rationale`
- [x] `agent_readiness_score` calculado (heurística declarada na skill)
- [x] Arquivo `docs/clients/{client_id}/process-{process_id}.md` persistido e parseia
- [x] Frontmatter com `forge_skill_version`
- [x] `__forge_cache.offerings` consumido
- [x] Nenhuma leitura Tier 3

## Heurística de `agent_readiness_score`

```
score = 0.4 × (decision_points_with_clear_criteria / total_decision_points)
      + 0.3 × (steps_with_structured_io / total_steps)
      + 0.2 × (metrics_baseline_completeness)   # quantos campos não-null
      + 0.1 × (automatable_hypotheses_high_confidence_ratio)
```

Score < 0.5 → processo **não está pronto** para virar SKU; recomenda-se revisar mapping. Score ≥ 0.7 → ready.

## C5 hard rule

Esta skill **não pode**:

- Ler `runs/`, `outcomes/`, `eval-cases/`, `traces/`
- Receber `run_id`, `case_id`, `trace_id`
- Importar de skills L2

**Pode**:

- Consumir `__forge_cache.{dna,offerings}`
- Ler outros artefatos Tier 2 do mesmo cliente (`diagnostic.md`, outros `process-*.md`, `baseline-cost-*.md`)
- Ler templates

Violação → FAIL na auditoria mensal.

## Saída de erro estruturada

```yaml
process_mapped: false
error: <enum>
fields_missing: [...]
hint: <ação>
```

`error` ∈ `inputs_missing` | `helpers_not_loaded` | `insufficient_steps` (<2) | `decision_point_without_criterion` | `metrics_baseline_completely_empty` | `client_dir_unwritable` | `agent_readiness_below_threshold` (se settings exigem score mínimo).

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@offerings-loader` | upstream (helper) | `__forge_cache.offerings` |
| `@diagnostic-runner` | upstream | Handoff do problema declarado |
| `@baseline-cost-builder` | par-Tier 2 | Lê `metrics_baseline` deste mapa para calcular custo humano por unidade |
| `@artifact-prompt-builder` (L2) | downstream | Lê este mapa para construir system prompt do SKU |
| `@eval-case-author` (L2) | downstream | Usa decision points e métricas para gerar casos com gabarito |
| `@sku-architect` (Guardian, Forge-3) | reviewer | Valida `agent_readiness_score` antes de virar spec |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-1 onda 2 (Tier 2) |
