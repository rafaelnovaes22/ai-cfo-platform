---
description: Calcula custo humano baseline (volume × tempo × custo-hora) e deriva preço de venda mínimo para cumprir C3 (custo de inferência ≤ 25% do preço). Persiste docs/clients/{client_id}/baseline-cost-{process_id}.md a partir de templates/unit-economics.template.md. Bloqueia avanço para /acme:sla-threshold se c3_check.status == unviable.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - client_id
    - process_id
  optional:
    - artifact_id
    - target_cost_ratio
    - peak_factor
    - sla_currently_paid
    - data_confidence_min
forge_command_version: 0.1.0
linked_principles: [C1, C2, C3]
invokes_skills:
  - "@offerings-loader"
  - "@baseline-cost-builder"
output_artifact: docs/clients/{client_id}/baseline-cost-{process_id}.md
trace_required: true
---

# /acme:unit-economics — C3 hard gate

## Propósito

Mede o **custo humano atual** do processo do cliente e deriva o **preço de venda mínimo** que satisfaz o hard gate **C3 (custo ≤ 25% do preço)**. Saída é input canônico para `/acme:sla-threshold` e amarra a cláusula de outcome (C2) ao economics validado.

> Esta command **não estima**. Recebe dados declarados pelo cliente (idealmente coletados durante `/acme:diagnose` Bloco 3). Estimativa "no chute" mata C3 silenciosamente em produção.

## Pre-conditions

1. `docs/clients/{client_id}/diagnostic.md` existe com `go_no_go: go`
2. `docs/clients/{client_id}/process-{process_id}.md` existe com `metrics_baseline` populado (mesmo que parcial)
3. Inputs obrigatórios coletados (volume, atores com custo-hora, tempo por unidade, qualidade baseline)
4. `__forge_cache.offerings` disponível ou `@offerings-loader` invocável
5. Tracing configurado

Se inputs ausentes → bloquear com `error: inputs_missing` listando o que pedir ao CFO/operações.

## Inputs

```yaml
client_id: <slug>
process_id: <slug, ex: triagem-tickets-tier1>
# opcionais
artifact_id: <slug>           # se já passou por /acme:spec, vincula
target_cost_ratio: 0.25       # default; override exige justificativa
peak_factor: 1.0              # default; sazonalidade
sla_currently_paid: <valor>   # quanto cliente já paga em equipe humana hoje
data_confidence_min: medium   # default; "low" exige aprovação humana
```

## Inputs estruturados (lidos do diagnostic ou prompted)

```yaml
volume_monthly: <N execuções/mês>
actors:
  - role: analista-n1
    headcount_involved: <N>
    hourly_cost: <valor em moeda local>
    hours_per_unit: <horas por execução>
quality_baseline:
  error_rate: <0–1>
  rework_rate: <0–1>
data_source: <fonte declarada>
data_confidence: high | medium | low
```

## Execução

```
1. Trace start

2. Helpers Tier 1:
   - @offerings-loader (validar artifact_id se fornecido; identificar pricing_model)

3. Tier 2 — leitura:
   - Carregar diagnostic.md → extrair declared_problem, baseline_handoff
   - Carregar process-{process_id}.md → extrair metrics_baseline já mapeado
   - Cross-validar: volume do diagnostic ≈ throughput_daily × 30 do process-map

4. Invocar @baseline-cost-builder com inputs estruturados:
   - Calcula human_cost_monthly = Σ (actors[i].headcount × hourly_cost × hours_per_unit × volume_monthly × peak_factor)
   - Calcula human_cost_per_unit = monthly / volume_monthly
   - Deriva min_price_per_outcome = inferred_inference_cost / target_cost_ratio
   - Compara com sla_currently_paid (se fornecido) — flag conflito

5. Persistir docs/clients/{client_id}/baseline-cost-{process_id}.md
   (template: templates/unit-economics.template.md)

6. Avaliar c3_check.status:
   - viable      — margem positiva confortável
   - tight       — margem positiva mas <10% folga; warn
   - unviable    — margem negativa; BLOQUEIA /acme:sla-threshold

7. Trace end + output structured
```

## Output structured

```yaml
command: /acme:unit-economics
status: ok | warn | error
artifact_path: docs/clients/<>/baseline-cost-<>.md
client_id: <>
process_id: <>
artifact_id: <ou null>
human_cost:
  monthly_total: <valor>
  per_unit: <valor>
  currency: BRL
volume_monthly: <N>
quality_baseline:
  error_rate: <>
  rework_rate: <>
c3_check:
  target_ratio: 0.25
  min_price_per_outcome: <valor>
  inference_cost_estimated: <valor | "to_measure_in_shadow">
  status: viable | tight | unviable
  margin_pct: <>
  blocker: <null | "margem negativa: revisar escopo ou renegociar preço">
data_confidence: medium
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:sla-threshold --artifact_id=<>" | "BLOQUEADO — renegociar"
```

## Verification gate

- [x] Inputs obrigatórios presentes e tipados (`volume_monthly > 0`, etc)
- [x] `quality_baseline.error_rate` ∈ [0,1] e `rework_rate` ∈ [0,1]
- [x] Arquivo `baseline-cost-{process_id}.md` persistido e parseia
- [x] `c3_check.status` declarado com justificativa em `blocker` (se unviable)
- [x] `data_confidence` declarado (não default silencioso)
- [x] Cross-validação volume diagnostic vs process-map dentro de ±20%; senão warn
- [x] Se `data_confidence: low` e `data_confidence_min: medium` → bloqueio com hint para sessão com CFO
- [x] Nenhuma leitura Tier 3 (eval-cases, runs, traces)
- [x] Trace_id não-nulo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Volume estimado pelo porte do cliente" | Estimativa sem fonte = C3 quebrado em produção | Bloquear com `inputs_missing.volume_monthly`; pedir dado declarado |
| "Custo-hora = média de mercado" | Carregado (com encargos) varia 2-3x; média esconde realidade | Exigir `hourly_cost` declarado; senão `data_confidence: low` |
| "Sem `quality_baseline` consigo prosseguir" | Sem taxa de erro humano, sem comparativo para outcome do agente — quebra C2 | Bloqueio mandatório (C1 — baseline humano completo) |
| "Já tem preço definido pelo cliente, só registro" | Preço sem baseline derivado quebra C3 silenciosamente | Calcular `min_price_per_outcome` e flagar `price_mismatch` se conflitante |
| "C3 unviable mas vamos tentar otimizar prompt" | Otimização vem em SHADOW; antes disso, viabilidade comercial é hard gate | Bloquear `/acme:sla-threshold`; `next_step: "renegociar escopo"` |
| "Multi-actor, agrego como 'equipe' para simplificar" | Perde rastreabilidade exigida por `unit-economics.template.md` | Manter `actors[]` granular; soma é derivada |
| "Override `target_cost_ratio = 0.35` para fechar conta" | Cada override exige nova ADR no projeto consumidor | Bloquear sem ADR linkada justificando |

## Saída de erro estruturada

```yaml
command: /acme:unit-economics
status: error
error: <enum>
missing_inputs: [...]
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `inputs_missing` | `inputs_invalid` | `volume_mismatch_diagnostic_vs_process_map` | `c3_unviable` | `data_confidence_low_blocked` | `target_cost_ratio_override_without_adr` | `client_dir_unwritable`.

## Critério de pronto

`/acme:unit-economics` **bloqueia** `/acme:sla-threshold` se:
- `c3_check.status == unviable`, OU
- `data_confidence == low` sem aprovação explícita

Reviewer DeepAgent (Forge-3) audita mensalmente correspondência entre:
- Cada `prompts/{artifact}/v*/system.md` em produção ↔ `baseline-cost-*.md` correspondente
- `prompt_hash` mudou desde último `baseline-cost-*.md` → `recalc_unit_economics_required` em aberto = FAIL

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 1 (spec/economics) |
