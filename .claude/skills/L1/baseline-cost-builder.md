---
name: baseline-cost-builder
description: Calcula custo humano baseline de um processo do cliente (volume × tempo × custo-hora) e deriva preço de venda mínimo para cumprir C3 (custo de inferência ≤ 25% do preço). Skill Tier 2 — recebe client_id, lê Tier 1 via helper pattern + dados específicos do cliente. Persiste artefato em docs/clients/{client}/baseline-cost.md.
tier: 2
vocabulary_aliases: [L1, Tactical, Meso]
linked_principles: [C1, C2, C3]
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
    - docs/clients/*/baseline-cost*.md
    - docs/clients/*/diagnostic.md
    - templates/unit-economics.template.md
  keywords: [baseline, custo humano, throughput, custo-hora, unit economics, C3, preço mínimo]
  explicit_invocation: "@baseline-cost-builder"
parameters_required:
  - client_id
  - process_id
  - volume_monthly
  - actors[]
  - hours_per_unit
---

# baseline-cost-builder — Skill Tier 2 (Tático)

## Propósito

Mede o **custo humano atual** de um processo específico do cliente e deriva o **preço de venda mínimo** que mantém o agente AI dentro do hard gate **C3 (custo ≤ 25% do preço)**. O output é o input canônico do template `unit-economics.template.md` e dispara a cláusula de outcome (C2) só ser proposta com economics validado.

> Esta skill **não estima** — recebe dados declarados pelo cliente em sessão. Estimativa "no chute" mata C3 silenciosamente. Se faltar dado, retorna `inputs_missing` e lista o que pedir.

## Quando ativa

1. **Path-scoped** — turno toca arquivo em `docs/clients/{client}/baseline-cost*.md` ou `docs/clients/{client}/diagnostic.md`
2. **Keyword-scoped** — conversa menciona termo de `activation.keywords`
3. **Explícita** — `@baseline-cost-builder client_id=acme process_id=triagem-tickets`
4. **Indireta** — chamada por `diagnostic-runner` quando seção "baseline" do roteiro é executada

## Inputs Tier 1 (via helper pattern)

| Helper | Campo | Por que precisa |
|---|---|---|
| `@offerings-loader` | `offerings` | Verificar se já existe SKU/produto no catálogo cobrindo este processo (evita duplicação) |
| `@company-dna` | `dna` (opcional) | North-star metric da organização provedora pode influenciar margem-alvo |

> Se `__forge_cache.offerings` vazio → invocar `@offerings-loader` antes; sem catálogo, baseline não tem âncora de comparação.

## Inputs Tier 2 (parâmetros da invocação)

Obrigatórios:

```yaml
client_id: <slug do cliente>
process_id: <slug do processo, ex: triagem-tickets-tier1>
volume_monthly: <número de execuções/operações por mês>
actors:
  - role: <ex: analista N1>
    headcount_involved: <quantos atuam neste processo>
    hourly_cost: <custo-hora carregado, em moeda local>
    hours_per_unit: <tempo médio por execução>
quality_baseline:
  error_rate: <0–1, ex: 0.08>
  rework_rate: <0–1>
data_source: <ex: planilha CFO 2026-Q1 | declaração CEO sessão 2026-04-15>
data_confidence: <high | medium | low>
```

Opcionais:

```yaml
peak_factor: <multiplicador para sazonalidade, default 1.0>
sla_currently_paid: <quanto cliente já paga em equipe humana hoje>
target_cost_ratio: <override de C3, default 0.25>
```

## O que faz

1. Valida inputs (campos obrigatórios + sanity checks)
2. Calcula `human_cost_monthly = Σ (actors[i].headcount × hourly_cost × hours_per_unit × volume_monthly × peak_factor)`
3. Calcula `human_cost_per_unit = human_cost_monthly / volume_monthly`
4. Deriva `min_price_per_outcome = inferred_inference_cost / target_cost_ratio` (com placeholder se inferência ainda não medida)
5. Compara com `human_cost_per_unit` para checar viabilidade comercial (margem positiva)
6. Persiste em `docs/clients/{client_id}/baseline-cost-{process_id}.md` usando `templates/unit-economics.template.md`
7. Retorna sumário em YAML para o consumidor (diagnostic-runner ou humano)

## O que entrega

Em memória (return value):

```yaml
baseline_built: true
artifact_path: docs/clients/acme/baseline-cost-triagem-tickets-tier1.md
client_id: acme
process_id: triagem-tickets-tier1
human_cost:
  monthly_total: <valor>
  per_unit: <valor>
  currency: BRL
volume_monthly: <N>
quality_baseline:
  error_rate: 0.08
  rework_rate: 0.04
c3_check:
  target_ratio: 0.25
  min_price_per_outcome: <valor>
  inference_cost_estimated: <valor | "to_measure_in_shadow">
  status: viable | tight | unviable
data_confidence: medium
generated_at: 2026-04-30T...
```

Em disco: arquivo markdown completo seguindo `unit-economics.template.md`, com seções:
- Identificação (client, process, data, autor, fonte)
- Volume e atores
- Cálculo de custo humano
- Quality baseline (erro, retrabalho)
- Hard gate C3 (preço mínimo derivado)
- Cláusula sugerida para outcome (C2 — preencher na spec)
- Próximos passos

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou estimar volume baseado no porte do cliente" | Estimativa sem fonte vira hard gate C3 quebrado em produção | Retornar `inputs_missing.volume_monthly`; pedir dado declarado |
| "Custo-hora analista = média de mercado" | Custo carregado (com encargos) varia 2-3x por empresa; usar média esconde realidade | Exigir `hourly_cost` declarado pelo cliente; se ausente, marcar `data_confidence: low` |
| "Posso pular `quality_baseline`, é cosmético" | Sem taxa de erro humano, não há comparativo para outcome do agente — quebra C2 | Bloquear sem `error_rate` e `rework_rate` (C1: baseline humano é mandatório) |
| "Já tem preço definido pelo cliente, só registro" | Preço sem baseline derivado quebra C3; cliente pode estar pagando errado | Calcular `min_price_per_outcome` mesmo se `sla_currently_paid` declarado, e flagar conflito |
| "Multi-actor confunde, vou agregar como 'equipe'" | Perde rastreabilidade; `unit-economics.template.md` exige granularidade | Manter `actors[]` granular; soma é derivada, não agregada na entrada |
| "Vou ler eval-cases existentes pra ter referência" | Eval-cases são Tier 3 (run individual); Tier 2 não lê Tier 3 | C5 hard rule: erro estruturado se `__forge_cache` exposto a Tier 3 |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] Todos os parâmetros obrigatórios presentes e tipados corretamente
- [x] `volume_monthly > 0`, `hourly_cost > 0`, `hours_per_unit > 0`
- [x] `quality_baseline.error_rate` ∈ [0, 1] e `rework_rate` ∈ [0, 1]
- [x] Arquivo `docs/clients/{client_id}/baseline-cost-{process_id}.md` criado e parsea como markdown válido
- [x] `c3_check.status` ∈ {viable, tight, unviable} com justificativa explícita
- [x] `data_confidence` declarado (não default silencioso)
- [x] Nenhuma leitura registrada em paths Tier 3
- [x] `__forge_cache.offerings` consumido (não re-leu portfolio do disco)

Se algum item falhar → erro estruturado; **não** persiste arquivo parcial.

## C5 hard rule

Esta skill **não pode**:

- Ler arquivos Tier 3 (`runs/`, `outcomes/`, `eval-cases/`, `traces/`)
- Receber `run_id`, `case_id`, `trace_id` como parâmetro
- Importar contexto de skills `L2/`

**Pode** (Tier 2 lê Tier 1 + Tier 2):

- Consumir helpers `__forge_cache.{dna,icp,offerings}`
- Ler outros artefatos Tier 2 do mesmo cliente (`diagnostic.md`, outros `baseline-cost-*.md`)
- Ler templates (`templates/unit-economics.template.md`)

Violação detectada pelo reviewer DeepAgent → FAIL na auditoria mensal.

## Saída de erro estruturada

```yaml
baseline_built: false
error: <enum>
missing_inputs: [...]
hint: <ação recomendada>
```

`error` ∈ `inputs_missing` | `inputs_invalid` (faixa numérica) | `offerings_cache_missing` | `client_dir_unwritable` | `c3_unviable` (margem negativa — bloqueia, exige re-negociar escopo) | `data_confidence_low_blocked` (se override de bloqueio ativado em settings).

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@offerings-loader` | upstream (helper) | Consume `__forge_cache.offerings` |
| `@diagnostic-runner` | upstream | Chama esta skill na seção "baseline" do roteiro |
| `@artifact-prompt-builder` (L2) | downstream | Lê `baseline-cost-{process_id}.md` para informar prompt do SKU |
| `@unit-economist` (Guardian, Forge-3) | reviewer | Audita output desta skill antes de promover modo |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-1 onda 2 (Tier 2) |
