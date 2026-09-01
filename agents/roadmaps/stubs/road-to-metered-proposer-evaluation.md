---
complexity: lightweight
review_by: 2026-09-30
---

# Road to metered proposer evaluation — stub

> **Class:** drain-run transfer. Created 2026-08-31 (drain run 13) by the
> closure run of
> [`road-to-governed-harness-evolution`](../archive/road-to-governed-harness-evolution.md),
> whose step 4.1, step 5.6 and AC-8 this file carries, together with the exit
> criterion Phase 4 was carrying for step 2.3.
> **Capability-gated, not demand-gated:** the scope decision is already taken
> and the work is wanted; what is missing is a metered model call that no
> repository automation may make inside the parent's declared scope. The shared
> promotion criteria in [`README.md`](README.md) — recruited customer, funded
> security audit, ADR sign-off — do **not** govern it. It is promoted by its own
> probe below returning true, and nothing else.

> **Why ONE file for four items.** AI council 2026-08-31 (drain run 13), 2/2
> convergent, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, both
> seats present, asked whether these transfer to one stub or several. Verbatim
> from the openai seat: *"Use one successor stub for Items 1, 3, and 4, because
> lifting the live-harness park is their shared prerequisite. Keep them as
> separate criteria within that stub, each retaining its own receiver,
> `recheck_when`, evidence already established, and closure condition."* The
> anthropic seat named the coupling: *"item 1's receipt stages would feed item
> 3's ladder recorder, which enables item 4's first run."* So the items below
> are separate criteria in one document, and are promoted **per item**.

## The shared cause

Every item here polices a property of a **metered model call**. The parent
roadmap deliberately makes none. Its step 5.2 — *"Keep the live-floors park
intact. No live harness."* — is closed `[x]` and held by
`tests/scripts/governed_harness_no_live_harness.test.ts` (9/9), whose half B
scans every `.ts` under `src/` whose header declares it as belonging to that
roadmap. The park it defends was set by a prior 2/2 council decision on
[`later/road-to-routing-assurance-live-floors.md`](../later/road-to-routing-assurance-live-floors.md).

This stub does **not** reopen that park, and must not be read as routing around
it. The council named that as a floor: *"This disposition must not implicitly
reopen or route around the live-harness park."*

## What transferred

### Item 1 — the receipt-bearing cascade stages (parent step 4.1)

**Verbatim `verify:` from the parent:** *a candidate failing the cheapest stage
consumes no model call, and the stage list can produce the Phase 1
classification.*

Unmet half: the receipt-bearing stages — activation/delivery, adherence, and the
statistical stages — plus one settled twelve-stage enumeration. Both need an
independent, append-only receipt producer with version-bound, attributable
observations, so that the candidate, the evaluated agent and the mutable harness
cannot all influence both a behaviour and its receipt.

- `recheck_when`: `src/scripts/_lib/evaluation_receipt.ts` — absent at transfer.
- Inherited evidence, not to be re-earned: `src/scripts/_lib/evaluation_cascade.ts`
  ships a six-stage deterministic prefix
  (`schema-validity → path-ownership → holdout-disclosure → budget →
  near-duplicate → metric-verdict`), wired into `evolution_lab.ts` `verbRun`,
  15/15 green, `model_calls` a literal `0` on every path, sabotage-proven in
  three directions (2 failed / 13 passed; 1 failed / 14 passed; and one probe
  that stayed green and was recorded as an unproven guard rather than hidden).
- Also inherited: the prefix may assign only `content` and `unknown`;
  `activation` and `adherence` are excluded by construction and a test pins it.
  Assigning either from a deterministic proxy is evidence manufacturing, and the
  receipt producer does not change that — it is what would make the assignment
  legitimate.
- A prior council round on the twelve-stage enumeration returned `REVISE` at a
  **degraded 1/2** and produced two materially different twelve-stage lists from
  the same seat asked twice. The arity (twelve) is decided; the stage semantics
  are not.

### Item 2 — cheapest-first ordering under a real attempt sequence (parent step 5.6)

**Verbatim `verify:` from the parent:** *the ROI figure appears in every run
report, and a cheaper model is tried before an expensive one on each defect
class.*

Unmet half: the second conjunct. Ordering an attempt sequence needs attempts.

- `recheck_when`: `src/scripts/_lib/ladder_attempt_recorder.ts` `recordLadderAttempt`
  — absent at transfer.
- **Inherited evidence — the ROI conjunct is BUILT, and this transfer must not
  be read as saying otherwise.** `buildRunReport`
  (`src/scripts/_lib/evolution_roi.ts:363`) refuses a report whose ROI figure is
  absent or carries an unknown kind; `evolution_lab.ts:865` builds it on the one
  path a run completes on and writes it at `:878`; an end-to-end test drives the
  real CLI (`tests/scripts/evolution_lab.test.ts:524`). The council made that
  non-erasure a condition of the transfer.
- Also inherited: `LADDER`, `assertLadderWellFormed` and `assertCheapestFirst`
  are shipped and sabotage-proven (28/28; neutralising the cheapest-first
  comparison reds 3 of 28). They are an ordering **policy** proved to fire, over
  a population of zero.
- Also inherited: three defect classes (`policy_blocked`,
  `dependency_unavailable`, `human_rejected`) carry an EMPTY ladder and license
  no metered attempt at all. A promotion run must not quietly price them.

### Item 3 — the first candidate run (parent AC-8)

**Verbatim from the parent:** *Programme success and failure criteria from 0.7
were committed before the first candidate run, and the run report carries an
evolution-ROI figure.*

- First conjunct: **already satisfied**, and inherited as satisfied —
  `agents/evidence/analysis/governed-harness-success-criteria.md` was committed
  at `172b87c6` (2026-08-30 10:32:57). It is satisfied vacuously, because no
  candidate run has happened; the vacuity is what this item removes, not a
  defect in the conjunct.
- Second conjunct: the SHAPE half is closed by item 2's inherited evidence. The
  SUBJECT half — a run that evaluates candidates against an eval corpus over
  repeated trials — is what is missing.
- **A fixture is not the first candidate run.** The end-to-end case at
  `tests/scripts/evolution_lab.test.ts:524` drives the real CLI over five real
  clones and proves the report reaches stdout; it evaluates no candidate.
  Reading it as the run is the substitution this criterion exists to catch.

### Item 4 — the selection fixture over the frozen set (parent step 2.3, carried by Phase 4)

**Verbatim from the parent's struck-through `verify:`:** *a fixture proves
selection reads the whole frozen set.*

Carried into the parent's Phase 4 exit criteria on an AI-council verdict of
2026-08-30 (anthropic + openai, 2/2), against "the selection stage 4.1 builds".
That stage was never built: the six stages 4.1 shipped are listed under item 1
and none of them reads the frozen corpus.

- The frozen set: the 100 files pinned in
  `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`.
- The failing shape the fixture must catch, verbatim from the parent: *a
  selection stage that reads only the train partition, or only the cases
  carrying `class: exemplar`, and reports a verdict as if it had seen the
  corpus.*
- **Do not write it before the stage exists.** A fixture written today scans
  nothing and exits green, which is worse than no fixture because it looks like
  coverage. That is the parent's own finding, recorded twice; recording it a
  third time is not progress.
- The `failure` axis rides here too, and deliberately as nothing yet: when the
  cascade can produce an OBSERVED outcome per case, expected-vs-observed is
  recorded against stable case ids at that point — not as an empty
  `known-failures.json` with a schema TBD, which a prior council round rejected
  as a vacuous mechanism.

## Promotion probe — the only thing that promotes this file

```
PROMOTE AN ITEM WHEN, AND ONLY WHEN, ALL THREE READINGS RETURN TRUE:
  1. A roadmap other than road-to-governed-harness-evolution has lifted the
     live-harness park recorded in
     later/road-to-routing-assurance-live-floors.md — read its status field,
     yes or no.
  2. That roadmap authorises a metered proposer call with a written spend
     ceiling and a UTC-day schedule — read the authorisation, yes or no.
  3. The item's own `recheck_when` path resolves in the tree —
     `src/scripts/_lib/evaluation_receipt.ts` for item 1,
     `src/scripts/_lib/ladder_attempt_recorder.ts` for item 2, either for
     item 3, and a corpus-selection stage for item 4 — yes or no.
```

Reading 1 is deliberately *another* roadmap: the parent is closed, and a closed
roadmap may not be the vehicle for reopening a park it declared intact.

Promote **per item**, not per file — delete an item when its work lands
elsewhere, and delete this file when the last one is gone.

## Floors this transfer may not lower

Carried verbatim from the AI-council verdict of 2026-08-31 (2/2 convergent,
anthropic/claude-sonnet-4-5 + openai/codex-default), because a transfer that
quietly relaxes a criterion is the failure `[-]` exists to prevent:

1. `[x]` requires evidence against the real subject, except for a genuinely
   present-tense absence assertion.
2. Fixtures and policy definitions cannot impersonate metered attempts or
   candidate runs.
3. Cascade completion requires attributable, version-bound, append-only
   receipts.
4. Cheapest-first requires an observed attempt sequence, not merely a valid
   ladder.
5. An introduced LLM proposer must survive an actual `paired_verdict`.
6. `[-]` must continue to mean transferred without weakening or dropping the
   criterion.
7. This disposition must not implicitly reopen or route around the live-harness
   park.
8. Sabotage-proof quality transfers intact: the verification depth already
   achieved is documented above and is inherited, not re-earned and not
   re-claimed.

## Not in scope

Lifting the live-harness park — that decision belongs to
[`later/road-to-routing-assurance-live-floors.md`](../later/road-to-routing-assurance-live-floors.md)
and to whichever roadmap takes it up. Building a second verdict beside
`_lib/paired_verdict.ts`, or a second defect taxonomy beside
`_lib/pathology_archive.ts`'s `PATHOLOGY_WHY` — both are named risks on the
parent and neither is opened by anything here.
