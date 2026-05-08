---
name: diagnostic-runner
description: "Conducts a guided 10-block Phase 0 diagnostic session with the client decision-maker — qualifies problem, measures human baseline, proposes contractual outcome, validates ICP fit, and persists docs/clients/{client_id}/diagnostic.md. Implements C1 and opens C2."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L1/diagnostic-runner.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  forge-tier: 2
  forge-version: "0.1.0"
  linked-principles: [C1, C2]
  helper-pattern: none
---

# Skill: diagnostic-runner — Tier 2 Tactical (Forge)

Entry point of the pipeline `diagnose → spec → unit-economics → ... → promote`. Executes the **10-block diagnostic script** and persists `docs/clients/{client_id}/diagnostic.md` satisfying C1.

> Does not sell, does not architect, does not promise tech. **Qualifies**.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read Tier 1 caches (dna, icp, offerings) |
| `write_file` | Persist `docs/clients/{client_id}/diagnostic.md` |
| `execute` | Validate ICP fit, catalog fit, outcome examples count |
| `task` | (optional) Parallel sub-flows when multiple processes are diagnosed in same session |

---

## Execution Plan

- [ ] 1. Verify Tier 1 caches present (dna, icp, offerings)
- [ ] 2. Validate required parameters (client_id, interlocutor_role, declared_problem)
- [ ] 3. Run 10 diagnostic blocks (script below)
- [ ] 4. Compute icp_fit (internal — compare with __forge_cache.icp)
- [ ] 5. Compute catalog_fit (internal — compare with __forge_cache.offerings)
- [ ] 6. Render diagnostic.md from template + write file
- [ ] 7. Emit handoff for baseline-cost-builder + process-mapper

---

## Prerequisites Check

```bash
for f in dna icp offerings; do
  test -f .deepagents/cache/$f.yaml || {
    echo "ERROR: Tier 1 cache .deepagents/cache/$f.yaml missing"
    exit 1
  }
done
test -f templates/diagnostic-spec.template.md || {
  echo "ERROR: Template missing"; exit 1
}
```

---

## The 10-block diagnostic script

| # | Block | Anchor question | Output |
|---|---|---|---|
| 1 | Declared problem | "In one sentence, what do you need to solve?" | Verbatim text |
| 2 | Cost of unsolved | "What happens in 6 months if nothing changes?" | Financial/operational impact |
| 3 | Human baseline | "Who runs it today? How long? Error rate?" | Inputs for `baseline-cost-builder` |
| 4 | Prior attempts | "Tried before? What failed?" | Risk history |
| 5 | Outcome candidate | "What counts as 'done'? Give 3 examples + 3 non-examples" | Preliminary clause (C2) |
| 6 | Success metric | "How do we know in 90 days this worked?" | Metric + target + window |
| 7 | Error tolerance | "What % agent error vs human is acceptable?" | Quality threshold |
| 8 | ICP fit | (internal — compare cache) | Score: fit / edge / out_of_icp |
| 9 | Catalog fit | (internal — compare cache) | existing-sku / variant / new |
| 10 | Next steps | "Pay for diagnostic? Timeline?" | GO/NO-GO + diagnostic value |

> Blocks 8 and 9 are **internal** — no question to client; skill consults caches and records result.

---

## Step 8 — ICP fit (via `execute`)

```bash
python3 - <<'PY'
import yaml, json
icp = yaml.safe_load(open('.deepagents/cache/icp.yaml'))
session = json.loads(open('.deepagents/cache/diagnostic-session.json').read())
# Match declared_problem context against segments + qualification + disqualification
matches_qual = sum(1 for s in icp.get('qualification_signals', []) if s.lower() in session['declared_problem'].lower())
matches_anti = sum(1 for s in icp.get('disqualification_signals', []) if s.lower() in session['declared_problem'].lower())
if matches_anti > 0: print('out_of_icp')
elif matches_qual >= 2: print('fit')
else: print('edge')
PY
```

---

## Step 9 — Catalog fit (via `execute`)

```bash
python3 - <<'PY'
import yaml, json
off = yaml.safe_load(open('.deepagents/cache/offerings.yaml'))
session = json.loads(open('.deepagents/cache/diagnostic-session.json').read())
problem = session['declared_problem'].lower()
matches = [o for o in off.get('offerings', []) if any(kw in problem for kw in o.get('keywords', []))]
if matches and matches[0].get('lifecycle_stage') in {'ga','maturity'}:
    print(f"existing-sku:{matches[0]['id']}")
elif matches:
    print(f"variant:{matches[0]['id']}")
else:
    print("new")
PY
```

---

## Output schema (return value)

```yaml
diagnostic_run: true
artifact_path: docs/clients/<>/diagnostic.md
client_id: <>
session_minutes_actual: <N>
icp_fit: fit | edge | out_of_icp
catalog_fit: existing-sku | variant | new
proposed_outcome:
  clause: "<sentence>"
  positive_examples: [...]   # ≥ 3
  negative_examples: [...]   # ≥ 3
  trigger_event: <technical event>
baseline_inputs_handoff:
  ready_for: "baseline-cost-builder"
  fields_collected: [volume_monthly, actors, hours_per_unit, error_rate, rework_rate]
  fields_missing: []
go_no_go: go | no-go | needs-paid-diagnostic
next_step: "Run baseline-cost-builder; then /acme:spec"
```

---

## Verification gate

- All 10 blocks produced output (or `not_applicable` justified)
- `proposed_outcome.clause` + ≥3 positive + ≥3 negative + `trigger_event` present
- `icp_fit` ∈ {fit, edge, out_of_icp} declared
- `catalog_fit` declared
- `go_no_go` declared with justification
- File persisted in `docs/clients/{client_id}/diagnostic.md` with frontmatter `forge_skill_version`
- Tier 1 caches consumed (no re-read of disk)
- No Tier 3 reads

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Skip script ("client is clear") | C1 structural | Always run all 10 blocks |
| Defer outcome ambiguity to spec | C2 starts here | Force 3+3 examples; otherwise `proposed_outcome: insufficient` |
| Out-of-ICP "worth trying" | Burns pre-sales effort | Mark and propose renegotiate or refuse |
| Customize existing-sku for client | C8 violation | `variant` if needed; never custom-per-client code |
| Estimate baseline if no data | C1 + C3 | Schedule 2nd session with CFO |
| Read prior runs for reference | Tier 3 leakage | Tier 1 + Tier 2 same client only |
| Tolerance = 0 ("perfection") | Technically infeasible | Force explicit threshold > 0 |

---

## Usage

### Mode 1 — Interactive (90-min session)

```bash
deepagents -y
> Run diagnostic-runner for client=acme interlocutor=ceo \
  declared_problem="follow-up de propostas se perde"
```

### Mode 2 — Quick qualification (10-min)

```bash
deepagents -y
> Run diagnostic-runner for client=acme interlocutor=ceo \
  declared_problem="..." session_minutes=10
```

(All 10 blocks still execute — `session_minutes` parameterizes depth, not count.)

### Mode 3 — In CI as part of /acme:diagnose pipeline

```bash
deepagents -n -y "Run dna+icp+offerings loaders" > /dev/null
deepagents -n -y "Run diagnostic-runner with inputs in .deepagents/cache/diagnostic-session.json"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `helpers_not_loaded` | Tier 1 caches missing | Run loaders first |
| `interlocutor_disengaged` | ≥3 blocks no substantive answer | Reschedule with right person |
| `proposed_outcome: insufficient` | Missing examples | Re-ask block 5 explicitly |
| `out_of_icp_blocked` | Settings require ICP fit | Override only with stakeholder approval |

---

## Source

Original: `.claude/skills/L1/diagnostic-runner.md`. Generated; do not edit by hand (F18).
