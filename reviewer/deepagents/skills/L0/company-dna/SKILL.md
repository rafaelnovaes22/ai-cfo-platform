---
name: company-dna
description: "Loads and exposes the organization's DNA (purpose, mission, values, north-star) in compact YAML for Tier 1 strategic context. Caches under __forge_cache.dna for downstream skills."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L0/company-dna.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  forge-tier: 1
  forge-version: "0.1.0"
  linked-principles: [C5, C7]
  helper-pattern: bmad
---

# Skill: company-dna — Tier 1 Strategic (Forge)

Loads the organization's **DNA** in deterministic, cacheable form for downstream skills (Tier 2/3) and the `forge-auditor` reviewer.

> Tier 1 hard rule (C5): **does not** read Tier 2/3 paths. Output is YAML compact (≤ 600 tokens), not raw markdown.

---

## Execution Context

| Tool | Usage in this skill |
|------|---------------------|
| `glob` | Find conventional DNA paths (`docs/dna.md`, `examples/*/dna.md`, etc) |
| `read_file` | Read the resolved DNA file |
| `write_file` | Persist `__forge_cache.dna` to `.deepagents/cache/dna.yaml` |
| `execute` | Validate parsed YAML against required fields |

---

## Execution Plan (use with `write_todos`)

- [ ] 1. Verify prerequisites (yq or python yaml available)
- [ ] 2. Resolve DNA path via precedence list
- [ ] 3. Read DNA markdown
- [ ] 4. Parse into compact YAML structure (purpose, mission, north_star_metric, values)
- [ ] 5. Validate required fields present and `last_reviewed` ≤ 365 days
- [ ] 6. Write cache to `.deepagents/cache/dna.yaml`
- [ ] 7. Emit return value to caller

---

## Prerequisites Check

Validate environment via `execute`:

```bash
command -v yq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: Need yq or python3 to parse YAML"
  exit 1
}
test -d "$PWD/docs" || test -d "$PWD/examples" || {
  echo "ERROR: No docs/ or examples/ directory found in $PWD"
  exit 1
}
```

---

## Step 1 — Resolve DNA path

Precedence (first match wins):

1. `docs/dna.md`
2. `docs/strategy/dna.md`
3. `examples/*/dna.md` (multi-org repos)
4. `examples/*/portfolio.md` § `DNA` (Acme-style embedded)

Use `glob`:

```
glob: "docs/dna.md"
glob: "docs/strategy/dna.md"
glob: "examples/*/dna.md"
glob: "examples/*/portfolio.md"
```

If no match → return:

```yaml
dna_loaded: false
dna_missing: true
checked_paths: [...]
recommended_action: "Run /acme:diagnose or create docs/dna.md from templates/diagnostic-spec.template.md"
```

---

## Step 2 — Read DNA file

Use `read_file` against the resolved path:

```
read_file: <resolved_path>
```

---

## Step 3 — Parse into compact YAML

Extract fields:

- `organization`: name
- `purpose`: 1 sentence — why exists
- `mission`: 1 sentence — what it delivers
- `north_star_metric`: { name, target }
- `values`: array of strings
- `founding_principles`: optional array
- `last_reviewed`: YYYY-MM-DD

Output target (≤ 600 tokens):

```yaml
dna_loaded: true
source_path: <resolved>
organization: <name>
purpose: <sentence>
mission: <sentence>
north_star_metric:
  name: <metric>
  target: <target>
values: [v1, v2, v3]
founding_principles: [p1, p2]
last_reviewed: YYYY-MM-DD
```

---

## Step 4 — Validate required fields

Validation script via `execute`:

```bash
python3 - <<'PY'
import yaml, sys
from datetime import date, datetime
data = yaml.safe_load(open('.deepagents/cache/dna.yaml'))
required = ['organization','purpose','mission','north_star_metric','values','last_reviewed']
missing = [k for k in required if k not in data]
if missing:
    print(f"FAIL missing: {missing}"); sys.exit(2)
lr = data['last_reviewed']
if isinstance(lr, str):
    lr = datetime.strptime(lr, '%Y-%m-%d').date()
age = (date.today() - lr).days
if age > 365:
    print(f"FAIL dna_outdated last_reviewed={lr} age_days={age}"); sys.exit(3)
print("OK")
PY
```

Exit codes:
- `0` → ok
- `2` → `dna_malformed`
- `3` → `dna_outdated`

---

## Step 5 — Persist cache

Use `write_file` to write the parsed YAML to `.deepagents/cache/dna.yaml` so other skills can read via `read_file` without re-parsing.

---

## Anti-rationalization (Tier 1 hard rules)

| Temptation | Why wrong | Correct |
|---|---|---|
| Infer DNA from README | DNA must be declared and dated | Return `dna_missing: true` |
| Read ICP/portfolio together | Breaks C5 hierarchy | Each L0 loader is independent |
| Reuse cache across runs | Causes silent drift | Cache is `ephemeral-strong` (run-scoped) |
| Read Tier 2 (clients/, tenants/) | Hard violation of C5 | Block; `must_not_read: [2, 3]` |
| Return raw markdown | Defeats helper pattern | Always YAML compact |

---

## Verification gate

- `dna_loaded: true` returned in ≤ 600 tokens
- All required fields present
- `source_path` resolves to existing file
- No reads recorded in Tier 2/3 paths
- Cache written to `.deepagents/cache/dna.yaml`

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Run the company-dna skill against this repository
```

### Mode 2 — One-shot

```bash
deepagents -n -y "Run company-dna skill and print the YAML output"
```

### Mode 3 — As helper for downstream skills (CI/CD)

```bash
# In a wrapper script
deepagents -n -y "Run company-dna skill" > .deepagents/cache/dna.yaml
deepagents -n -y "Run forge-auditor skill for month 2026-04" \
  # forge-auditor reads .deepagents/cache/dna.yaml as Tier 1 context
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `dna_missing: true` | No `docs/dna.md` or equivalent | Run `/acme:diagnose` or create from template |
| `dna_outdated` | `last_reviewed` > 365 days | Trigger DNA review with stakeholders |
| `dna_malformed` | Required field absent | Compare against `templates/diagnostic-spec.template.md` |
| `multiple_dna_found` | Multiple paths match | Consolidate to one canonical location |
| YAML parse error | Markdown frontmatter broken | Check `---` delimiters and indentation |

---

## Source

Original: `.claude/skills/L0/company-dna.md` — see that file for the full anti-rationalization narrative and decision history. This Deep Agents version is **generated** (F18); do not edit by hand.
