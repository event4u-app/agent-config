---
type: "auto"
tier: "2b"
description: "Reasoning-heavy work — hypotheses/predictions/decisions go to session notes; the response carries conclusions + evidence"
triggers:
  - keyword: "debug"
  - keyword: "investigate"
  - keyword: "hypothesis"
  - keyword: "root cause"
  - phrase: "figure out why"
  - phrase: "should we use"
load_context:
  - ../contexts/execution/rdp-gate.md
routes_to:
  - "skill:memory-consolidation"
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
collision_ok:
  "debug": "debug hypotheses belong in the session notes file"
# obligation: line 35
obligation_frequency: "per-turn"
---

# Notes-First Reasoning

Part of the Reasoning Discipline Protocol. Engage per
[`rdp-gate`](../contexts/execution/rdp-gate.md) — skip on trivial tasks, apply
lightly on a strong-reasoning host.

## The Iron Law

```
MULTI-HYPOTHESIS REASONING, PREDICTIONS, AND DECISIONS LIVE IN THE SESSION
NOTES FILE — NEVER ECHOED INTO THE RESPONSE.
THE RESPONSE CARRIES CONCLUSIONS + EVIDENCE ONLY.
```

This is not "show your work in the reply" — it is the opposite. Why, and what
grounds the notes file:
[`notes-horizon-mechanics`](../guidelines/agent-infra/notes-horizon-mechanics.md).

## Notes file structure (the file, not the response)

Use the sections that apply — record what the work actually surfaced.

- `## In-Task Hypothesis Log` — competing explanations under consideration.
- `## Killed beliefs` — each discarded hypothesis + the `killed-if` that killed
  it.
- `## Predictions` — **chosen form** · prediction · confidence · result · lesson.
- `## Decisions` — decision · alternatives · reason · revisit-if ·
  **next-commitment**. Tactical decisions stay here; **escalate to
  [`decision-record`](../skills/decision-record/SKILL.md)/ADR** when cross-task
  or architectural.
- `## Uncertainty` — per-dimension score (e.g. architecture/implementation/
  requirements: high/medium/low); feeds the adaptive-effort decision.

### The horizon — where `next-commitment` ends

```
A CHOICE AUTHORISES WORK UP TO THE NEXT EVIDENCE-PRODUCING BOUNDARY.
NAME THE BOUNDARY FROM THE LIST. NEVER "THE WORK THE EVIDENCE SUPPORTS" —
THAT IS A JUDGEMENT, AND A JUDGEMENT IS NOT A HORIZON.
```

### Reopening — once, on contradiction, never on a schedule

```
AN OBSERVATION THAT CONTRADICTS THE PREDICTION REOPENS THE CHOICE BEFORE THE
NEXT STEP — FROM THE CANDIDATE LIST THAT ALREADY EXISTS, NEVER A FRESH
ENUMERATION. ONE REOPEN PER CANDIDATE. THE SECOND CONTRADICTION HANDS OVER TO
THE RETRY-BUDGET LADDER RATHER THAN REOPENING AGAIN.
```

## What stays out of notes

User-attribute facts, transient TODOs, and durable cross-run lessons go to the
memory system (`memory-consolidation`), not the in-task notes.

## See also

[`notes-horizon-mechanics`](../guidelines/agent-infra/notes-horizon-mechanics.md)
— every mechanic this rule points at. Also
[`rdp-gate`](../contexts/execution/rdp-gate.md) and
[`verify-before-complete`](verify-before-complete.md).
