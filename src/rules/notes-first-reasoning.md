---
type: "auto"
tier: "tier-2"
description: "Reasoning-heavy work (debugging, multi-hypothesis, weighing alternatives) — keep hypotheses/predictions/decisions in session notes, response carries conclusions + evidence only"
triggers:
  - keyword: "debug"
  - keyword: "investigate"
  - keyword: "hypothesis"
  - keyword: "root cause"
  - phrase: "figure out why"
  - phrase: "should we use"
load_context:
  - contexts/execution/rdp-gate.md
routes_to:
  - "skill:memory-consolidation"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Notes-First Reasoning

Part of the Reasoning Discipline Protocol. Engage per
[`rdp-gate`](../contexts/execution/rdp-gate.md) (settings + task-signal + host
self-assessment) — skip on trivial tasks; apply lightly on a strong-reasoning
host. The notes file is grounded in the documented cross-run lessons memory
(consolidated via [`memory-consolidation`](../skills/memory-consolidation/SKILL.md));
the in-task sections below are a local derivation for within-task scope.

## The Iron Law

```
MULTI-HYPOTHESIS REASONING, PREDICTIONS, AND DECISIONS LIVE IN THE SESSION
NOTES FILE — NEVER ECHOED INTO THE RESPONSE.
THE RESPONSE CARRIES CONCLUSIONS + EVIDENCE ONLY.
```

Reasoning dumped into the user-facing answer is both noise and a
`reasoning_extraction` refusal risk (see `rdp-gate`). Keep it in the notes file.
This is not "show your work in the reply" — it is the opposite.

## Notes file structure (the file, not the response)

Use the sections that apply; the structure carries the enumeration, so there is
no "write N hypotheses" instruction — record what the work actually surfaced.

- `## In-Task Hypothesis Log` — competing explanations under consideration.
- `## Killed beliefs` — each discarded hypothesis + the evidence that killed it.
- `## Predictions` — prediction · confidence · result · lesson (the calibration
  loop: hypothesis → prediction → reality → calibration).
- `## Decisions` — decision · alternatives · reason · revisit-if. Tactical,
  in-task decisions stay here; **escalate to
  [`decision-record`](../skills/decision-record/SKILL.md)/ADR** when the decision
  is cross-task or architectural (litmus: would a dev on a different component
  next month need this context?).
- `## Uncertainty` — per-dimension score (e.g. architecture/implementation/
  requirements: high/medium/low); feeds the adaptive-effort decision.

## What stays out of notes

User-attribute facts, transient TODOs, and durable cross-run lessons — those go
to the memory system (`memory-consolidation`), not the in-task notes.

## See also

- [`rdp-gate`](../contexts/execution/rdp-gate.md) — the table-free engagement gate.
- [`memory-consolidation`](../skills/memory-consolidation/SKILL.md) — promotes
  durable lessons across runs.
- [`verify-before-complete`](verify-before-complete.md) — the evidence the
  response carries comes from real tool results.
