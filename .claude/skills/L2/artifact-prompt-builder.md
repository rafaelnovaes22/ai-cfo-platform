---
name: artifact-prompt-builder
description: Constrói system prompt versionado de um artefato (SKU de plataforma, produto self-serve, diagnóstico) a partir de spec + process-map + baseline-cost + helpers Tier 1. Skill Tier 3 — produz arquivo `prompts/{artifact_id}/v{version}/system.md` com hash, instrumentação obrigatória C6 e zero hardcode por tenant (C8). Mudanças no prompt disparam recálculo de unit-economics.
tier: 3
vocabulary_aliases: [L2, Operational, Micro]
linked_principles: [C2, C5, C6, C7, C8]
helper_pattern: none
cache_strategy: none
reads_from_tier: [1, 2, 3]
must_not_read: []
requires_helper:
  - skill: company-dna
    field: dna
    optional: false
  - skill: offerings-loader
    field: offerings
    optional: false
version: 0.1.0
activation:
  paths:
    - prompts/*/v*/system.md
    - docs/specs/**/*.md
    - templates/platform-sku-spec.template.md
    - templates/product-spec.template.md
    - templates/diagnostic-spec.template.md
  keywords: [system prompt, artifact prompt, prompt builder, prompt versioning, prompt hash]
  explicit_invocation: "@artifact-prompt-builder"
parameters_required:
  - artifact_id
  - artifact_type
  - spec_path
  - process_map_path
  - baseline_cost_path
parameters_optional:
  - target_model
  - prompt_version_strategy
  - eval_cases_path
---

# artifact-prompt-builder — Skill Tier 3 (Operacional)

## Propósito

Traduz a cadeia `diagnostic → spec → process-map → baseline-cost` em **system prompt versionado e instrumentado**, pronto para deploy. Output é um arquivo `prompts/{artifact_id}/v{version}/system.md` com hash, lista de placeholders, contrato de input/output e instruções obrigatórias de tracing (C6).

Esta skill **não escolhe modelo**. Ela produz prompt **portável** (C7): o mesmo arquivo serve Claude, GPT, Gemini, com layer de adaptação na camada `src/llm/` do projeto consumidor.

## Quando ativa

1. **Path-scoped** — turno toca arquivo em `prompts/`, `docs/specs/`, ou um dos templates de spec
2. **Keyword-scoped** — termo de `activation.keywords`
3. **Explícita** — `@artifact-prompt-builder artifact_id=triagem-tickets-v1 artifact_type=platform-sku spec_path=docs/specs/sku-triagem.md ...`
4. **Slash command** — invocada por `/novais-digital:plan` ou `/novais-digital:implement` (Foundry-2)

## Inputs Tier 1 (helpers)

| Helper | Por que precisa |
|---|---|
| `@company-dna` | Tom, vocabulário, north-star — entram como contexto fixo do prompt |
| `@offerings-loader` | Confirma que `artifact_id` existe no catálogo no `lifecycle_stage` declarado |

## Inputs Tier 2 (lê arquivos do mesmo cliente)

| Artefato | Como usa |
|---|---|
| `docs/specs/{artifact_id}.md` | Cláusula de outcome (C2), categorias de outcome, threshold de qualidade |
| `docs/clients/{client_id}/process-{name}.md` | Steps, decision points, automatable hypotheses → instruções operacionais do prompt |
| `docs/clients/{client_id}/baseline-cost-{process_id}.md` | Threshold de custo por outcome (C3) — entra como guard-rail no prompt |

## Inputs Tier 3 (opcional)

| Artefato | Como usa |
|---|---|
| `evals/{artifact_id}/cases/case-*.md` | Few-shot examples (se eval suite madura) — selecionados por estratégia declarada |

## Inputs Tier 3 (parâmetros)

Obrigatórios:

```yaml
artifact_id: <slug, ex: triagem-tickets-tier1-v1>
artifact_type: platform-sku | product | diagnostic
spec_path: docs/specs/...
process_map_path: docs/clients/.../process-*.md
baseline_cost_path: docs/clients/.../baseline-cost-*.md
```

Opcionais:

```yaml
target_model: claude-sonnet | claude-opus | gpt-5.5 | gemini-pro  # default: lê de spec
prompt_version_strategy: semver | datestamp  # default: semver
eval_cases_path: evals/{artifact_id}/cases/  # se houver
fewshot_count: <N>  # default: 3
```

## O que faz

1. Valida inputs (paths existem, parseiam, frontmatter consistente)
2. Carrega `__foundry_cache.{dna,offerings}` (helpers L0)
3. Lê spec, process-map, baseline (Tier 2)
4. Lê eval-cases (Tier 3) se path fornecido — seleciona few-shots
5. Compõe prompt em **estrutura canônica de 9 seções** (abaixo)
6. Calcula `prompt_hash` (sha256 truncado 16) do conteúdo final
7. Persiste em `prompts/{artifact_id}/v{version}/system.md` com frontmatter de versionamento
8. Emite handoff para `@unit-economist` (Foundry-3 Guardian) recalcular tokens

## Estrutura canônica do system prompt (9 seções)

```markdown
# {artifact_name} — System Prompt v{version}

## 1. Identidade e propósito
{1-3 frases vindas de spec.purpose + dna.purpose alinhado}

## 2. Contexto da organização (Tier 1, fixo)
{__foundry_cache.dna em forma compacta — purpose, mission, north_star_metric, values}

## 3. Cláusula de outcome (C2 — não-negociável)
{spec.outcome_clause ipsis literis}
- Conta como DELIVERED se: {trigger_event}
- Exemplos positivos: {3+}
- Exemplos negativos: {3+}

## 4. Inputs esperados
{schema declarado em spec — campos obrigatórios + opcionais + tipos}

## 5. Processo operacional (do process-map)
{steps numerados, decision points com critérios, branches}

## 6. Guard-rails
- Custo máximo por outcome: {baseline.min_price_per_outcome × C3.target_ratio}
- Categorias fora de escopo: {spec.out_of_scope}
- Quando recusar/escalar: {regras explícitas}

## 7. Output schema
{schema estruturado — JSON ou YAML — com campos obrigatórios e enums}

## 8. Instrumentação obrigatória (C6)
- Toda chamada deve gerar trace via {provider declarado em spec}
- Campos no trace: {input_hash, output_hash, outcome_category, confidence, latency, cost}
- Sem trace = outcome não conta

## 9. Variantes e configuração de tenant (C8)
- Variáveis de tenant: {{tenant.field_X}} resolvidas em runtime via TenantContext
- PROIBIDO: lógica condicional por nome de tenant
```

Frontmatter do arquivo final:

```yaml
---
artifact_id: <>
artifact_type: <>
prompt_version: 1.0.0
prompt_hash: <sha256:16>
generated_at: 2026-04-30T...
foundry_skill_version: artifact-prompt-builder@0.1.0
linked_principles: [C2, C5, C6, C7, C8]
inputs_used:
  spec: { path, hash }
  process_map: { path, hash }
  baseline_cost: { path, hash }
  dna_cache_key: dna
  fewshots_from: [evals/.../case-3.md, evals/.../case-7.md]
target_model_advisory: claude-sonnet
portability_layer_required: src/llm/
recalc_unit_economics: required
---
```

## O que entrega (return value)

```yaml
prompt_built: true
artifact_id: triagem-tickets-tier1-v1
prompt_path: prompts/triagem-tickets-tier1-v1/v1.0.0/system.md
prompt_hash: a3f9...c2e1
prompt_tokens_estimated: 2840
prompt_tokens_breakdown:
  static: 1200   # seções 1, 2, 3 (cacheable)
  per_call: 1640 # seções 4-9 + few-shots
sections_present: [1, 2, 3, 4, 5, 6, 7, 8, 9]
guardrails_count: <N>
fewshots_included: 3
output_schema_declared: true
instrumentation_block_present: true
tenant_hardcode_detected: false
recalc_unit_economics_required: true
generated_at: 2026-04-30T...
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou copiar o prompt de outro SKU parecido e ajustar" | Quebra C8 (anti-customização heroica) e omite cláusula de outcome única | Construir do zero a partir desta spec/process-map; reuso vem via "variante de SKU" no catálogo, não copy-paste |
| "Cláusula de outcome fica óbvia, abrevio" | Quebra C2 — cláusula é contratual; abreviar = ambiguidade em produção | Copiar `spec.outcome_clause` ipsis literis com 3+3 exemplos |
| "Vou inserir DNA inline" | Estoura tokens; quebra modelo de helper pattern (cache de Tier 1) | Referenciar `__foundry_cache.dna` compacto; provider de runtime injeta cacheado |
| "Sem instrumentação fica mais limpo" | Quebra C6 — sem trace, outcome não conta; reviewer falha auditoria | Seção 8 é obrigatória; verification gate falha sem ela |
| "If tenant_id == 'novais-digital' usa tom diferente" | Quebra C8 — hardcode por tenant é proibido | Usar `{{tenant.tone_preference}}` resolvido em runtime; configurar no TenantContext |
| "Modelo é Claude, posso usar XML tags Anthropic-only" | Quebra C7 (portability) — prompt fica preso a um provider | Escrever em markdown estruturado universal; XML tags só na camada de adaptação `src/llm/` |
| "Prompt mudou pouco, mantenho version" | Hash diferente = nova versão; sem bump, drift de unit-economics passa despercebido | Toda mudança de hash dispara `recalc_unit_economics_required: true` e novo `v{x}` |
| "Few-shots reais com PII estão ok" | Quebra LGPD/privacidade; prompts entram em logs de provedores | Few-shots com PII devem ser sanitizados ou marcados `synthetic: true` em eval-case |

## Verification gate

- [x] Todas as 9 seções canônicas presentes
- [x] Cláusula de outcome (seção 3) idêntica à `spec.outcome_clause` (compare hash)
- [x] Seção 8 (instrumentação C6) presente com campos mínimos: `input_hash, output_hash, outcome_category, confidence, latency, cost`
- [x] Nenhum nome de tenant em string literal no prompt (lint regex)
- [x] Output schema (seção 7) declarado com tipos
- [x] Frontmatter `prompt_hash` calculado e registrado
- [x] Frontmatter `inputs_used.{spec,process_map,baseline_cost}.hash` capturado (rastreabilidade)
- [x] `recalc_unit_economics_required: true` definido (sempre, em qualquer build)
- [x] Arquivo persistido em path versionado `prompts/{artifact_id}/v{version}/system.md`
- [x] Token estimate calculado e dentro do limite declarado em spec (se houver)

Se algum item falhar → erro estruturado; **não** persiste prompt parcial.

## C5 — leitura permitida

Tier 3 lê **todos os tiers** (1, 2, 3). Sem restrição.

Mas continua aplicado:

- **Não** pode escrever em `.claude/CONSTITUTION.md`, `manifest.json`, ou outros artefatos de governança
- **Não** pode invocar tools de produção (rate-limited; só leitura + escrita em `prompts/`)

## Saída de erro estruturada

```yaml
prompt_built: false
error: <enum>
hint: <ação>
```

`error` ∈ `inputs_missing` | `spec_outcome_clause_missing` (viola C2) | `process_map_below_readiness` (`agent_readiness_score < 0.5`) | `baseline_unviable` (C3 inviável) | `tenant_hardcode_detected` (viola C8) | `instrumentation_section_missing` (viola C6) | `output_schema_missing` | `prompts_dir_unwritable`.

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@company-dna`, `@offerings-loader` | upstream (helpers) | `__foundry_cache` |
| `@diagnostic-runner`, `@baseline-cost-builder`, `@process-mapper` | upstream (Tier 2) | Lê artefatos persistidos |
| `@eval-case-author` | par-Tier 3 | Recebe few-shots |
| `@shadow-mode-runner` | downstream | Consome o prompt construído para SHADOW |
| `@sku-architect`, `@unit-economist` (Guardians, Foundry-3) | reviewer | Validam prompt antes de promover modo |
| `@code-reviewer-cross` (DeepAgent, Foundry-3) | reviewer | Auditoria mensal |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-1 onda 3 (Tier 3) |
