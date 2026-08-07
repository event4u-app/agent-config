# Phase 2 verdict — `orchestration-observed-dispatch-cost`

Resolves the claim pre-registered in `docs/CLAIMS.md` on 2026-08-07, against the
population measured in `backfill-2026-08-07.md`. The falsification criteria were
written before the extractor existed; nothing below was adjusted after the
numbers landed.

## Outcome: honest null — no family proves out

Not because delegation was measured to lose. Because **the corpus cannot decide
it in either direction**, and criterion (3) reserves a name for that: a result
between PROVE and DROP is INDETERMINATE, and indeterminate is not a pass.

## Why every family is indeterminate

`gateVerdict()` takes exactly two inputs — `net_win` and `quality_held`. Both
are unmeasured here, and neither can be recovered from the corpus.

**`net_win` needs a counterfactual that does not exist.** Two baseline methods
are equally defensible from the data:

- **A — overhead-bound.** Assume in-session execution would have consumed the
  same task tokens. Delegation then adds pure overhead (dispatch prompt +
  synthesis), so `net_win: false`.
- **B — context-displacement.** Assume in-session execution would additionally
  have carried those tokens inside the expensive parent context. Delegation
  then removes them, so `net_win: true`.

Run against the real gate, per family:

| Family | n | Median tokens | Verdict under A | Verdict under B | Flips |
|---|---:|---:|---|---|---|
| `verdict-judge` | 20 | 164,018 | fail | pass | **yes** |
| `read-only-fanout` | 15 | 113,245 | fail | pass | **yes** |
| `ordered-steps` | 1 | 312,210 | fail | pass | **yes** |
| `unclassified` | 3 | 527,320 | fail | pass | **yes** |

`resolveShippedDefault()` flips with it: `ask` under A, `on` under B. The
shipped default itself is undetermined by this data.

Criterion (2) is explicit: *a family whose verdict would flip on the choice of
baseline method is recorded INDETERMINATE rather than as a win.* Every family
flips. Every family is indeterminate.

**`quality_held` is unmeasured too.** `check_quality_regression.ts` scores
paired outputs. The corpus holds one arm — the orchestrated one. There is no
in-session output to pair against, so the second gate input cannot be supplied
either.

A gate whose two inputs are both unmeasured has not been passed or failed. It
has not been run on real inputs at all, and saying so is the finding.

## What the corpus did settle

Three things, none of which required the counterfactual:

1. **The instrumentation defect.** 370 dispatches, 1 recorded line — 0.27%
   capture by the model-carried emit step. The ≥20-line blocker on two roadmaps
   was never a usage problem and could not have been solved by more usage.
2. **The cost thesis's mechanism was not operating.** 27 of 39 metric-bearing
   dispatches resolved to an Opus tier; Haiku appears once. `downshift: true`
   is the shipped default, `resolveSubagentRouting` has zero production
   callers, and tier selection — being model-carried — selected **up**.
   Delegation as practised was not cheap delegation.
3. **The dispatch modes that are real here.** `competitive` does not appear at
   all in a month of production; `ordered-steps` appears once. The two families
   with real n are `verdict-judge` (20) and `read-only-fanout` (15). A posture
   built on eight dispatch templates is being carried by two.

## Pre-registered consequence, applied as written

Criterion (4): *if no family proves out, the recorded consequence is a renewed
honest null, orchestration demoted from the public value proposition, and
Phases 3–4 of the originating roadmap cancelled as `[-]`.*

Applied:

- The claim moves to `resolved-null` with this file as its pointer.
- Phases 3 and 4 of `road-to-orchestrator-first-execution` are cancelled `[-]`.
  The orchestrator-first mode is **not** built on this evidence.
- The public-value-proposition demotion is **not** executed from here.
  `road-to-orchestration-scope-decision` Phase 3 already owns that action for
  its own claim; recording that the condition is met and deferring the edit
  there is the same boundary Phase 1 Step 5 held. Reaching into another
  roadmap's phase would be the scope creep this roadmap was written against.

Honoring criterion (4) when it points somewhere unwelcome is the only thing
that made writing it beforehand worth anything.

## What would make this decidable

Not more of the same data — more dispatches of the same shape produce the same
indeterminacy. What is missing is specifically:

- **A baseline arm.** `road-to-subagent-value-realization-followup` Phase 1
  Step 2 already specifies it (`agent-settings.orchestrated.yml` vs
  `agent-settings.baseline.yml`). That roadmap's blocker is the real one, and
  the backfill does not resolve it.
- **A deterministic emit.** Phase 4's `SubagentStop` concern, so the next
  window's capture rate is not 0.27%.
- **Downshift actually firing.** A cost thesis whose mechanism has zero
  production callers is untested, not disproven.

All three are cheaper than building the mode would have been.
