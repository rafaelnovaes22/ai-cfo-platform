---
name: eval-case-author
description: Gera casos de eval para um artefato a partir de pares humano/agente reais (preferencial) ou casos sintéticos declarados (fallback). Persiste em evals/{artifact_id}/cases/case-{n}.md usando templates/eval-case.template.md. Skill Tier 3 — implementa C4 (≥30 casos por categoria de outcome antes de SHADOW), C2 (gabarito justificado), C6 (rastreabilidade ao trace de origem).
tier: 3
vocabulary_aliases: [L2, Operational, Micro]
linked_principles: [C2, C4, C6]
helper_pattern: none
cache_strategy: none
reads_from_tier: [1, 2, 3]
must_not_read: []
requires_helper:
  - skill: offerings-loader
    field: offerings
    optional: false
version: 0.1.0
activation:
  paths:
    - evals/*/cases/*.md
    - evals/*/index.md
    - templates/eval-case.template.md
  keywords: [eval case, gabarito, ground truth, fewshot, eval suite, edge case, synthetic case]
  explicit_invocation: "@eval-case-author"
parameters_required:
  - artifact_id
  - outcome_category
  - source_mode
parameters_optional:
  - source_run_id
  - source_trace_id
  - synthetic_seed
  - target_count
---

# eval-case-author — Skill Tier 3 (Operacional)

## Propósito

Gera **casos de eval** estruturados (input + gabarito + justificativa) que servem como:

1. **Critério de promoção** entre modos (C4: ≥30 casos por `outcome_category` para passar SHADOW)
2. **Few-shots** consumidos por `@artifact-prompt-builder`
3. **Regressão** detectada quando prompt muda (`prompt_hash` diferente → roda eval suite)
4. **Gabarito de drift detection** em produção

Esta skill **prefere casos reais** (extraídos de runs humano/agente do mesmo processo) e usa **sintéticos só como fallback declarado**. Casos sintéticos não declarados que entram na suite são **a causa #1** de eval suite que "passa" mas o agente quebra em produção.

## Quando ativa

1. **Path-scoped** — turno toca arquivo em `evals/`, ou `templates/eval-case.template.md`
2. **Keyword-scoped** — termo de `activation.keywords`
3. **Explícita** — `@eval-case-author artifact_id=triagem-tickets outcome_category=billing source_mode=real source_run_id=...`
4. **Slash command** — invocada por `/acme:eval` (Forge-2)

## Inputs Tier 1 (helpers)

| Helper | Por que precisa |
|---|---|
| `@offerings-loader` | Confirma que `artifact_id` existe no catálogo + obtém `lifecycle_stage` (afeta requisitos de eval) |

## Inputs Tier 2

| Artefato | Como usa |
|---|---|
| `docs/specs/{artifact_id}.md` | Categorias de outcome declaradas (cada categoria precisa cobertura mínima) |
| `docs/clients/{client_id}/process-{name}.md` | Decision points → derivam casos cobrindo cada branch |
| `docs/clients/{client_id}/baseline-cost-*.md` | Threshold de qualidade (taxa de erro humano = teto do erro do agente) |

## Inputs Tier 3

| Artefato | Como usa |
|---|---|
| `runs/{client_id}/{run_id}.json` (ou DB) | Source mode `real` — pares humano/agente para extrair input + gabarito |
| `traces/{trace_id}` | Recupera input/output exatos da execução |
| `evals/{artifact_id}/index.md` | Lista existente — evita duplicação; identifica gaps por categoria |

## Inputs Tier 3 (parâmetros)

Obrigatórios:

```yaml
artifact_id: <slug>
outcome_category: <ex: billing | scheduling | refund | escalation>
source_mode: real | synthetic | edge | adversarial
```

Opcionais:

```yaml
source_run_id: <run UUID>      # obrigatório se source_mode=real
source_trace_id: <trace UUID>  # alternativa a run_id
synthetic_seed: <descrição>    # obrigatório se source_mode=synthetic
target_count: <N>              # default: 10 (single batch); skill loop até atingir
include_pii: false             # default false; sanitização aplicada
```

## Source modes

| Mode | Origem do input | Origem do gabarito | Quando usar |
|---|---|---|---|
| **real** | Run real (Tier 3) | Output humano arquivado | Default — preferencial |
| **synthetic** | Geração baseada em `synthetic_seed` | Construído pelo autor com justificativa | Quando real é escasso (cliente novo) |
| **edge** | Input limítrofe construído | Comportamento esperado (recusar/escalar) | Cobertura de edge cases |
| **adversarial** | Input projetado para falhar | Comportamento de proteção (não responder, escalar) | C4 — proteção em SHADOW |

> Source mode é **rastreado em todo case**; reviewer DeepAgent audita proporção real vs synthetic — alvo: ≥ 60% real após 90 dias em SHADOW.

## O que entrega (return value)

```yaml
eval_cases_authored: true
artifact_id: triagem-tickets-tier1-v1
outcome_category: billing
batch_count: 10
files_created:
  - evals/triagem-tickets-tier1-v1/cases/case-billing-031.md
  - evals/triagem-tickets-tier1-v1/cases/case-billing-032.md
  - ...
source_mode_breakdown:
  real: 7
  synthetic: 2
  edge: 1
  adversarial: 0
coverage_after:
  total_cases_for_artifact: 78
  cases_in_category_billing: 41
  c4_threshold_met: true   # ≥30 nesta categoria
  pending_categories:
    - { category: refund, current: 12, needed: 18 }
quality_checks:
  pii_sanitized: true
  ground_truth_justified: true
  no_duplicates: true
generated_at: 2026-04-30T...
```

## Estrutura canônica do arquivo (`templates/eval-case.template.md`)

```markdown
---
case_id: case-billing-031
artifact_id: triagem-tickets-tier1-v1
outcome_category: billing
source_mode: real
source_run_id: <UUID> | null
source_trace_id: <UUID> | null
authored_at: 2026-04-30
authored_by: eval-case-author@0.1.0 + <human reviewer or null>
pii_sanitized: true
synthetic_seed: null
linked_principles: [C2, C4, C6]
---

## Input

{conteúdo limpo, sanitizado, fielmente representando entrada real ou seed sintético}

## Gabarito (output esperado)

{output estruturado conforme schema da spec}

## Justificativa do gabarito

Por que essa é a resposta correta? Qual o raciocínio humano por trás?
{texto justificando a decisão — mandatório, não-vazio}

## Critério de PASS

Comparação:
- exact_match: <campos que devem bater literalmente>
- semantic_match: <campos com tolerância semântica + threshold>
- llm_as_judge: <campos avaliados por outro modelo + critérios>

## Edge case characteristics (se source_mode=edge|adversarial)

- Por que é limítrofe: ...
- O que o agente pode errar: ...
- Recusa esperada: sim | não
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou gerar 30 casos sintéticos rapidinho" | Suite com 100% sintético engana — passa em eval, quebra em produção | Cap default ≤ 40% sintético; flagar `eval_suite_synthetic_heavy` se > 50% |
| "Gabarito sem justificativa, pra acelerar" | Gabarito sem justificativa não permite drift detection nem ajuste; fonte de "está certo porque sim" | Bloquear arquivo com `## Justificativa do gabarito` vazio |
| "Reusar input idêntico com gabaritos diferentes" | Cria contradição na suite; eval-as-judge fica não-determinística | Verificar duplicidade por hash do input antes de persistir |
| "PII fica, depois a gente sanitiza" | PII vaza para logs do provedor de eval; LGPD/GDPR risco real | Sanitização aplicada **antes** de persistir; `pii_sanitized: true` mandatório |
| "Edge cases são chatos, deixo pra depois" | Edge é onde C4 protege; SHADOW sem edge = false sense of safety | `target_coverage` exige ≥ 10% edge + adversarial após 30 casos por categoria |
| "Vou copiar caso do cliente A para o cliente B" | Cross-tenant data leakage; quebra C8 e LGPD | `source_run_id` validado contra `client_id` do artifact |
| "Run real teve erro humano, ignoro" | Erros humanos reais são gold para edge cases | Promover a `source_mode: edge` com nota; gabarito = comportamento corrigido |
| "Threshold C4 (30 casos) é arbitrário, posso ir com menos" | É arbitrário mas é hard gate; flexibilizar = SHADOW que não protege | Bloquear promoção SHADOW → ASSISTED se `c4_threshold_met: false` |

## Verification gate

- [x] `outcome_category` ∈ enum declarado em `spec.outcome_categories`
- [x] `source_mode` declarado e consistente com inputs (ex: `real` exige `source_run_id` ou `source_trace_id`)
- [x] Cada caso persistido tem: `case_id` único, `input` não-vazio, `gabarito` não-vazio, `justificativa` não-vazia, `pii_sanitized: true`
- [x] Hash do `input` único na suite (sem duplicatas)
- [x] Para `source_mode=real`: `source_run_id` resolve em run que pertence ao mesmo `client_id` do artifact
- [x] Para `source_mode=synthetic`: `synthetic_seed` declarado
- [x] Para `source_mode=edge|adversarial`: seção "Edge case characteristics" preenchida
- [x] Sanitização PII validada (regex de email/CPF/CNPJ/telefone retorna 0 matches)
- [x] `evals/{artifact_id}/index.md` atualizado com novos cases
- [x] Quality checks no return value sem `false`

Se algum item falhar → não persiste o case afetado; outros do batch podem prosseguir.

## C5 — leitura permitida

Tier 3 lê todos os tiers (1, 2, 3). Sem restrição em entrada.

Restrições em saída:

- **Não** escreve fora de `evals/{artifact_id}/`
- **Não** modifica runs originais (`runs/`, `traces/`) — read-only
- **Não** escreve em `prompts/` (responsabilidade de `@artifact-prompt-builder`)

## Saída de erro estruturada

```yaml
eval_cases_authored: false
error: <enum>
files_skipped: [...]
hint: <ação>
```

`error` ∈ `inputs_missing` | `outcome_category_unknown` (não está em spec) | `source_run_not_found` | `source_run_wrong_tenant` (cross-tenant block — viola C8) | `pii_sanitization_failed` | `duplicate_input_hash` | `synthetic_seed_missing` | `evals_dir_unwritable` | `c4_coverage_below_threshold` (warn, não-bloqueante).

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@offerings-loader` | upstream (helper) | `__forge_cache.offerings` |
| `@process-mapper`, `@diagnostic-runner` | upstream (Tier 2) | Decision points + categorias informam cobertura |
| `@artifact-prompt-builder` | par-Tier 3 | Consome casos como few-shots |
| `@shadow-mode-runner` | downstream | Compara output do agente vs gabarito desta suite |
| `@eval-engineer` (Guardian, Forge-3) | reviewer | Audita qualidade da suite (cobertura, sanitização, real vs synthetic) |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-1 onda 3 (Tier 3) |
