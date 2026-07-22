---
description: Executa eval suite contra o prompt atual — invoca adapter LLM para cada caso em evals/{artifact_id}/cases/, compara com gabarito (exact_match | semantic_match | llm_as_judge), calcula pass rate por outcome_category. Output: evals/{artifact_id}/runs/{date}-eval-{prompt_hash}.md. Pode rodar local ou em CI.
allowed-tools: [Read, Write, Glob, Grep, Bash]
arguments:
  required:
    - artifact_id
  optional:
    - prompt_version
    - subset
    - max_concurrency
    - dry_run
    - judge_model
foundry_command_version: 0.1.0
linked_principles: [C2, C4, C6]
invokes_skills:
  - "@offerings-loader"
output_artifact: evals/{artifact_id}/runs/{YYYY-MM-DD-HHmm}-eval-{prompt_hash}.md
trace_required: true
---

# /novais-digital:eval — Roda eval suite

## Propósito

Executa **toda a eval suite** (ou subset) contra o `prompts/{artifact_id}/v{version}/system.md` atual, compara cada output com o gabarito do case, e produz relatório auditável de **pass rate por outcome_category**. É a precondição mecânica para `/novais-digital:promote` (gate "eval suite passing") e para `/novais-digital:pre-merge-check` quando prompt mudou.

> Cada `eval run` é uma instância **datada e versionada**. Reviewer DeepAgent (Foundry-3) audita histórico para detectar drift entre `prompt_hash` em produção e último eval run com aquele hash.

## Pre-conditions

1. `prompts/{artifact_id}/v{prompt_version}/system.md` existe com `prompt_hash` registrado
2. `evals/{artifact_id}/cases/` contém ≥ 30 cases por `outcome_category` declarada na spec (C4 hard gate)
3. Adapter LLM configurado (`src/llm/adapters/<provider>.ts` exporta `callLLM` funcional)
4. Tracing configurado
5. Eval-as-judge: `--judge_model` configurado (pode ser modelo diferente do `target_model`)

## Inputs

```yaml
artifact_id: <slug>
# opcionais
prompt_version: 0.1.0      # default: maior versão em prompts/{id}/
subset: all | category=billing | source_mode=real | edge   # default all
max_concurrency: 5         # default; respeitar rate limit do provider
dry_run: false             # se true, não invoca LLM; só valida cases
judge_model: claude-haiku  # default; pode ser sonnet/gpt-4 conforme spec
```

## Execução

```
1. Trace start (escopo: eval run completo)

2. Helpers Tier 1:
   - @offerings-loader (validar artifact_id + lifecycle_stage)

3. Tier 2 — leitura:
   - spec.outcome_categories + spec.output_schema (define o que validar)
   - spec.c4_thresholds.agreement_rate_min (referência para PASS/FAIL global)

4. Tier 3 — leitura:
   - prompts/{artifact_id}/v{version}/system.md → prompt_hash
   - evals/{artifact_id}/cases/*.md (filtrados por --subset)
   - evals/{artifact_id}/runs/ (histórico — detectar regressão)

5. Para cada case (paralelizar até max_concurrency):
   5.1 Sub-trace start
   5.2 Compor input estruturado
   5.3 Invocar callLLM(systemPrompt=system.md, userInput=case.input)
   5.4 Comparar output vs case.gabarito conforme case.criterio_pass:
       - exact_match  → string igual literal
       - semantic_match → similaridade ≥ threshold
       - llm_as_judge → invoca judge_model com gabarito + output → veredicto
   5.5 Registrar pass | fail + custo + latência
   5.6 Sub-trace end

6. Agregar métricas por categoria + globalmente

7. Detectar regressão vs último run com mesmo prompt_hash

8. Persistir evals/{artifact_id}/runs/{YYYY-MM-DD-HHmm}-eval-{prompt_hash}.md

9. Trace end + output structured
```

## Estrutura canônica do report

```markdown
---
artifact_id: <>
prompt_version: 0.1.0
prompt_hash: a3f9...c2e1
ran_at: 2026-04-30T14:32
ran_by: <user | ci>
total_cases: 287
subset_filter: all
adapter_provider: anthropic
target_model: claude-sonnet-4
judge_model: claude-haiku-4
total_cost_usd: 1.84
total_latency_seconds: 312
foundry_command_version: eval@0.1.0
linked_principles: [C2, C4, C6]
---

## Resultado global
- Pass rate: 0.91 (262 / 287)
- Threshold (spec.c4_thresholds.agreement_rate_min): 0.85
- **Status: PASS**

## Resultado por categoria
| categoria | total | pass | fail | rate | threshold | status |
|---|---|---|---|---|---|---|
| billing | 78 | 74 | 4 | 0.95 | 0.85 | PASS |
| refund | 41 | 36 | 5 | 0.88 | 0.85 | PASS |
| escalation | 35 | 30 | 5 | 0.86 | 0.85 | PASS |
| ... | ... | ... | ... | ... | ... | ... |

## Resultado por source_mode
| mode | total | pass rate |
|---|---|---|
| real | 178 | 0.93 |
| synthetic | 67 | 0.90 |
| edge | 30 | 0.83 |
| adversarial | 12 | 0.92 |

## Custo e latência
- p50: 1.1s, p95: 2.8s, p99: 4.2s
- avg cost per case: $0.0064
- total: $1.84

## Regressão vs último run com mesmo prompt_hash
- Último run: 2026-04-25T09:14 → pass rate 0.92
- Atual: 0.91
- Delta: -0.01 (dentro de ruído — sem regressão flagada)

## Top failures por categoria
### billing (4 fails)
- case-billing-014: agente classificou como "refund" → gabarito era "billing-late-fee"
- case-billing-027: ...

## Próximos passos sugeridos
- Edge cases tiveram pass rate 0.83 — investigar antes de promover modo
- Adicionar 5 cases sintéticos cobrindo o padrão "billing-late-fee" para reforço
```

## Output structured (return value)

```yaml
command: /novais-digital:eval
status: pass | fail | partial | error
artifact_id: <>
prompt_version: 0.1.0
prompt_hash: <>
report_path: evals/<>/runs/2026-04-30-1432-eval-<>.md
total_cases_evaluated: <N>
overall:
  pass_rate: 0.91
  threshold: 0.85
  status: pass
by_category:
  billing: { rate: 0.95, status: pass }
  refund: { rate: 0.88, status: pass }
  escalation: { rate: 0.86, status: pass }
by_source_mode:
  real: 0.93
  synthetic: 0.90
  edge: 0.83
  adversarial: 0.92
cost_usd_total: 1.84
latency_p95_ms: 2800
regression_detected: false
regression_delta: -0.01
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/novais-digital:promote --artifact_id=<> --to_mode=assisted" | "investigar fails antes de promover"
```

## Verification gate

- [x] `prompt_hash` registrado e idêntico ao do `system.md` lido
- [x] Eval suite atende C4: ≥ 30 cases por `outcome_category` declarada (a menos que `--subset` justifique)
- [x] **Cada case** com sub-trace registrado (C6) — 100%, sem amostragem
- [x] PASS/FAIL determinado por `case.criterio_pass`, não inferência humana
- [x] Métricas agregadas por categoria E por source_mode
- [x] Regressão calculada vs último run com mesmo `prompt_hash` (se houver)
- [x] Top failures listados (até 10 por categoria) para investigação
- [x] Custo total declarado em USD para auditoria de C3 implícita
- [x] Arquivo persistido em `evals/{artifact_id}/runs/` com nome incluindo `prompt_hash`
- [x] Status global: `pass` se TODAS categorias atingem threshold; `fail` se ≥1 falha; `partial` se subset

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Pass rate 0.84 vs threshold 0.85, arredondo pra 0.85" | Arredondamento aqui = SHADOW que não protege | `agreement_rate >= threshold` literal; status fail mesmo com 0.001 abaixo |
| "Eval com sample de 30% pra economizar" | Quebra cobertura C4; resultado não comparável entre runs | `--subset` aceito mas reportado como `partial`; **nunca** PASS global |
| "Judge model = target model pra simplificar" | Auto-juiz infla pass rate (modelo concorda com ele mesmo) | Judge default ≠ target; spec pode override mas com nota |
| "Latência alta? Reduzo timeout pra eval rodar mais rápido" | Casos timeout viram falsos negativos | Timeout = case fail explícito; relatório separa "fail" de "timeout" |
| "Edge cases têm pass rate baixa, ignoro categoria edge" | Edge é onde C4 protege; ignorar = SHADOW falsamente seguro | `by_source_mode` sempre presente; edge < 0.7 = warning forte |
| "Custo da eval é interno, não preciso reportar" | Reviewer audita custo de eval contra custo de produção | `cost_usd_total` mandatório; alto vs baseline indica prompt verboso |
| "Regressão de -0.05 é flutuação, ignoro" | Sem trigger de regressão, drift acumula entre versões | Regressão `delta < -0.02` flagada como warning; `< -0.05` = fail explícito |
| "Vou rodar eval só em CI, local fica lento" | Devs sem feedback rápido produzem prompt drift | Suporte local + CI; CI usa cache de provider quando possível |

## Saída de erro estruturada

```yaml
command: /novais-digital:eval
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `prompt_not_found` | `c4_coverage_insufficient` (categoria com < 30 cases) | `adapter_unconfigured` | `judge_model_unavailable` | `evals_dir_unwritable` | `provider_rate_limit_exceeded` | `case_format_invalid`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-2 onda 3 (validation) |
