---
name: icp-loader
description: "Loads and exposes the organization's Ideal Customer Profile (segments, qualification signals, anti-ICP) in compact YAML for Tier 1 strategic context."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L0/icp-loader.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  foundry-tier: 1
  foundry-version: "0.1.0"
  linked-principles: [C5, C7]
  helper-pattern: bmad
---

# Skill: icp-loader — Tier 1 Strategic (Foundry)

Loads the **Ideal Customer Profile** — segments served, qualification signals, **anti-ICP** (mandatory) — for downstream skills and the `foundry-auditor`.

> Tier 1 hard rule (C5): does not read Tier 2/3. Output ≤ 600 tokens YAML compact.

---

## Execution Context

| Tool | Usage |
|------|-------|
| `glob` | Find conventional ICP paths |
| `read_file` | Read resolved ICP file |
| `write_file` | Persist `.deepagents/cache/icp.yaml` |
| `execute` | Validate against required fields (qualification ≥ 3, anti-ICP ≥ 3) |

---

## Execution Plan

- [ ] 1. Verify yq/python3 available
- [ ] 2. Resolve ICP path via precedence
- [ ] 3. Read file
- [ ] 4. Parse into structured segments + qualification + disqualification arrays
- [ ] 5. Validate: ≥1 segment, ≥3 qualification_signals, ≥3 disqualification_signals, last_reviewed ≤ 365 days
- [ ] 6. Persist `.deepagents/cache/icp.yaml`
- [ ] 7. Return YAML to caller

---

## Prerequisites Check

```bash
command -v yq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: Need yq or python3"; exit 1
}
```

---

## Step 1 — Resolve path

Precedence:

1. `docs/icp.md`
2. `docs/strategy/icp.md`
3. `examples/*/icp.md`
4. `examples/*/portfolio.md` § `ICP`

Use `glob` for each. First match wins.

If none → return `icp_missing: true`.

---

## Step 2 — Read

```
read_file: <resolved_path>
```

---

## Step 3 — Parse into compact YAML

Output target:

```yaml
icp_loaded: true
source_path: <resolved>
segments:
  - name: <ex: PMEs B2B SaaS>
    size_band: <faixa receita ou headcount>
    pain: <dor central, 1 frase>
qualification_signals:    # 3-7 items
  - <signal>
disqualification_signals: # 3-7 items (anti-ICP, mandatory)
  - <signal>
typical_ticket_band:
  monthly: <range>
  annual: <range>
sales_cycle_days: <range>
last_reviewed: YYYY-MM-DD
```

---

## Step 4 — Validate

Via `execute`:

```bash
python3 - <<'PY'
import yaml, sys
from datetime import date, datetime
d = yaml.safe_load(open('.deepagents/cache/icp.yaml'))
errs = []
if not d.get('segments') or len(d['segments']) < 1:
    errs.append('segments<1')
if len(d.get('qualification_signals',[])) < 3:
    errs.append('qualification<3')
if len(d.get('disqualification_signals',[])) < 3:
    errs.append('anti_icp<3')   # MANDATORY
lr = d.get('last_reviewed')
if isinstance(lr, str):
    lr = datetime.strptime(lr, '%Y-%m-%d').date()
if lr is None or (date.today() - lr).days > 365:
    errs.append('icp_outdated')
if errs:
    print(f"FAIL: {errs}"); sys.exit(2)
print("OK")
PY
```

Exit codes:
- `0` → ok
- `2` → one or more validations failed (`icp_no_anti_icp`, `icp_outdated`, etc)

---

## Step 5 — Persist cache

`write_file: .deepagents/cache/icp.yaml`

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Infer ICP from current clients | Tier 1 vs Tier 2 confusion | Return `icp_missing` if not declared |
| Skip anti-ICP if not in source | Anti-ICP is mandatory (defines where NOT to hunt) | Fail validation; force ≥3 |
| Use a client's ICP | Tier 2 leakage | Use `tenant-context-loader` for concrete client |
| Mix segments for "more options" | Ambiguous ICP destroys qualification | One declared segment per entry |
| Reuse ICP > 365 days old | Market moves | Mark `icp_outdated` |

---

## Verification gate

- `icp_loaded: true` in ≤ 600 tokens
- ≥ 1 `segment` with `name`, `size_band`, `pain`
- `qualification_signals ≥ 3`
- `disqualification_signals ≥ 3` (anti-ICP mandatory)
- `last_reviewed` present and ≤ 365 days
- No reads in Tier 2/3 paths
- Cache persisted

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Run the icp-loader skill against this repository
```

### Mode 2 — One-shot

```bash
deepagents -n -y "Run icp-loader skill"
```

### Mode 3 — In CI as Tier 1 prep for foundry-auditor

```bash
deepagents -n -y "Run icp-loader skill" > /dev/null   # populates cache
deepagents -n -y "Run foundry-auditor for month 2026-04"
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `icp_missing` | No ICP file declared | Run Phase 0 diagnose; create `docs/icp.md` |
| `icp_no_anti_icp` | Anti-ICP signals < 3 | Add explicit "not our customer" criteria — most important field |
| `icp_outdated` | last_reviewed > 365 days | Stakeholder review session |
| `icp_malformed` | YAML structure broken | Compare to `examples/*/portfolio.md` ICP section |

---

## Source

Original: `.claude/skills/L0/icp-loader.md`. Generated; do not edit by hand (F18).
