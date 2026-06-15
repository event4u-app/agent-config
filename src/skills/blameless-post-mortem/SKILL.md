---
model_tier: high
name: blameless-post-mortem
description: "Use after an incident or outage is resolved — blame-free facilitation, root cause, corrective actions, memory write-back — even for a near-miss. Consumes the incident-commander skeleton."
source: package
domain: quality
personas:
  - senior-engineer
  - critical-challenger
workspaces:
  - engineering
packs:
  - analysis-workbench
lifecycle: active
trust:
  level: professional
  confidence: medium
  human_review_required: false
install:
  default: false
  removable: true
requires_skills:
  - root-cause-frameworks
---

# blameless-post-mortem

> Facilitate a blame-free post-mortem after an incident or near-miss.
> Consumes the `incident-commander` skeleton, derives or fills the root
> cause, writes the corrective-action plan, and drafts an
> `incident-learnings` memory candidate. Systems and processes are
> examined — never individuals.

## When to use

- An incident or outage is resolved and the team needs a structured
  write-up.
- A near-miss happened and a post-mortem is being drafted (near-miss
  mode — same flow, different severity framing).
- The `incident-commander` hands off a post-mortem skeleton (empty
  root cause is accepted — do not block on it).
- German triggers: "Post-mortem", "Nachbesprechung", "was ist
  schiefgelaufen?", "Vorfallsanalyse".

Do NOT use when:

- The incident is still active — route to
  [`incident-commander`](../incident-commander/SKILL.md) first.
- The goal is root-cause analysis only, no write-up needed — route
  to [`root-cause-frameworks`](../root-cause-frameworks/SKILL.md).
- The concern is a future risk, not a past event — route to
  [`risk-officer`](../risk-officer/SKILL.md).

## Procedure

### 1. Consume the incident-commander skeleton

Read the incoming skeleton. Per
[`docs/contracts/analysis-memory-loop.md § 5`](../../docs/contracts/analysis-memory-loop.md):

- Accept any skeleton, complete or not.
- Extract: `SEV`, `State`, `Started`, `Timeline`, `Mitigation`,
  `Root cause` (may be `unknown` or TBD).
- Do NOT stall or reject on an empty root cause.

If no skeleton is provided, reconstruct from the user's description:
severity, timeline, impact, mitigation state.

### 2. Derive the root cause (if unresolved)

If root cause is `unknown` or TBD, invoke
[`root-cause-frameworks`](../root-cause-frameworks/SKILL.md). That
skill returns ranked candidates with confidence levels — do NOT force
a verdict. If root cause remains unresolved after the analysis pass,
mark the post-mortem `status: draft` and continue. A draft post-mortem
can still produce memory candidates (note the open question in the
candidate summary).

### 3. Write the blame-free report

Sections in order — no individuals named, systems and processes only:

1. **Summary** — one paragraph, blame-free, what happened and the
   business impact.
2. **Timeline** — reference the skeleton timeline; do NOT rebuild it.
3. **Impact** — users affected, duration, data, revenue, SLA.
4. **Detection** — how the incident was discovered (monitoring, user
   report, alert, manual).
5. **Root cause** — the confirmed or highest-confidence candidate;
   state confidence level if draft.
6. **Contributing factors** — conditions that made the root cause
   possible (tooling gaps, process gaps, system state).
7. **What went well** — at least one item; omitting this is a smell.
8. **What went wrong** — process, tooling, signals, communication
   gaps. No individual blame.

**Near-miss mode:** same sections; set `SEV: near-miss`. Add two
extra questions after "what went wrong":

- *"What would have made this worse?"*
- *"Which control caught it — luck or a designed control?"*

### 4. Corrective actions (folded-in phase)

For each identified gap, propose a corrective action. Reuse
`risk-officer` mitigation framing: owner role, size, residual-risk
note. Four action types:

| Type | Purpose |
|---|---|
| **Immediate** | Stop recurrence now (config fix, kill switch, revert) |
| **Preventive** | Remove the root cause (architectural or process change) |
| **Detection** | Catch it sooner next time (alert, dashboard, runbook) |
| **Process** | Address human/coordination gaps (oncall rotation, docs) |

Each action MUST have:

- **Owner role** (eng, ops, PO, support — never "the team")
- **Closure criterion** — specific, testable condition marking the
  action done
- **Regression signal** — a test, monitor, or alert that proves the
  fix held

An action without a closure criterion is a wish, not a plan.

### 5. Memory write-back

Per [`docs/contracts/analysis-memory-loop.md § 2`](../../docs/contracts/analysis-memory-loop.md):

1. Run the dedup pre-check — call `find_duplicate(...)` from
   `scripts.memory_lookup` over the same key-space (incident type,
   affected paths, decision area).
2. **Match found** — propose a `frequency` / `supersedes` update to
   the existing entry; do NOT create a new candidate.
3. **No match** — draft a REDACTED `incident-learnings` candidate to
   `/memory propose`:
   - `type: incident-learnings`
   - `summary`: one-line pattern (no customer names, no secrets, no
     project-rooted paths)
   - `evidence_paths`: ≥ 2 file paths (for admission gate)
   - `decision_surface`: ≥ 3 decisions this pattern changes (if
     possible)
   - `last_validated`: today
   - `review_after_days`: 90
   - `applicable_scope`: `project`

4. NEVER auto-promote. The human drives promotion via `/memory
   promote`. If the candidate fails the admission gate
   (`check_memory_proposal.py`), surface the gap to the user.

If `retrieve()` returns stale entries in `skipped`, surface them
explicitly — never silently use stale data.

## Output

The post-mortem produces, in order:

1. **Post-mortem document** — sections 1–8 from step 3; status
   `final` or `draft` if root cause is unresolved.
2. **Corrective-action table** — each action with type, owner,
   closure criterion, regression signal.
3. **Memory candidate** — the drafted `incident-learnings` JSONL
   snippet for `/memory propose` (or the frequency-update proposal if
   a duplicate was found).

## Do NOT

- Do NOT blame individuals — name systems, processes, signals, tooling.
- Do NOT auto-promote to curated memory — the gate is human-driven.
- Do NOT skip the dedup pre-check before drafting a memory candidate.
- Do NOT ship raw PII, customer names, secrets, or project-rooted
  paths in the memory candidate (redact per the contract).
- Do NOT reject or stall on an incomplete skeleton — mark `draft` and
  continue.
- Do NOT rebuild the timeline from scratch — reference the skeleton's
  timeline.

## Gotchas

- **Incomplete skeleton** → `status: draft`, not a rejection. Draft
  post-mortems still produce memory candidates with the open question
  noted.
- **Near-miss** → a mode within this skill, not a separate flow.
  Severity is `near-miss`; the extra two questions apply.
- **Corrective actions without closure criteria** are non-actionable.
  Always require a specific, testable done condition.
- **Stale memory entries** surface in `skipped`, not `results`. Never
  silently reuse stale data.

## See also

- [`incident-commander`](../incident-commander/SKILL.md) — produces the
  skeleton this skill consumes; run first during live incidents.
- [`root-cause-frameworks`](../root-cause-frameworks/SKILL.md) — RCA
  engine invoked in step 2 when root cause is unresolved.
- [`risk-officer`](../risk-officer/SKILL.md) — mitigation framing
  reused for corrective actions (owner, size, residual-risk).
- [`docs/contracts/analysis-memory-loop.md`](../../docs/contracts/analysis-memory-loop.md)
  — produce → propose → promote → retrieve contract this skill binds to.
