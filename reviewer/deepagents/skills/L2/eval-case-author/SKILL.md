---
name: eval-case-author
description: "Generates eval cases for an artifact from real human/agent pairs (preferred) or declared synthetic cases (fallback). Persists in evals/{artifact_id}/cases/case-{n}.md. Tier 3 — implements C4 (≥30 cases per outcome_category before SHADOW), C2 (justified ground truth), C6 (traceability to source trace)."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L2/eval-case-author.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  forge-tier: 3
  forge-version: "0.1.0"
  linked-principles: [C2, C4, C6]
  helper-pattern: none
---

# Skill: eval-case-author — Tier 3 Operational (Forge)

> **applies_when**: `project.ai_enabled = true` — This skill generates LLM evaluation cases (classified outcomes, agreement rate). For platform modules (`ai_enabled=false`), C4 compliance uses E2E functional tests + `platform-acceptance-report.template.md` instead of LLM eval suites. Invoking this skill in a platform project will produce cases that cannot be measured against the correct promotion gates.

Generates **eval cases** (input + ground truth + justification) used as:

1. Promotion criterion (C4: ≥30 cases per `outcome_category` to pass SHADOW)
2. Few-shots consumed by `artifact-prompt-builder`
3. Regression detection when prompt changes (`prompt_hash` differs → rerun eval suite)
4. Drift detection ground truth in production

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read source runs (Tier 3), spec, process-map, eval index |
| `write_file` | Persist `evals/{artifact_id}/cases/case-{n}.md` and update index |
| `execute` | Validate PII sanitization, dedupe by input hash, enforce source_mode rules |
| `task` | Parallel generation across `outcome_category` |

---

## Execution Plan

- [ ] 1. Verify Tier 1 cache (offerings) and template (`templates/eval-case.template.md`)
- [ ] 2. Validate parameters (artifact_id, outcome_category, source_mode)
- [ ] 3. For source_mode=real: validate `source_run_id` belongs to same `client_id` as artifact
- [ ] 4. For each requested case:
      - Extract input + ground truth
      - Sanitize PII (regex)
      - Build justification of ground truth
      - Compute input hash; check duplicate against suite
      - Persist `evals/{artifact_id}/cases/case-{category}-{nnn}.md`
- [ ] 5. Update `evals/{artifact_id}/index.md`
- [ ] 6. Compute coverage_after by category; flag if `c4_threshold_met: true`
- [ ] 7. Return summary

---

## Prerequisites Check

```bash
test -f .deepagents/cache/offerings.yaml || { echo "ERROR: Run offerings-loader"; exit 1; }
test -f templates/eval-case.template.md || { echo "ERROR: Template missing"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Need python3"; exit 1; }
```

---

## Source modes

| Mode | Input source | Ground truth source | When |
|---|---|---|---|
| `real` | Real run (Tier 3) | Archived human output | Default — preferred |
| `synthetic` | Generated from `synthetic_seed` | Author-built with justification | When real is scarce |
| `edge` | Limit-built input | Expected guard behavior (refuse/escalate) | Edge coverage |
| `adversarial` | Designed-to-fail input | Protection behavior | C4 hardening |

> Cap default ≤ 40% synthetic; target ≥ 60% real after 90 days SHADOW.

---

## Step 4 — PII sanitization (via `execute`)

```bash
python3 - <<'PY'
import re, sys, json
case = json.loads(open('.deepagents/cache/case-draft.json').read())
text = case['input']
patterns = {
    'email': r'[\w\.-]+@[\w\.-]+\.\w+',
    'cpf': r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}',
    'cnpj': r'\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}',
    'phone_br': r'(\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}',
}
hits = []
for k, p in patterns.items():
    if re.search(p, text):
        text = re.sub(p, f'[REDACTED_{k.upper()}]', text)
        hits.append(k)
case['input'] = text
case['pii_sanitized'] = True
case['pii_redacted_classes'] = hits
open('.deepagents/cache/case-draft.json','w').write(json.dumps(case, indent=2))
print(f"OK redacted: {hits}")
PY
```

---

## Step 4b — Duplicate detection (via `execute`)

```bash
python3 - <<'PY'
import hashlib, json, sys, glob, re
case = json.loads(open('.deepagents/cache/case-draft.json').read())
h = hashlib.sha256(case['input'].encode()).hexdigest()[:16]
case['input_hash'] = h
# scan existing cases for same hash
for path in glob.glob(f"evals/{case['artifact_id']}/cases/*.md"):
    txt = open(path).read()
    m = re.search(r'input_hash:\s*([a-f0-9]+)', txt)
    if m and m.group(1) == h:
        print(f"FAIL duplicate_input_hash existing={path}")
        sys.exit(2)
open('.deepagents/cache/case-draft.json','w').write(json.dumps(case, indent=2))
print(f"OK hash={h}")
PY
```

---

## Step 4c — Tenant integrity (via `execute`)

```bash
python3 - <<'PY'
# Block cross-tenant data leakage (C8)
import json, sys
case = json.loads(open('.deepagents/cache/case-draft.json').read())
if case['source_mode'] == 'real':
    # source_run_id must belong to same client_id as artifact
    # (lookup logic; placeholder)
    if case.get('source_client_id') and case.get('artifact_client_id'):
        if case['source_client_id'] != case['artifact_client_id']:
            print("FAIL source_run_wrong_tenant"); sys.exit(8)
print("OK")
PY
```

---

## Canonical case file structure

```markdown
---
case_id: case-billing-031
artifact_id: <>
outcome_category: billing
source_mode: real
source_run_id: <UUID> | null
source_trace_id: <UUID> | null
authored_at: 2026-04-30
authored_by: eval-case-author@0.1.0 + <human reviewer or null>
pii_sanitized: true
pii_redacted_classes: [email, phone_br]
input_hash: <sha256:16>
synthetic_seed: null
linked_principles: [C2, C4, C6]
---

## Input
{sanitized input}

## Gabarito
{expected output per spec.output_schema}

## Justificativa do gabarito
Por que essa é a resposta correta? Qual o raciocínio humano por trás?
{non-empty justification — mandatory}

## Critério de PASS
- exact_match: <fields literal>
- semantic_match: <fields with threshold>
- llm_as_judge: <fields evaluated by judge model>

## Edge case characteristics (if source_mode=edge|adversarial)
- Por que é limítrofe: ...
- O que o agente pode errar: ...
- Recusa esperada: sim | não
```

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| 100% synthetic for speed | Fools eval | Cap default ≤ 40%; flag `eval_suite_synthetic_heavy` if >50% |
| Skip ground-truth justification | No drift detection possible | Block; mandatory non-empty |
| Same input, different ground truths | Suite contradiction | Hash dedupe before persist |
| PII later, generate first | LGPD/GDPR risk | Sanitize **before** persist; `pii_sanitized: true` mandatory |
| Edge cases later | C4 protection lost | After 30 cases per category, ≥10% must be edge+adversarial |
| Copy client A case to client B | Cross-tenant leak | Block; `source_run_wrong_tenant` |
| Real run had human error → discard | Real human errors are gold | Promote to `source_mode: edge` with note; ground truth = corrected behavior |
| Ignore C4 threshold (<30) | "Arbitrary" but hard gate | Block SHADOW promotion if `c4_threshold_met: false` |

---

## Verification gate

- `outcome_category` ∈ enum from `spec.outcome_categories`
- `source_mode` consistent with inputs (real ⇒ source_run_id|source_trace_id)
- Each case has: `case_id` (unique), `input` (non-empty), `gabarito` (non-empty), `justificativa` (non-empty), `pii_sanitized: true`
- `input_hash` unique within suite
- `source_run_id` belongs to same `client_id` as artifact (cross-tenant block)
- For `synthetic`: `synthetic_seed` declared
- For `edge|adversarial`: "Edge case characteristics" filled
- PII sanitization validated (0 matches after redaction)
- `evals/{artifact_id}/index.md` updated

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Author 10 eval cases for artifact triagem-tickets-tier1-v1, category billing, \
  source_mode=real, from runs in 2026-04
```

### Mode 2 — Batch via `task` for parallel categories

```bash
deepagents -y "Author 10 eval cases for each outcome_category in spec for \
  artifact triagem-tickets-tier1-v1, source_mode=real. Use parallel sub-agents."
```

### Mode 3 — In CI as Wave 3 of /acme:implement

```bash
deepagents -n -y "Run eval-case-author for each category in \
  .deepagents/cache/eval-config.json until c4_threshold_met=true for all"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `outcome_category_unknown` | Not in spec | Update spec or fix category |
| `source_run_not_found` | Bad run_id | Verify in trace provider |
| `source_run_wrong_tenant` | Cross-tenant | C8 block — never bypass |
| `pii_sanitization_failed` | Regex incomplete | Add domain-specific patterns |
| `duplicate_input_hash` | Same input twice | Vary or skip case |
| `c4_coverage_below_threshold` | Need more cases | Loop until ≥30 per category |

---

## Source

Original: `.claude/skills/L2/eval-case-author.md`. Generated; do not edit by hand (F18).
