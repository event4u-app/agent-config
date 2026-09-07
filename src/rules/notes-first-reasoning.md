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
  - contexts/execution/rdp-gate.md
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
- `## Predictions` — **chosen form** · prediction · confidence · result · lesson
  (the calibration loop: hypothesis → prediction → reality → calibration). The
  form is named first because a prediction with no subject cannot be
  contradicted: when the observation comes back, "the prediction missed" has to
  point at *what* it was a prediction about, or nothing reopens.
- `## Decisions` — decision · alternatives · reason · revisit-if ·
  **next-commitment**. Tactical, in-task decisions stay here; **escalate to
  [`decision-record`](../skills/decision-record/SKILL.md)/ADR** when the decision
  is cross-task or architectural (litmus: would a dev on a different component
  next month need this context?).

  `next-commitment` is the **boundary this choice authorises work up to** — not
  the plan for it. Choosing a form is not permission to execute a twelve-step
  plan on it without re-reading the position.

### The horizon — where `next-commitment` ends

```
A CHOICE AUTHORISES WORK UP TO THE NEXT EVIDENCE-PRODUCING BOUNDARY.
NAME THE BOUNDARY FROM THE LIST. NEVER "THE WORK THE EVIDENCE SUPPORTS" —
THAT IS A JUDGEMENT, AND A JUDGEMENT IS NOT A HORIZON.
```

The boundary is the nearest of these that the plan actually reaches: a **test
result** · a **type or schema inspection** · a **compile** · a **runtime probe**
· a **call-site inventory** · a **dry run** · a **browser observation** · a
**dependency-contract read**. The set is enumerable, which is the whole point —
"the work up to the nearest of those" is decidable from the plan, and `next
justified commitment` as prose degrades to *"implement solution"*, which is the
starting point wearing a label.

**Width scales with reversibility, never with task size:**

| The action is… | The horizon runs to… |
|---|---|
| a reversible local edit | a whole implementation slice — stopping at the first boundary costs more than it saves |
| stateful or cross-layer | the next boundary from the list above |
| irreversible or a public contract | **before** the irreversible step, unless direct evidence already covers it |

**The look-ahead ladder is a CEILING, never a quota.** Three to five moves is
the *maximum*, and only for a forcing, irreversible or externally observable
line. Stateful or cross-layer gets two to three. A quiet reversible line gets
**one, deliberately** — and no artifact anywhere requires a minimum depth.
Always-three-to-five across all variants is 1024 leaves at four branches and
depth five, which buys nothing and costs the run its budget.

### Reopening — once, on contradiction, never on a schedule

```
AN OBSERVATION THAT CONTRADICTS THE PREDICTION REOPENS THE CHOICE BEFORE THE
NEXT STEP — FROM THE CANDIDATE LIST THAT ALREADY EXISTS, NEVER A FRESH
ENUMERATION. ONE REOPEN PER CANDIDATE. THE SECOND CONTRADICTION HANDS OVER TO
THE RETRY-BUDGET LADDER RATHER THAN REOPENING AGAIN.
```

A reopen driven by ritual rather than by contradicting evidence is ceremony, and
an uncapped reopen is a loop with better manners. Two consequences:

- **A rejection whose premise is falsified is not a rejection.** A candidate
  killed by an assumption that later turns out false is *un-evaluated*, not
  dead — it returns to the set. That is what makes a stated `killed-if`
  condition worth carrying: without it, "we ruled that out" is unfalsifiable.
- **The first failure reads the candidate list before the retry**, where one
  exists — see [`autonomy-mechanics`](../contexts/execution/autonomy-mechanics.md)
  § Retry-budget escalation ladder. Where none exists the ladder is unchanged.
  This adds a branch; it does not move the N=3 budget.
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
