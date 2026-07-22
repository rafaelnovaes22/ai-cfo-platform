---
name: foundry-auditor
description: "Orchestrates the monthly audit of a Foundry-consuming project against Constitution C1-C8 (+ declared extensions). Loads manifest, primes Tier 1 caches via L0 loaders, parallelizes per-principle checks via task sub-agents, consolidates findings in docs/foundry/audits/{YYYY-MM}.md compatible with reviewer/output-schema.json. Native Deep Agents skill (no Claude Code source)."
metadata:
  author: agent-governance-framework
  source: native-deepagents
  deep-agents-compat: ">=0.0.34"
  foundry-version: "0.1.0"
  linked-principles: [C1, C2, C3, C4, C5, C6, C7, C8]
  output-schema: reviewer/output-schema.json
  consumes-skills:
    - company-dna
    - icp-loader
    - offerings-loader
---

# Skill: foundry-auditor — Reviewer Orchestrator

Single skill that runs the **monthly audit** of a Foundry-consuming project. Validates each Constitution principle (C1-C8) in parallel using `task` sub-agents and produces an audit document conforming to `reviewer/output-schema.json`.

> Native Deep Agents skill — written directly in this format, not converted from Claude Code. Lives only here in `reviewer/deepagents/skills/reviewer/foundry-auditor/`.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read `docs/foundry/manifest.json`, Constitution, spec, runs, traces |
| `glob` | Discover artifacts (specs, prompts, evals, runs, baselines) |
| `execute` | Run lint regex (C7/C8), parse manifests, compute aggregates |
| `write_file` | Persist `docs/foundry/audits/{YYYY-MM}.md` and `findings.json` |
| `task` | Parallel per-principle audits (8 sub-agents) |

---

## Execution Plan

- [ ] 1. Verify environment (Python 3.11+, ripgrep available, working tree readable)
- [ ] 2. Load `docs/foundry/manifest.json` → identify Constitution version, principles, artifacts
- [ ] 3. Detect project name, scope, audit period (--month parameter or last closed month)
- [ ] 3.5. **Load `docs/foundry/project.json`** (if present) → extract `project.type`, `project.ai_enabled`, `modules[]`
       - If absent: default to `project_type=agentic_saas`, `ai_enabled=true` (backwards compat v0.7.0)
       - If `ai_enabled=false`: switch discovery (step 5) and principle rubrics (step 6) to platform mode
       - **CRITICAL: NEVER mark FAIL for absence of LLM/Langfuse/prompts when `ai_enabled=false`**
- [ ] 4. Prime Tier 1 caches via L0 loaders: `company-dna`, `icp-loader`, `offerings-loader`
- [ ] 5. **Discover audit scope** (branched by project_type):
       - `agentic_saas`: subscriptions in ASSISTED/AUTONOMOUS in `--month` (sample 5-10%)
       - `platform`: modules in PILOT/CANONICAL from `project.modules[]` (all, not sampled — usually ≤20)
       - `hybrid`: both, per module's own `ai_enabled`
- [ ] 6. Spawn 8 parallel `task` sub-agents — one per principle C1-C8
       - Each sub-agent receives `project_type` and `ai_enabled` and applies the matching rubric
       - Each sub-agent reports `{ id, name, status, evidence, metrics, findings, recommendations }`
- [ ] 7. Spawn 1 parallel `task` for structural audit (manifest sync, drift signals, project.json freshness)
- [ ] 8. Aggregate results; compute `overall_status` and `drift_detected`
- [ ] 9. Render markdown report from `templates/monthly-audit.template.md`
- [ ] 10. Write `docs/foundry/audits/{YYYY-MM}.md` + `docs/foundry/audits/{YYYY-MM}-findings.json`
- [ ] 11. Validate output against `reviewer/output-schema.json`
- [ ] 12. Return summary

---

## Prerequisites Check

```bash
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 required"; exit 1; }
command -v rg >/dev/null 2>&1 || command -v grep >/dev/null 2>&1 || {
  echo "ERROR: ripgrep or grep required"; exit 1
}
test -f docs/foundry/manifest.json || { echo "ERROR: not a Foundry project"; exit 1; }
test -f reviewer/output-schema.json || { echo "ERROR: output schema missing"; exit 1; }
test -f .deepagents/cache/dna.yaml -o -d examples || {
  echo "WARN: Tier 1 caches not primed; will run loaders first"
}
```

---

## Inputs

```yaml
month: 2026-04           # required; YYYY-MM, must be CLOSED month
sample_pct: 7            # default 7%; range 5-10
subscription_filter: "*" # default all
auto_rollback: false     # default; if true, calls /novais-digital:promote --to_mode=rollback on severe SLA breach
```

---

## Step 4 — Prime Tier 1 caches (sequential)

```bash
# If caches missing, run L0 loaders. Each loader writes .deepagents/cache/{name}.yaml
for skill in company-dna icp-loader offerings-loader; do
  test -f .deepagents/cache/${skill//-/_}.yaml || {
    echo "Priming $skill..."
    deepagents -n -y "Run $skill skill"
  }
done
```

---

## Step 6 — Parallel per-principle audit (8 sub-agents)

Each sub-agent receives:
- `principle_id` (C1, C2, ..., C8)
- `principle_definition` (extracted from `.claude/CONSTITUTION.md`)
- `validation_rules` (subset from `reviewer/validation-rules.json`)
- `project_artifacts` (paths discovered via `glob`)
- `tier1_caches` (`.deepagents/cache/*.yaml`)

```
task: audit-c1-diagnose-before-design
task: audit-c2-outcome-first
task: audit-c3-cost-25
task: audit-c4-shadow-before-billing
task: audit-c5-three-tier
task: audit-c6-telemetry
task: audit-c7-portability
task: audit-c8-anti-customization
task: audit-structural-drift   # 9th — manifest sync + prompt_hash drift
```

Each `task` returns:

```json
{
  "id": "C3",
  "name": "Cost ≤ 25% of price",
  "status": "PASS|WARN|FAIL",
  "evidence": "specific paths, queries, numbers",
  "metrics": { "subscriptions_viable": 10, "subscriptions_tight": 2, ... },
  "findings": [
    {
      "severity": "critical|warning|info",
      "subscription_id": "...",
      "evidence_path": "...",
      "description": "..."
    }
  ],
  "recommendations": ["..."]
}
```

---

## Per-principle check rubric (high-level)

> Each rubric has two branches — apply based on `ai_enabled` loaded in step 3.5.

### C1 — Diagnose-before-build
- **agentic**: For each subscription in production: `docs/clients/{client_id}/diagnostic.md` exists? FAIL if ratio < 100%.
- **platform**: For each module in project.modules[]: `diagnostic-{module_id}.md` or `docs/clients/{client_id}/diagnostic-{module_id}.md` exists? FAIL if ratio < 100%.

### C2 — Outcome-first
- **agentic**: For each spec: `outcome_clause_hash` declared? Match against `prompts/{artifact_id}/v*/system.md` Section 3 hash. FAIL on hash divergence.
- **platform**: For each module spec: `outcome_clause` present with `outcome_kind: operational_action_with_observable_evidence`? `audited_actions[]` declared? FAIL if missing.

### C3 — Cost ≤ 25%
- **agentic**: For each subscription: `baseline-cost-*.md` → `c3_check.status`. FAIL if `unviable` OR `recalc_unit_economics_required: true` for >7 days.
- **platform**: For each module with `delivery-economics-{id}.md`: `platform_margin ≤ 0.25`? FAIL if `unviable`. WARN if file missing (not yet measured).

### C4 — Gradual promotion gate
- **agentic**: For each promotion in `subscriptions/{id}/promotions.md`: 5 gates passed? `min_window_days >= 14` enforced?
- **platform**: For each module in PILOT/CANONICAL: `pilot-state.md` present? State transitions documented with dates? Minimum window respected (critical: 14d, standard: 7d, simple: 3d)? CANONICAL modules: `acceptance-report.md` signed?
- **agentic only**: `delivered: false` in all SHADOW traces? FAIL on gate-pass without evidence.
- **platform only**: pilot-state.md transition log shows evidence (spec link, acceptance reference)?

### C5 — Three-tier context
- All skills L0 declare `helper_pattern: bmad`?
- All skills L1/L2 declare `helper_pattern: none`?
- Cross-tier reads detected? (lint regex)
- FAIL on hierarchy break.

### C6 — Telemetry-by-default
- **agentic**: `% runs with trace` in audit period (target: 100%; alert if <99%). All `prompts/.../system.md` have Section 8 (instrumentation)? FAIL if absent.
- **platform**: `audit_log_provider` declared in `project.json`? `auditLog.write()` calls present in module service files? `structured_logging_provider` configured? WARN if audit log coverage < 100% of declared `audited_actions[]`.
- **NEVER FAIL for absence of Langfuse/llm_trace_provider when `ai_enabled=false`.**

### C7 — Portability
- **agentic**: `grep -r "import .* from '@anthropic-ai/sdk\|openai\|@google-ai" src/ | grep -v 'src/llm/adapters/'`. 0 matches → PASS; ≥1 → FAIL.
- **platform**: Check that `src/infra/`, `src/integrations/`, `src/payments/` abstraction layers exist and 3rd-party SDK imports are isolated to those directories. 0 leaks → PASS; ≥1 → FAIL.

### C8 — Anti-customização heroica
- `grep -rE "if\s*\(\s*tenantId\s*===\s*'.*?'" src/skus/ src/products/ src/services/ src/modules/`
- `grep -rE "switch\s*\(\s*tenantName" ...`
- 0 matches → PASS; ≥1 → FAIL with paths/lines.

### Structural drift
- For each artifact in `manifest.json`: file exists? sha256 matches (when populated)?
- **agentic**: For each `prompts/{id}/v*/system.md`: `prompt_hash` matches latest eval run? WARN on drift; FAIL if drift > 7 days.
- **platform**: `project.json` updated within 90 days? `delivery-economics-{module}.md` updated within 90 days? WARN if stale.

---

## Step 8 — Aggregate `overall_status`

Logic:

```python
counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
for check in checks:
    counts[check.status] += 1
if counts["FAIL"] >= 1:
    overall = "FAIL"
elif counts["WARN"] >= 3:
    overall = "WARN_SEVERE"
elif counts["WARN"] >= 1:
    overall = "WARN"
else:
    overall = "PASS"
```

---

## Step 10 — Output structure (matches `reviewer/output-schema.json`)

```json
{
  "audit_date": "2026-05-01",
  "audit_period": "2026-04",
  "reviewer": "deepagent-foundry-auditor@0.1.0",
  "constitution_version": "0.2.0",
  "manifest_version": "0.2.0",
  "project": "novais-digital-governanca-ia",
  "scope": {
    "artifacts_audited": 12,
    "skus_in_production": 12,
    "outcomes_period_days": 30
  },
  "checks": [
    {
      "id": "C1",
      "name": "Diagnose-before-design",
      "status": "PASS",
      "evidence": "12/12 production artifacts have linked diagnostic.md",
      "metrics": { "ratio_with_diagnostic": 1.0 },
      "findings": [],
      "recommendations": []
    },
    ...
  ],
  "drift_detected": [...],
  "outcomes_sampled": 1290,
  "issues_opened": [...],
  "overall_status": "WARN",
  "audit_metadata": { ... }
}
```

---

## Step 11 — Schema validation

```bash
python3 - <<'PY'
import json, jsonschema, sys
schema = json.load(open('reviewer/output-schema.json'))
report = json.load(open(f"docs/foundry/audits/{MONTH}-findings.json"))
try:
    jsonschema.validate(report, schema)
    print("OK schema valid")
except jsonschema.ValidationError as e:
    print(f"FAIL schema invalid: {e.message}")
    sys.exit(2)
PY
```

---

## Anti-rationalization (orchestrator-level)

| Temptation | Why wrong | Correct |
|---|---|---|
| Sample <5% to go faster | Coverage too low; reviewer rejects | Floor 5%; cap 10% |
| Audit current (open) month | Numbers shift after report; not reproducible | Block if `month >= current_month` |
| Skip C8 audit "to save time" | Drift is silent; misses regression | C8 lint is fast (regex); always run |
| Auto-rollback default true | Without human notice = commercial incident | Default false; `--auto_rollback` only with explicit approval |
| Top-10 disagreements only inline | Reviewer loses signal | Top-10 inline + rest in `disagreements.md` |
| 99% trace OK | The 1% concentrates in subs with bug | Investigate clusters; flag if >X runs in same sub |
| Prompt_hash drift = warning | No eval against current prompt = quality unvalidated | Drift > 7 days without eval = **critical** |
| Free format, agent adapts | Schema strict | Mandatory `reviewer/output-schema.json` validation |

---

## Verification gate

- `month` is YYYY-MM and CLOSED
- All 9 sub-agents (8 principles + structural) returned a result
- `sample_pct ∈ [5, 10]`
- Output validates against `reviewer/output-schema.json`
- Disagreements > 50 → moved to separate file `disagreements.md`
- Auto-rollbacks (if executed) referenced in dedicated section
- Tier 1 caches consumed (no manual re-read of dna/icp/offerings)
- File persisted at `docs/foundry/audits/{YYYY-MM}.md`
- Exit 0 if `overall_status: PASS|WARN`; exit 1 if `FAIL`

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Run foundry-auditor for month 2026-04 against this project
```

### Mode 2 — One-shot for CI

```bash
deepagents -n -y "Run foundry-auditor for month 2026-04 with sample_pct=7"
```

### Mode 3 — Cron (1st of month)

```cron
0 8 1 * * cd /path/to/project && deepagents -n -y "Run foundry-auditor for previous closed month"
```

### Mode 4 — Pre-release gate

```bash
# Before tagging vX.Y.Z
deepagents -n -y "Run foundry-auditor for last closed month with subscription_filter='production'"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `month_not_closed` | Tried current month | Wait or pass previous |
| `tier1_cache_missing` | Loaders not run | Skill primes them automatically; if still failing, check `examples/*/dna.md` |
| `manifest_parse_failed` | JSON invalid | `python -c "import json; json.load(open('docs/foundry/manifest.json'))"` |
| `schema_validation_failed` | Output structure broken | Check sub-agent returns; ensure all required fields |
| `audit_dir_unwritable` | Permissions | Ensure `docs/foundry/audits/` writable |
| `tracing_provider_unreachable` | Langfuse/etc down | Mark `outcomes_sampled: 0` with `tracing_unavailable: true`; partial audit |

---

## Notes for Foundry maintainers

- This skill is the **single entry point** for the monthly audit. Do not invent parallel audit scripts.
- When a new principle is added to Constitution (Cn), add a new `task: audit-c{n}` sub-agent here AND update `reviewer/validation-rules.json`.
- When extensions exist (ex: `examples/novais-digital/constitution-extension.md` with C9-C11), spawn additional sub-agents conditionally on `principle_extensions_path` from `manifest.json`.
- Output format is versioned via `reviewer/output-schema.json $id`. Bump that schema when output structure changes.

---

## Origin

Native Deep Agents skill (not converted). Decision F17/F18 (`docs/foundry/decisions.md`).
