---
description: Gera spec do artefato (platform-sku | product | diagnostic) a partir de docs/clients/{client}/diagnostic.md + process-map + helpers Tier 1. Usa o template apropriado ao --type. Persiste em docs/specs/{artifact_id}.md com cláusula de outcome literal e categorias declaradas.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - client_id
    - artifact_id
    - type
  optional:
    - source_diagnostic_path
    - source_process_map_path
forge_command_version: 0.1.0
linked_principles: [C1, C2, C8]
invokes_skills:
  - "@company-dna"
  - "@offerings-loader"
  - "@process-mapper"
output_artifact: docs/specs/{artifact_id}.md
trace_required: true
templates_by_type:
  platform-sku: templates/platform-sku-spec.template.md
  product: templates/product-spec.template.md
  diagnostic: templates/diagnostic-spec.template.md
---

# /acme:spec — Gera spec do artefato

## Propósito

Transforma diagnóstico aprovado em **spec contratual**: cláusula de outcome literal (C2), categorias declaradas, schema de input/output, lifecycle_stage, vínculo com baseline-cost. Persiste em `docs/specs/{artifact_id}.md`.

> Substitui o command `spec-sku` do roadmap original. O parâmetro `--type` resolve o template correto entre os 3 disponíveis pós-v0.2.0 (platform-sku, product, diagnostic).

## Pre-conditions

1. `docs/clients/{client_id}/diagnostic.md` existe com `go_no_go: go` (ou `needs-paid-diagnostic` resolvido)
2. `docs/clients/{client_id}/process-{name}.md` existe com `agent_readiness_score ≥ 0.5`
3. `--type` ∈ {platform-sku, product, diagnostic}
4. `artifact_id` único — não pode colidir com entrada existente em `__forge_cache.offerings`
5. Diretório `docs/specs/` existe e gravável

Se qualquer pré-condição falhar → erro estruturado.

## Inputs

```yaml
client_id: <slug>
artifact_id: <slug — será o id no catálogo, ex: triagem-tickets-tier1-v1>
type: platform-sku | product | diagnostic
# opcionais
source_diagnostic_path: docs/clients/{client_id}/diagnostic.md  # default
source_process_map_path: docs/clients/{client_id}/process-*.md   # auto-detect se único
```

## Execução

```
1. Trace start: trace_id = forge.trace.start("/acme:spec", {artifact_id, type, ...})

2. Helpers Tier 1:
   - @company-dna (tom, vocabulário, north-star — entram em "alinhamento estratégico" da spec)
   - @offerings-loader (validar id único; identificar variantes se aplicável)

3. Tier 2 — leitura:
   - Carregar source_diagnostic_path → extrair: declared_problem, proposed_outcome, threshold de qualidade, categorias candidatas
   - Carregar source_process_map_path → extrair: triggers, atores, decision points, automatable_hypotheses
   - Carregar baseline-cost-{process}.md (se existir) → c3_check; se ausente, marcar "baseline_pending: true"

4. Resolver template via --type:
   - platform-sku → templates/platform-sku-spec.template.md
   - product → templates/product-spec.template.md
   - diagnostic → templates/diagnostic-spec.template.md

5. Compor spec preenchendo o template com:
   - Cláusula de outcome ipsis literis do diagnostic.proposed_outcome.clause
   - 3+3 exemplos do diagnostic
   - trigger_event do diagnostic
   - outcome_categories derivadas dos decision points do process-map
   - threshold de qualidade do diagnostic
   - lifecycle_stage inicial: discovery (default) ou mvp (se já há código)
   - linked_principles inferidos por type
   - linked_cliente_artifacts: [diagnostic_path, process_map_path, baseline_cost_path?]

6. Validar contrato:
   - C2: cláusula presente + 3+3 exemplos + trigger_event
   - C8: nenhum nome de cliente literal nos campos da spec (apenas em linked_cliente_artifacts como ref)
   - C1: linked_diagnostic_path resolve em arquivo existente

7. Persistir docs/specs/{artifact_id}.md

8. Trace end + output structured
```

## Output structured

```yaml
command: /acme:spec
status: ok | error
artifact_id: <>
artifact_type: platform-sku | product | diagnostic
spec_path: docs/specs/<>.md
spec_version: 0.1.0
linked_diagnostic: docs/clients/<>/diagnostic.md
linked_process_map: docs/clients/<>/process-<>.md
linked_baseline_cost: docs/clients/<>/baseline-cost-<>.md | null
outcome_clause_hash: <sha256:16>   # ancora rastreabilidade contra prompt downstream
outcome_categories: [billing, refund, escalation]
lifecycle_stage_initial: discovery
c2_validation: pass | fail
c8_validation: pass | fail
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:unit-economics --artifact_id=<> --client_id=<>"
```

## Verification gate

- [x] Cláusula de outcome (seção contratual) idêntica à `diagnostic.proposed_outcome.clause` (compare hash)
- [x] 3+3 exemplos presentes; positivos ≠ negativos
- [x] `trigger_event` declarado e copiado
- [x] `outcome_categories` ≥ 1, derivadas de decision points
- [x] `lifecycle_stage_initial` ∈ {discovery, mvp}
- [x] Nenhum nome de cliente literal em campos da spec (lint regex em `client_id` value, não em `linked_*` paths)
- [x] `linked_diagnostic` resolve em arquivo existente com `go_no_go: go`
- [x] `outcome_clause_hash` registrado (consumido por `@artifact-prompt-builder` downstream)
- [x] `trace_id` não-nulo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou refinar a cláusula de outcome aqui na spec" | Cláusula vem do diagnostic — refinamento aqui descola contrato comercial do contrato técnico | Cláusula é literal; mudança exige re-`/acme:diagnose` |
| "Reusar spec de outro SKU 'parecido' como base" | Quebra C8; cláusula de outcome é única por artefato | `--type` resolve template; conteúdo vem do diagnostic deste cliente |
| "Hardcode `client_id` no prompt da spec pra ficar 'pronto'" | Quebra C8 (anti-customização heroica) | spec.client_id é apenas no campo `linked_cliente_artifacts`; corpo do prompt usa `{{tenant.*}}` |
| "Sem baseline-cost ainda, marco lifecycle_stage=ga" | Sem c3_check, GA é proibido (C3) | `lifecycle_stage_initial: discovery|mvp`; promoção a beta/ga exige unit-economics passing |
| "Cliente quer outcome diferente do diagnostic" | Mudou o contrato — diagnostic precisa ser revisado primeiro | Bloquear; rodar `/acme:diagnose` novamente para o cliente concordar com nova cláusula |
| "outcome_categories podem ser ajustadas no prompt depois" | Categorias são âncora de eval suite (C4) — mudança quebra suite | Categorias declaradas aqui são imutáveis; mudança exige nova `spec_version` |

## Saída de erro estruturada

```yaml
command: /acme:spec
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `diagnostic_not_go` | `process_map_below_readiness` | `artifact_id_collision` | `unknown_type` | `template_missing` | `c2_validation_failed` | `c8_validation_failed` | `specs_dir_unwritable`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — renomeada de `/acme:spec-sku` para `/acme:spec` com `--type` (Forge-2 onda 1) |
