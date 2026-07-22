---
name: baseline-cost-builder
description: "Calculates baseline economics for C3 gate. For agentic (ai_enabled=true): human cost × volume → min_price_per_outcome via cost_per_outcome model. For platform (ai_enabled=false): (infra + support + maintenance) / revenue → platform_margin model. Persists docs/clients/{client_id}/baseline-cost-{process_id}.md or docs/modules/{module_id}/delivery-economics-{module_id}.md."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L1/baseline-cost-builder.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  foundry-tier: 2
  foundry-version: "0.2.0"
  linked-principles: [C1, C2, C3]
  helper-pattern: none
---

# Skill: baseline-cost-builder — Tier 2 Tactical (Foundry)

Measures economics for C3 compliance. Operates in two modes based on `project.ai_enabled`:

- **`ai_enabled=true` (agentic)**: measures human cost of process → derives minimum sale price → C3 gate: `inference_cost / price ≤ 25%`. Output: `templates/unit-economics.template.md`.
- **`ai_enabled=false` (platform)**: measures operational cost → derives platform margin → C3 gate: `(infra + support + maintenance) / revenue ≤ 25%`. Output: `templates/delivery-economics.template.md`.

> **Does not estimate** — receives inputs declared by the client or operator. Estimation kills C3 silently in production.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read `__foundry_cache.offerings`, diagnostic, process-map |
| `write_file` | Persist `docs/clients/{client_id}/baseline-cost-{process_id}.md` |
| `execute` | Validate input ranges, compute formulas, render template |

---

## Execution Plan — mode detection

- [ ] 0. Read `docs/foundry/project.json` → `project.ai_enabled` (default `true` if absent)
- [ ] **If `ai_enabled=true`** → follow **agentic path** (Steps 1-9 below)
- [ ] **If `ai_enabled=false`** → follow **platform path** (Steps P1-P7 below)

### Agentic path (ai_enabled=true)

- [ ] 1. Verify Tier 1 cache present (`.deepagents/cache/offerings.yaml`)
- [ ] 2. Validate required parameters (client_id, process_id, volume_monthly, actors[], quality_baseline)
- [ ] 3. Cross-validate volume vs process-map throughput (±20%)
- [ ] 4. Compute `human_cost_monthly = Σ (actor.headcount × hourly_cost × hours_per_unit × volume_monthly × peak_factor)`
- [ ] 5. Compute `human_cost_per_unit`
- [ ] 6. Derive `min_price_per_outcome = inferred_inference_cost / target_cost_ratio`
- [ ] 7. Determine `c3_check.status` ∈ {viable, tight, unviable}
- [ ] 8. Render markdown from `templates/unit-economics.template.md` + write `docs/clients/{client_id}/baseline-cost-{process_id}.md`
- [ ] 9. Return summary YAML

### Platform path (ai_enabled=false)

- [ ] P1. Validate required parameters (module_id, infra_monthly_brl, support_monthly_brl, maintenance_monthly_brl, revenue_monthly_brl)
- [ ] P2. Compute `total_cost_monthly = infra_monthly_brl + support_monthly_brl + maintenance_monthly_brl`
- [ ] P3. Compute `platform_margin = total_cost_monthly / revenue_monthly_brl`
- [ ] P4. Determine `c3_check.status`: `viable` if ≤0.20, `tight` if ≤0.25, `unviable` if >0.25
- [ ] P5. Identify cost reduction levers if `unviable` or `tight`
- [ ] P6. Render markdown from `templates/delivery-economics.template.md` + write `docs/modules/{module_id}/delivery-economics-{module_id}.md`
- [ ] P7. Return summary YAML

---

## Prerequisites Check

```bash
test -f .deepagents/cache/offerings.yaml || {
  echo "ERROR: Tier 1 cache missing. Run offerings-loader first."; exit 1
}
test -f templates/unit-economics.template.md || {
  echo "ERROR: Template templates/unit-economics.template.md missing"; exit 1
}
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Need python3"; exit 1; }
```

---

## Input parameters

### Agentic inputs (ai_enabled=true)

```yaml
# required
client_id: <slug>
process_id: <slug>
volume_monthly: <int>
actors:
  - role: <ex: analista-n1>
    headcount_involved: <int>
    hourly_cost: <float>
    hours_per_unit: <float>
quality_baseline:
  error_rate: <0–1>
  rework_rate: <0–1>
data_source: <text>
data_confidence: high | medium | low

# optional
peak_factor: 1.0
sla_currently_paid: <float>
target_cost_ratio: 0.25
artifact_id: <slug>
```

### Platform inputs (ai_enabled=false)

```yaml
# required
module_id: <slug>
infra_monthly_brl: <float>      # hosting, DB, storage, CDN
support_monthly_brl: <float>    # customer success, helpdesk allocation
maintenance_monthly_brl: <float> # dev hours × rate for maintenance/bug fixes
revenue_monthly_brl: <float>    # MRR attributed to this module (or proportional share)
data_source: <text>
data_confidence: high | medium | low

# optional
target_margin_max: 0.25         # default 0.25 (C3 hard gate)
cost_reduction_levers: [<text>] # optional: known ways to reduce costs
```

---

## Step 1 — Validate inputs (via `execute`)

```bash
python3 - <<'PY'
import yaml, sys, json
inputs = json.loads(open('.deepagents/cache/baseline-inputs.json').read())
errs = []
if inputs.get('volume_monthly', 0) <= 0: errs.append('volume_monthly<=0')
for a in inputs.get('actors', []):
    if a.get('hourly_cost', 0) <= 0: errs.append(f"hourly_cost<=0:{a.get('role')}")
    if a.get('hours_per_unit', 0) <= 0: errs.append(f"hours_per_unit<=0:{a.get('role')}")
qb = inputs.get('quality_baseline', {})
if not (0 <= qb.get('error_rate', -1) <= 1): errs.append('error_rate_oor')
if not (0 <= qb.get('rework_rate', -1) <= 1): errs.append('rework_rate_oor')
if errs: print(f"FAIL: {errs}"); sys.exit(2)
print("OK")
PY
```

---

## Step 2 — Compute (via `execute`)

```bash
python3 - <<'PY'
import json, yaml, sys
i = json.loads(open('.deepagents/cache/baseline-inputs.json').read())
peak = i.get('peak_factor', 1.0)
volume = i['volume_monthly']
hcm = sum(a['headcount_involved'] * a['hourly_cost'] * a['hours_per_unit'] for a in i['actors']) * volume * peak
hcu = hcm / volume
target = i.get('target_cost_ratio', 0.25)
# inference cost: lê de spec se disponível, senão "to_measure_in_shadow"
inf = i.get('inferred_inference_cost')
if inf is None:
    min_price = None
    status = 'pending_shadow'
else:
    min_price = inf / target
    if min_price <= hcu * 0.7: status = 'viable'
    elif min_price <= hcu: status = 'tight'
    else: status = 'unviable'
out = {
    'human_cost_monthly_total': hcm,
    'human_cost_per_unit': hcu,
    'min_price_per_outcome': min_price,
    'c3_status': status
}
yaml.safe_dump(out, open('.deepagents/cache/baseline-result.yaml','w'))
print(yaml.safe_dump(out))
PY
```

---

## Step P — Platform margin compute (ai_enabled=false only)

```bash
python3 - <<'PY'
import json, yaml, sys
i = json.loads(open('.deepagents/cache/baseline-inputs.json').read())
infra = i['infra_monthly_brl']
support = i['support_monthly_brl']
maint = i['maintenance_monthly_brl']
revenue = i['revenue_monthly_brl']
limit = i.get('target_margin_max', 0.25)
total_cost = infra + support + maint
margin = total_cost / revenue if revenue > 0 else float('inf')
if margin <= 0.20: status = 'viable'
elif margin <= limit: status = 'tight'
else: status = 'unviable'
out = {
    'total_cost_monthly': total_cost,
    'revenue_monthly': revenue,
    'platform_margin': round(margin, 4),
    'platform_margin_pct': f"{margin*100:.1f}%",
    'c3_status': status,
    'c3_limit': limit
}
yaml.safe_dump(out, open('.deepagents/cache/platform-economics-result.yaml', 'w'))
print(yaml.safe_dump(out))
PY
```

---

## Step 3 — Cross-validate vs process-map

```bash
python3 - <<'PY'
import yaml, json, sys
i = json.loads(open('.deepagents/cache/baseline-inputs.json').read())
# read process-map metrics
import glob, re
mpath = glob.glob(f"docs/clients/{i['client_id']}/process-{i['process_id']}*.md")
if not mpath: print("WARN: process-map not found, skipping cross-validation"); sys.exit(0)
md = open(mpath[0]).read()
m = re.search(r'throughput_daily:\s*(\d+)', md)
if not m: print("WARN: throughput_daily not found in process-map"); sys.exit(0)
td = int(m.group(1))
expected = td * 30
delta = abs(i['volume_monthly'] - expected) / max(expected, 1)
if delta > 0.20:
    print(f"WARN volume_mismatch_diagnostic_vs_process_map delta={delta:.2%}")
else:
    print(f"OK delta={delta:.2%}")
PY
```

---

## Step 4 — Render and write

Read template, substitute placeholders, write file:

```
read_file: templates/unit-economics.template.md
write_file: docs/clients/{client_id}/baseline-cost-{process_id}.md
```

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Estimate volume from client size | C3 silently broken | Block with `inputs_missing.volume_monthly` |
| Use market average hourly_cost | Loaded cost varies 2-3x | Require declared; mark `data_confidence: low` if absent |
| Skip `quality_baseline` | C1 mandatory + C2 needs human reference | Block without error_rate + rework_rate |
| Just register client price | C3 still hard gate | Compute `min_price_per_outcome` and flag `price_mismatch` |
| Aggregate multi-actor as "team" | Loses traceability | Keep `actors[]` granular |
| Read eval-cases for reference | Tier 3 leakage | Block; C5 violation |

---

## Verification gate

- All required parameters validated
- Volume cross-validated against process-map (±20% or warn)
- `c3_check.status` declared with justification if `unviable`
- File `docs/clients/{client_id}/baseline-cost-{process_id}.md` persisted and parses
- No reads in Tier 3 paths
- `data_confidence` declared (no silent default)

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Build baseline cost for client novais-digital, process triagem-tickets-tier1
```

### Mode 2 — One-shot

```bash
deepagents -n -y "Build baseline-cost for client=novais-digital process=triagem-tickets \
  volume=1200 actors=[{role:analista-n1,headcount:3,hourly_cost:80,hours_per_unit:0.18}] \
  quality_baseline={error_rate:0.08,rework_rate:0.04} data_confidence=medium"
```

### Mode 3 — In CI (after diagnose)

```bash
deepagents -n -y "Run offerings-loader" > /dev/null
deepagents -n -y "Run baseline-cost-builder with inputs from .deepagents/cache/baseline-inputs.json"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `inputs_missing` | Required field absent | Collect from CFO/operations sessions |
| `c3_unviable` | Negative margin | Block `/novais-digital:sla-threshold`; renegotiate scope |
| `volume_mismatch` (>20%) | Diagnostic vs process-map disagree | Reconcile in another session |
| `data_confidence_low_blocked` | Settings require ≥medium | Schedule CFO session for hard data |

---

## Source

Original: `.claude/skills/L1/baseline-cost-builder.md`. Generated; do not edit by hand (F18).
