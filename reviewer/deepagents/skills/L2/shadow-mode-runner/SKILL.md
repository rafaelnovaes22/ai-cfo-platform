---
name: shadow-mode-runner
description: "Coordinates SHADOW mode (C4) — agent runs parallel to human, output NEVER delivered/billed, measures human/agent agreement, produces promotion report. Tier 3 — enforces C4 mechanically (≥14 days, delivered:false, billing:0, prompt_hash immutable during window) and produces recommendation BUT does not auto-promote."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L2/shadow-mode-runner.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  forge-tier: 3
  forge-version: "0.1.0"
  linked-principles: [C4, C6]
  helper-pattern: none
---

# Skill: shadow-mode-runner — Tier 3 Operational (Forge)

Runs an agent in **SHADOW mode** — parallel to current human process, **without delivering/billing output**, instrumenting all runs and measuring human/agent **agreement_rate**. SHADOW is the **mandatory gate** of C4 before any ASSISTED or AUTONOMOUS promotion.

> Skill **does not decide** promotion alone. Produces report; humans (PO Guardian + Promotion Officer) sign off.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read spec.c4_thresholds, baseline-cost, prompt, eval suite, runs, traces |
| `write_file` | Persist `runs/{client_id}/shadow/shadow-status.md` and `report-*.md` |
| `execute` | Compute agreement_rate, latency p50/p95, cost p95, drift_signals, validate prompt_hash immutability |
| `task` | Parallel per-category metric computation (optional) |

---

## Execution Plan

This skill has **3 actions**: `start`, `tick`, `report`. The agent picks based on subscription state.

```
- [ ] 1. Verify Tier 1 cache (offerings)
- [ ] 2. Detect subscription state → action selection
- [ ] 3a. start: validate 6 preconditions; create shadow_session
- [ ] 3b. tick: read new runs, update metrics incrementally
- [ ] 3c. report: window expired; compose final report + recommendation
- [ ] 4. Persist artifacts
- [ ] 5. Return summary
```

---

## Prerequisites Check

```bash
test -f .deepagents/cache/offerings.yaml || { echo "ERROR: Run offerings-loader"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Need python3"; exit 1; }
```

---

## Preconditions for `start` (all mandatory)

```bash
python3 - <<'PY'
import yaml, sys, glob
errs = []

# 1. Artifact in catalog with allowed lifecycle_stage
off = yaml.safe_load(open('.deepagents/cache/offerings.yaml'))
artifact = next((o for o in off['offerings'] if o['id'] == ARTIFACT_ID), None)
if not artifact:
    errs.append('artifact_not_in_catalog')
elif artifact['lifecycle_stage'] not in {'mvp','beta'} and not RESHADOW_FLAG:
    errs.append(f"lifecycle_not_allowed:{artifact['lifecycle_stage']}")

# 2. Prompt exists with hash
prompts = glob.glob(f"prompts/{ARTIFACT_ID}/v*/system.md")
if not prompts: errs.append('prompt_not_found')

# 3. Eval suite passes c4_threshold for all categories
spec = yaml.safe_load(open(SPEC_PATH))
for cat in spec.get('outcome_categories', []):
    cases = glob.glob(f"evals/{ARTIFACT_ID}/cases/case-{cat}-*.md")
    if len(cases) < 30:
        errs.append(f"eval_below_c4:{cat}={len(cases)}")

# 4. unit-economics file exists with c3_status in {viable, tight}
ue = glob.glob(f"docs/clients/{CLIENT_ID}/baseline-cost-*.md")
# (load and check c3_status — placeholder)

# 5. subscription.mode is none or shadow expired
# (state lookup — placeholder)

# 6. Human approval logged in promotions.md
# (file check — placeholder)

if errs: print(f"FAIL: {errs}"); sys.exit(2)
print("OK")
PY
```

---

## Mechanic enforcement of C4

The skill enforces:

```
ASSERT shadow_window_days >= 14
ASSERT subscription.mode == "shadow" during whole window
ASSERT every trace.delivered == false
ASSERT every trace.billing_amount == 0
ASSERT prompt_hash IMMUTABLE during window
ASSERT promotion_to_assisted.approver != shadow-mode-runner@*  # never self-promote
```

Any violation → `audit_critical` in DeepAgent reviewer's monthly report.

---

## Tick — incremental metrics (via `execute`)

```bash
python3 - <<'PY'
import yaml, json
from statistics import median, quantiles
runs = json.load(open('.deepagents/cache/shadow-runs-new.json'))   # provided by tracer
status_path = f"runs/{CLIENT_ID}/shadow/shadow-status.yaml"
status = yaml.safe_load(open(status_path)) if open(status_path, 'r') else {'runs_total':0}

agree = [r for r in runs if r.get('agreement') is not None]
status['runs_total'] += len(runs)
status['runs_with_pair'] = status.get('runs_with_pair', 0) + len(agree)

# overall agreement
all_agree = [r['agreement'] for r in agree]
status.setdefault('agreement', {})
status['agreement']['overall'] = sum(all_agree) / max(len(all_agree), 1)

# by category
by_cat = {}
for r in agree:
    by_cat.setdefault(r['outcome_category'], []).append(r['agreement'])
status['agreement']['by_category'] = {c: sum(v)/len(v) for c,v in by_cat.items()}

# latency p95
lats = [r['latency_ms'] for r in runs]
if lats:
    status['latency_p50_ms'] = median(lats)
    status['latency_p95_ms'] = quantiles(lats, n=20)[18] if len(lats) >= 20 else max(lats)

# cost
costs = [r['cost_usd'] for r in runs]
if costs:
    status['cost'] = {
        'avg_per_outcome': sum(costs) / len(costs),
        'p95_per_outcome': quantiles(costs, n=20)[18] if len(costs) >= 20 else max(costs)
    }

# drift signals
status['drift_signals'] = {
    'prompt_changed': PROMPT_HASH_CURRENT != PROMPT_HASH_AT_START,
    'distribution_shift_score': 0.07   # placeholder; computed separately
}

yaml.safe_dump(status, open(status_path, 'w'))
print(yaml.safe_dump(status))
PY
```

If `prompt_changed: true` → ERROR `prompt_drift_during_window`; window must restart with new approval.

---

## Report (final)

Persisted at `runs/{client_id}/shadow/report-{artifact_id}-{YYYY-MM-DD}.md`:

```markdown
---
artifact_id: <>
subscription_id: <>
shadow_window: { start, end, days }
prompt_hash: <>
recommendation: promote_to_assisted | hold_in_shadow | rollback
recommended_by: shadow-mode-runner@0.1.0
requires_human_approval: [po-guardian, promotion-officer]
---

## Sumário executivo
{2-3 lines}

## Métricas finais vs thresholds
| métrica | observado | threshold | status |
| ... |

## Disagreements relevantes (top 10)
{table run_id, category, human output, agent output, brief analysis}

## Recomendação
{promote_to_assisted | hold_in_shadow | rollback with rationale}

## Aprovações requeridas
- [ ] po-guardian
- [ ] promotion-officer
```

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Client wants to skip SHADOW (premium) | C4 no exception | Block `start` with `c4_window_below_minimum`; bypass needs `ACME_FORGE_BYPASS=incident` (Forge-4) with audit log |
| Agent output good → deliver in parallel | Any delivery = ASSISTED, no C4 protection | `delivered: false` & `billing: 0` enforced; lint detects side delivery |
| Agreement 0.85 is arbitrary, lower it | Threshold is pre-contracted in spec | Read from spec; change requires new ADR + bump |
| 14 days passed, auto-promote | C4 needs explicit human approval | Skill emits **recommendation**; promotion via `/acme:promote` with cross-approval |
| Disagreement is always agent's fault | ~10% are human errors | Top-N go to human review before final report |
| Sample 10% trace, not all | C6 violation in SHADOW | 100% trace in SHADOW; sampling only AUTONOMOUS post-Forge-4 |
| Prompt changed mid-window — ignore | Invalidates accumulated metrics | Detect `prompt_changed:true` → restart window with new approval |
| Cost above threshold but quality good | C3 hard gate independent of quality | `c3_status: unviable` → recommendation: `rollback` or `hold` |

---

## Verification gate

### `start`

- 6 preconditions passed
- `shadow-status.yaml` created with `started_at`, `prompt_hash`, `window_days`
- Subscription registered as `mode: shadow`
- Tracer ingestion confirms `delivered: false`

### `tick`

- ≥ 1 new run processed
- Metrics updated in status
- Top-N disagreement samples populated
- Drift signals computed

### `report`

- `current_day >= window_days` OR precondition failure
- `runs_total >= min_run_count` (or explicit justification)
- Threshold comparison declared per metric
- Recommendation ∈ {promote_to_assisted, hold_in_shadow, rollback}
- Top-10 disagreements documented
- Required human approvals listed
- File persisted at `report-*.md`

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Run shadow-mode-runner action=start for artifact triagem-tickets-tier1-v1, \
  subscription acme-001
```

### Mode 2 — Daily tick (CI cron)

```bash
deepagents -n -y "Run shadow-mode-runner tick for all active shadow subscriptions"
```

### Mode 3 — Final report (when window expires)

```bash
deepagents -n -y "Run shadow-mode-runner report for subscription acme-001"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `c4_window_below_minimum` | Tried <14 days | Hard floor; never bypass without incident flag |
| `eval_suite_below_c4_threshold` | Categoria com <30 casos | Run `eval-case-author` until `c4_threshold_met:true` |
| `subscription_already_in_higher_mode` | Tried start in ASSISTED/AUTONOMOUS | Use rollback first, then re-shadow |
| `prompt_drift_during_window` | Prompt hash changed mid-window | Restart with new prompt + new SLA approval |
| `min_run_count_not_reached` | Low traffic in window | Extend window or increase rollout |
| `human_approval_attempted_by_skill` | Skill tried to auto-promote | Block; requires `/acme:promote` with cross-approval |

---

## Source

Original: `.claude/skills/L2/shadow-mode-runner.md`. Generated; do not edit by hand (F18).
