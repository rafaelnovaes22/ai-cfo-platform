---
name: process-mapper
description: "Maps a client process as-is in agent-ready format — trigger, numbered steps with actor/input/output, decision points with criteria, baseline metrics, and automatable_hypotheses + agent_readiness_score. Persists docs/clients/{client_id}/process-{name}.md."
metadata:
  converted-from: claude-code
  source-path: .claude/skills/L1/process-mapper.md
  converter-version: "2.1"
  deep-agents-compat: ">=0.0.34"
  forge-tier: 2
  forge-version: "0.1.0"
  linked-principles: [C1, C5, C7]
  helper-pattern: none
---

# Skill: process-mapper — Tier 2 Tactical (Forge)

Transforms a process description into **agent-ready structured form**: trigger, numbered steps with actor/input/output, decision points with explicit criteria, baseline metrics, and automatable hypotheses. Output is canonical input of `artifact-prompt-builder` (L2) and `eval-case-author` (L2).

---

## Execution Context

| Tool | Usage |
|------|-------|
| `read_file` | Read `__forge_cache.offerings`, diagnostic |
| `write_file` | Persist `docs/clients/{client_id}/process-{process_id}.md` |
| `execute` | Validate steps numbering, decision-point criteria, compute `agent_readiness_score` |

---

## Execution Plan

- [ ] 1. Verify Tier 1 cache (offerings)
- [ ] 2. Validate parameters (client_id, process_id, process_name)
- [ ] 3. Receive process description (interview or document)
- [ ] 4. Extract trigger + actors + steps + decision points
- [ ] 5. Validate every decision point has explicit criterion + branches
- [ ] 6. Validate metrics_baseline has avg_handle_time, throughput_daily, human_error_rate (null + low confidence ok)
- [ ] 7. Generate ≥1 automatable_hypothesis with confidence + rationale
- [ ] 8. Compute `agent_readiness_score` (heuristic below)
- [ ] 9. Render markdown + write file
- [ ] 10. Return summary

---

## Prerequisites Check

```bash
test -f .deepagents/cache/offerings.yaml || {
  echo "ERROR: Run offerings-loader first"; exit 1
}
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Need python3"; exit 1; }
```

---

## Canonical output structure

```markdown
---
client_id: <>
process_id: <>
process_name: <>
mapped_at: YYYY-MM-DD
mapped_by: <skill or human>
forge_skill_version: process-mapper@0.1.0
linked_principles: [C1, C5, C7]
---

## Trigger
- evento: <ex: novo_ticket_recebido>
- canal: email | webhook | manual
- volume_diario_baseline: <N>
- sazonalidade: <descrição>

## Atores
| role | tipo | responsabilidade |
|---|---|---|
| analista-n1 | humano | classificar e responder |
| sistema-crm | sistema | persistir ticket |

## Steps
| # | ator | ação | input | output | t_médio | erro típico |
|---|---|---|---|---|---|---|
| 1 | sistema-crm | recebe ticket | email | ticket_id | <1s | — |
| 2 | analista-n1 | classifica categoria | corpo | category | 2 min | classificação errada (8%) |

## Decision Points
| # | step | critério | branches | dado disponível |
|---|---|---|---|---|
| D1 | 3 | category == "billing"? | sim → step 5 / não → step 4 | sim |

## Métricas baseline
- avg_handle_time: <N min>
- throughput_daily: <N>
- human_error_rate: <0–1>

## Automatable hypotheses
1. **Step 2 (classificar)** — confidence: high — rationale
2. **D1** — confidence: high — rationale
```

---

## `agent_readiness_score` heuristic (via `execute`)

```bash
python3 - <<'PY'
import json, yaml, sys
m = yaml.safe_load(open('.deepagents/cache/process-map-draft.yaml'))
dp = m.get('decision_points', [])
clear = sum(1 for d in dp if d.get('criterion') and d.get('branches'))
steps = m.get('steps', [])
sio = sum(1 for s in steps if s.get('input') and s.get('output'))
mb = m.get('metrics_baseline', {})
mb_done = sum(1 for k in ['avg_handle_time','throughput_daily','human_error_rate'] if mb.get(k) is not None)
ah = m.get('automatable_hypotheses', [])
ah_high = sum(1 for h in ah if h.get('confidence') == 'high')
score = (
    0.4 * (clear / max(len(dp),1)) +
    0.3 * (sio / max(len(steps),1)) +
    0.2 * (mb_done / 3) +
    0.1 * (ah_high / max(len(ah),1))
)
print(f"agent_readiness_score: {score:.2f}")
PY
```

Score < 0.5 → process **not ready** for SKU; needs revisit.
Score ≥ 0.7 → ready.

---

## Validation rules (via `execute`)

```bash
python3 - <<'PY'
import yaml, sys
m = yaml.safe_load(open('.deepagents/cache/process-map-draft.yaml'))
errs = []
if len(m.get('steps', [])) < 2: errs.append('insufficient_steps')
for d in m.get('decision_points', []):
    if not d.get('criterion'): errs.append(f"decision_no_criterion:{d.get('id')}")
mb = m.get('metrics_baseline', {})
if all(mb.get(k) is None for k in ['avg_handle_time','throughput_daily','human_error_rate']):
    errs.append('metrics_completely_empty')
if len(m.get('automatable_hypotheses', [])) < 1:
    errs.append('no_hypotheses')
if errs: print(f"FAIL: {errs}"); sys.exit(2)
print("OK")
PY
```

---

## Anti-rationalization

| Temptation | Why wrong | Correct |
|---|---|---|
| Describe in prose | Not agent-ready | Force tabular format even if source was text |
| Combine multi-actor steps | Loses traceability | Split into separate rows or `2a, 2b` |
| Skip metrics if unknown | Mandatory field | Mark `null` + `data_confidence: low` |
| Decision point "obvious" no criterion | Tacit becomes ambiguous in prompt | Every branch has explicit criterion + data availability |
| Read runs for time average | Tier 3 leakage | Ask client; mark `data_confidence: low` |
| Defer hypotheses to spec | Wastes downstream | `automatable_hypotheses ≥ 1` mandatory |
| Use Mermaid only | Agent doesn't consume diagrams | Tables first; Mermaid optional appendix |

---

## Verification gate

- `trigger` declared with type + channel + `volume_diario_baseline`
- `atores ≥ 1` with role/type/responsibility
- `steps ≥ 2` with full canonical fields
- Every `decision_point` has criterion + branches + data availability
- `metrics_baseline` keys present (null + low confidence ok)
- `automatable_hypotheses ≥ 1` with confidence + rationale
- `agent_readiness_score` computed
- File `docs/clients/{client_id}/process-{process_id}.md` persisted
- No Tier 3 reads

---

## Usage

### Mode 1 — Interactive

```bash
deepagents -y
> Map process triagem-tickets-tier1 for client=acme based on this description:
> [paste description]
```

### Mode 2 — One-shot from JSON

```bash
deepagents -n -y "Run process-mapper using inputs in .deepagents/cache/process-input.json"
```

### Mode 3 — As handoff from diagnostic-runner

```bash
deepagents -n -y "Run diagnostic-runner ..." \
  && deepagents -n -y "Run process-mapper for the process declared in the diagnostic"
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `insufficient_steps` (<2) | Description too high-level | Re-interview with focus on operational steps |
| `decision_no_criterion` | Tacit decision logic | Force explicit `if / else` criteria |
| `agent_readiness_below_threshold` | Score < 0.5 | Don't proceed to spec; add data confidence + criteria |
| `metrics_completely_empty` | No baseline data | Schedule session with operations team |

---

## Source

Original: `.claude/skills/L1/process-mapper.md`. Generated; do not edit by hand (F18).
