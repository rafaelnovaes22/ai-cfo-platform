---
name: offerings-loader
description: "Loads and exposes the organization's offerings catalog (products, platform-SKUs, diagnostics) with lifecycle_stage and pricing_model in compact YAML for Tier 1."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L0/offerings-loader.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  foundry-tier: 1
  foundry-version: "0.1.0"
  linked-principles: [C2, C5, C7]
  helper-pattern: bmad
---

# Skill: offerings-loader — Tier 1 Strategic (Foundry)

Loads the **offerings catalog** of the organization with `lifecycle_stage` and `pricing_model` per offering. Output ≤ 800 tokens (higher cap than DNA/ICP because it's a list).

> Tier 1: does not read Tier 2/3. Returns `spec_path` as **pointer**, not full content.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `glob` | Find offerings catalog + per-offering specs |
| `read_file` | Read catalog (and only catalog) |
| `write_file` | Persist `.deepagents/cache/offerings.yaml` |
| `execute` | Validate `lifecycle_stage` enum + outcome_clause requirement for GA |

---

## Execution Plan

- [ ] 1. Verify yq/python3
- [ ] 2. Resolve catalog path (precedence)
- [ ] 3. Read catalog markdown
- [ ] 4. For each offering, extract `id, name, category, pricing_model, lifecycle_stage, linked_outcome_clause, spec_path, last_reviewed`
- [ ] 5. Validate: every offering with `lifecycle_stage ∈ {ga, maturity}` has `linked_outcome_clause` (C2)
- [ ] 6. Persist `.deepagents/cache/offerings.yaml`
- [ ] 7. Return YAML to caller

---

## Prerequisites Check

```bash
command -v yq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: Need yq or python3"; exit 1
}
```

---

## Step 1 — Resolve catalog path

Precedence:

1. `docs/offerings.md`
2. `docs/portfolio.md`
3. `docs/strategy/portfolio.md`
4. `examples/*/portfolio.md` + `examples/*/products/*.md`

Use `glob`. If none → `offerings_missing: true`.

---

## Step 2 — Read catalog

```
read_file: <resolved_path>
```

If `examples/*/products/*.md` style, also `glob` for additional product specs and `read_file` each (small per-product summary, **not** full prompt content — Tier 1 keeps it compact).

---

## Step 3 — Parse

```yaml
offerings_loaded: true
source_paths: [<resolved>]
total_offerings: <N>
offerings:
  - id: <slug>
    name: <human>
    category: diagnostic | platform-sku | product | <other-declared>
    pricing_model: fixed-monthly | outcome-based | one-shot | hybrid
    lifecycle_stage: discovery | mvp | beta | ga | maturity | sunset
    linked_outcome_clause: <ref or null if diagnostic>
    spec_path: <docs/specs/.../spec.md or null>
    last_reviewed: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
```

---

## Step 4 — Validate

Via `execute`:

```bash
python3 - <<'PY'
import yaml, sys
d = yaml.safe_load(open('.deepagents/cache/offerings.yaml'))
errs = []
allowed_stage = {'discovery','mvp','beta','ga','maturity','sunset'}
allowed_pricing = {'fixed-monthly','outcome-based','one-shot','hybrid'}
for o in d.get('offerings', []):
    if o.get('lifecycle_stage') not in allowed_stage:
        errs.append(f"unknown_lifecycle:{o.get('id')}")
    if o.get('pricing_model') not in allowed_pricing:
        errs.append(f"unknown_pricing:{o.get('id')}")
    if o.get('lifecycle_stage') in {'ga','maturity'} and not o.get('linked_outcome_clause'):
        errs.append(f"ga_without_outcome_clause:{o.get('id')}")  # C2 violation
if not d.get('offerings'):
    errs.append("total_offerings<1")
if errs:
    print(f"FAIL: {errs}"); sys.exit(2)
print(f"OK total={len(d['offerings'])}")
PY
```

---

## Step 5 — Persist cache

`write_file: .deepagents/cache/offerings.yaml`

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| List only active offerings (skip discovery) | Catalog is governance input (C9 lifecycle) | Always list all with `lifecycle_stage` declared |
| Infer `pricing_model` from context | Ambiguous pricing breaks C2 + C3 | Fail validation; require explicit declaration |
| Read full spec content | Tier 1 stays compact | Return `spec_path` as pointer only |
| Treat outcome-less = diagnostic | Could be self-serve product | Require `category` from enum |
| Use 30-day-old cache | Catalog moves more than DNA/ICP | Cache scope = single run |

---

## Verification gate

- `offerings_loaded: true` in ≤ 800 tokens
- `total_offerings ≥ 1`
- Each offering has all required fields
- Every `lifecycle_stage ∈ {ga, maturity}` has `linked_outcome_clause`
- Every offering has either `linked_outcome_clause` or `spec_path` (unless `category=diagnostic`)
- Cache persisted

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Run offerings-loader against this repository
```

### Mode 2 — One-shot

```bash
deepagents -n -y "Run offerings-loader skill"
```

### Mode 3 — In CI

```bash
deepagents -n -y "Run offerings-loader skill" > /dev/null
deepagents -n -y "Run foundry-auditor for month 2026-04"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `offerings_missing` | No catalog file | Create `docs/portfolio.md` from `examples/novais-digital/portfolio.md` |
| `ga_without_outcome_clause` | Offering in GA lacks contractual outcome | Block; needs `/novais-digital:spec` to define outcome before GA |
| `unknown_lifecycle` | Stage not in enum | Use only: discovery, mvp, beta, ga, maturity, sunset |
| `unknown_pricing` | Pricing not in enum | Use only: fixed-monthly, outcome-based, one-shot, hybrid |

---

## Source

Original: `.claude/skills/L0/offerings-loader.md`. Generated; do not edit by hand (F18).
