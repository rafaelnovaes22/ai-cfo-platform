---
name: artifact-prompt-builder
description: "Builds versioned system prompt of an artifact (platform-sku, product, diagnostic) from spec + process-map + baseline-cost + Tier 1 helpers. Tier 3 operational — produces prompts/{artifact_id}/v{version}/system.md with sha256:16 prompt_hash, mandatory C6 instrumentation, and zero per-tenant hardcode (C8). Triggers recalc_unit_economics."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L2/artifact-prompt-builder.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  foundry-tier: 3
  foundry-version: "0.1.0"
  linked-principles: [C2, C5, C6, C7, C8]
  helper-pattern: none
---

# Skill: artifact-prompt-builder — Tier 3 Operational (Foundry)

> **applies_when**: `project.ai_enabled = true` — This skill builds LLM system prompts and is only applicable to agentic artifacts. For platform modules (`ai_enabled=false`), there are no prompts to build; use `platform-module-spec.template.md` and `acceptance-report.template.md` instead.

Translates the chain `diagnostic → spec → process-map → baseline-cost` into a **versioned, instrumented system prompt** ready to deploy. Output is the artifact-of-record under `prompts/{artifact_id}/v{version}/system.md`.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read Tier 1 caches, spec, process-map, baseline-cost, eval cases (optional fewshots) |
| `write_file` | Persist `prompts/{artifact_id}/v{version}/system.md` |
| `execute` | Compute `prompt_hash`, validate 9 sections, lint anti-tenant-hardcode (C8) |

---

## Execution Plan

- [ ] 1. Verify Tier 1 caches (dna, offerings)
- [ ] 2. Validate parameters (artifact_id, artifact_type, spec_path, process_map_path, baseline_cost_path)
- [ ] 3. Read Tier 2 inputs (spec, process-map, baseline-cost)
- [ ] 4. Read Tier 3 fewshots (optional, from eval-cases)
- [ ] 5. Compose prompt in 9 canonical sections
- [ ] 6. Compute `prompt_hash = sha256(content)[:16]`
- [ ] 7. Lint: no tenant name literals in body (C8)
- [ ] 8. Write to `prompts/{artifact_id}/v{version}/system.md` with frontmatter
- [ ] 9. Emit return value with `recalc_unit_economics_required: true`

---

## Prerequisites Check

```bash
test -f .deepagents/cache/dna.yaml || { echo "ERROR: Run company-dna first"; exit 1; }
test -f .deepagents/cache/offerings.yaml || { echo "ERROR: Run offerings-loader first"; exit 1; }
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || {
  echo "ERROR: Need sha256sum or shasum"; exit 1
}
```

---

## The 9 canonical sections

```markdown
# {artifact_name} — System Prompt v{version}

## 1. Identidade e propósito
{1-3 sentences from spec.purpose aligned with dna.purpose}

## 2. Contexto da organização (Tier 1, fixed)
{__foundry_cache.dna compact form}

## 3. Cláusula de outcome (C2 — non-negotiable)
{spec.outcome_clause LITERAL}
- Counts as DELIVERED if: {trigger_event}
- Positive examples: {≥3}
- Negative examples: {≥3}

## 4. Inputs esperados
{schema declared in spec — required + optional + types}

## 5. Processo operacional (do process-map)
{numbered steps, decision points with criteria, branches}

## 6. Guard-rails
- Custo máximo por outcome: {baseline.min_price_per_outcome × C3.target_ratio}
- Categorias fora de escopo: {spec.out_of_scope}
- Quando recusar/escalar: {explicit rules}

## 7. Output schema
{structured schema — JSON or YAML — required fields + enums}

## 8. Instrumentação obrigatória (C6)
- Toda chamada deve gerar trace via {provider in spec}
- Campos: {input_hash, output_hash, outcome_category, confidence, latency, cost}
- Sem trace = outcome não conta

## 9. Variantes e configuração de tenant (C8)
- Variáveis tenant: {{tenant.field_X}} resolved at runtime via TenantContext
- PROIBIDO: lógica condicional por nome de tenant
```

Frontmatter of final file:

```yaml
---
artifact_id: <>
artifact_type: <>
prompt_version: 1.0.0
prompt_hash: <sha256:16>
generated_at: <ISO-8601>
foundry_skill_version: artifact-prompt-builder@0.1.0
linked_principles: [C2, C5, C6, C7, C8]
inputs_used:
  spec: { path, hash }
  process_map: { path, hash }
  baseline_cost: { path, hash }
  dna_cache_key: dna
  fewshots_from: [...]
target_model_advisory: claude-sonnet
portability_layer_required: src/llm/
recalc_unit_economics: required
---
```

---

## Step 6 — Compute prompt_hash (via `execute`)

```bash
sha256sum prompts/{artifact_id}/v{version}/system.md \
  | cut -c1-16 \
  | tee .deepagents/cache/prompt-hash.txt
# fallback: shasum -a 256 ... | cut -c1-16
```

---

## Step 7 — Lint anti-tenant-hardcode (C8) (via `execute`)

```bash
# Detect tenant name literals in the prompt body (excluding frontmatter)
grep -E "(tenant_id|tenantId|tenantName)\s*===?\s*['\"]" \
  prompts/{artifact_id}/v{version}/system.md && {
  echo "FAIL tenant_hardcode_detected (C8 violation)"
  exit 8
}
# Detect literal tenant names in plain prose (heuristic: known clients)
# (Optional — depends on examples/novais-digital/clients list)
echo "OK"
```

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Copy from "similar" SKU | C8 + omits unique outcome clause | Build from this spec; reuse via "variant" in catalog |
| Abbreviate outcome clause | C2 is contractual | Copy `spec.outcome_clause` verbatim with 3+3 examples |
| Inline DNA into prompt body | Blows tokens; defeats helper | Reference `__foundry_cache.dna`; runtime injects |
| Skip instrumentation section | C6 violation | Section 8 mandatory; verification gate fails without |
| `if tenant_id == 'novais-digital'` | C8 violation | `{{tenant.tone_preference}}` via TenantContext |
| XML tags Anthropic-only | C7 violation | Universal markdown; provider-specific in `src/llm/adapters/` |
| Same hash, no version bump | Drift hides recalc | Any hash change → new `v{x}` + `recalc_unit_economics_required: true` |
| Real fewshots with PII | LGPD/privacy risk | Sanitize or mark `synthetic: true` in eval-case |

---

## Verification gate

- All 9 canonical sections present
- Section 3 outcome clause matches `spec.outcome_clause` (hash compare)
- Section 8 (C6) present with required fields
- No tenant name literals in body (lint passes)
- Section 7 output schema declared with types
- Frontmatter `prompt_hash` registered
- Frontmatter `inputs_used.{spec,process_map,baseline_cost}.hash` captured (traceability)
- `recalc_unit_economics_required: true` always set
- File persisted at versioned path
- Token estimate computed and within spec limit (if any)

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Build prompt for artifact triagem-tickets-tier1-v1, type platform-sku, \
  using docs/specs/triagem-tickets.md and docs/clients/novais-digital/process-triagem.md
```

### Mode 2 — One-shot

```bash
deepagents -n -y "Run artifact-prompt-builder for artifact_id=triagem-tickets-tier1-v1 \
  artifact_type=platform-sku spec_path=docs/specs/triagem-tickets.md \
  process_map_path=docs/clients/novais-digital/process-triagem.md \
  baseline_cost_path=docs/clients/novais-digital/baseline-cost-triagem.md"
```

### Mode 3 — In CI as part of /novais-digital:implement

```bash
# Wave 2 of /novais-digital:implement invokes this skill
deepagents -n -y "Run artifact-prompt-builder using config in .deepagents/cache/build-config.json"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `spec_outcome_clause_missing` | Spec lacks `c2_validation: pass` | Re-run `/novais-digital:spec` |
| `process_map_below_readiness` | `agent_readiness_score < 0.5` | Re-run `process-mapper` with more data |
| `tenant_hardcode_detected` | Lint regex matched | Replace literal with `{{tenant.field}}` |
| `instrumentation_section_missing` | Section 8 absent | Regenerate from template; never skip |
| `output_schema_missing` | Section 7 incomplete | Spec must declare output_schema first |
| `baseline_unviable` | C3 inviable | Re-negotiate scope before prompt build |

---

## Source

Original: `.claude/skills/L2/artifact-prompt-builder.md`. Generated; do not edit by hand (F18).
