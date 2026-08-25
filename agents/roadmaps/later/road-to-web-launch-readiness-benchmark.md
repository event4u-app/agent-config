---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "Not new work. This is the BENCHMARK half of road-to-web-launch-readiness, split out on AI-council verdict (2/2, 2026-08-25) because the session that authored the skill, the fixtures AND the ground truth may not also run and adjudicate the experiment that grades them. The parent roadmap stays OPEN -- the council ruled that closing it is owner-reserved -- so this file preserves the protocol rather than replacing a plan."
estate_offset_exempt: "Split-out, not authored: every step below is moved verbatim from road-to-web-launch-readiness Phase 3, which retains them as open with a blocker naming the owner decision. Nothing was created that did not already exist as committed scope."
---
# Road to web-launch-readiness — the benchmark and its verdict

> **Parent:** `road-to-web-launch-readiness`, which **remains open**. This is not
> a closure device. AI council 2026-08-25, 2/2 convergent, ruled that parking
> these steps is a process decision the council may take, and that treating the
> parking as roadmap *completion* is **owner-reserved** — the parent carries no
> cut line, so removing two required phases redefines what completion means.

## Why the authoring session may not run this

The session that would have executed 3.2 wrote the nine checks, the site-type
axis, the region axis, the three fixture sites **and** the ground truth those
fixtures are scored against. Both seats agreed the checked-in ground truth and
the binary decoy gate genuinely narrow the room to flatter a result — and both
held that they do not close it. One seat enumerated exactly where the discretion
still lives:

> Word the comparator prompt to favor structured or unstructured approaches ·
> include or exclude specific site context that aids one arm · interpret
> "missing canonical tag" vs "canonical present but wrong" differently · count
> or not count findings that overlap but aren't exact matches.

## The protocol must be FROZEN before either arm runs

This list is the second seat's, and it is the most useful thing to come out of
the round: it is why Option C (*"run the arms now, adjudicate later"*) was
rejected rather than taken as the compromise it looks like. Executing the arms
is only mechanical **after** these are fixed, and every one of them can be
chosen with knowledge of the expected defects:

1. the exact bare-prompt text for the comparator arm;
2. context packaging and ordering;
3. the model snapshot and sampling settings;
4. retry policy and number of runs;
5. whether a finding must identify the correct **page** as well as the defect;
6. semantic-match and partial-credit rules;
7. who scores ambiguous outputs.

**Archiving raw output creates auditability. It cannot undo an execution choice
made with knowledge of the answer.**

## Three statuses this roadmap keeps apart

The council's sharpest framing, kept because conflating them is the failure mode:

| status | current value |
|---|---|
| **Implementation complete** | yes — Phase 2 and 3.1 shipped 2026-08-25 |
| **Validation unresolved** | yes — `claim:web-launch-readiness-finds-more` is `unbacked` |
| **Roadmap complete** | **no**, and it may not be called complete without the owner |

`unbacked` + default-off is an honest **product** state, and an honest interim
state. It is not roadmap completion.

## What is already built and must not be rebuilt

- `src/scripts/check_web_launch_readiness.ts` — nine checks, site-type axis,
  region escalation. 29 unit tests.
- `tests/fixtures/web-launch-benchmark/` — three fixture sites, `GROUND-TRUTH.md`
  with 19 numbered defect rows plus one decoy, 18 tests asserting every row is
  actually in the tree. Two sabotage probes recorded at the parent's step 3.1.

## The two steps, verbatim from the parent

- [ ] **3.2 Run the comparator arm** — identical model, bare audit prompt, same
      site access.
      verify: both arms' raw outputs are archived with the run.
- [ ] **3.3 Resolve the claim** — PROVE, DROP, or UNDERPOWERED. The decoy gate
      is checked first: a decoy false positive is DROP regardless of the recall
      delta.
      verify: the verdict PR flips the claim status; on DROP the skill stays
      default-off and the null is recorded rather than noted.

**Exit:** a resolved verdict in either direction.

## The claim, the gate and the falsification paths — quoted, not paraphrased

`claim:web-launch-readiness-finds-more`, registered 2026-08-25 **before any
skill code existed**:

> A site-type-conditional web-launch audit skill finds more real launch defects
> than a bare "audit this site before launch" prompt on the same model, without
> flagging a site-type-irrelevant decoy.

**The hard gate**, and it is the reason the claim can fail while scoring well:

> one site-type-IRRELEVANT decoy is seeded — a missing team photo on the SaaS
> app — and flagging it is a classification failure that DROPS this claim
> REGARDLESS of recall. A skill that finds everything by flagging everything is
> the failure mode a recall threshold cannot see, which is why the decoy is a
> gate and not a metric.

**Falsification:**

> (1) the decoy is flagged; (2) recall does not exceed the comparator arm's;
> (3) the fixtures cannot be built to a ground truth both arms are scored
> against, in which case the claim is UNDERPOWERED rather than dropped — an
> unbuildable fixture says nothing about the skill.

**On DROP:**

> the skill does not ship enabled, and `road-to-web-launch-readiness` records
> the null as its outcome.

**Scope, which no result may exceed:**

> three fixtures on one model is one measurement, not a general result about
> audit skills; it establishes whether THIS skill beats a bare prompt on THESE
> defects and generalises to neither another model nor another defect set.

## Blockers

### b-benchmark-independent-execution

- **Blocks:** 3.2 and 3.3.
- **Owner:** maintainer.
- **Resolved when:** a session that did NOT author the checks, the fixtures or
  the ground truth has frozen all seven protocol items above in writing, before
  seeing either arm's output.
- **Status:** open.
- **Why it is a blocker and not a note:** the discretion is at execution time and
  is invisible afterwards. A prompt worded to favour one arm produces a number
  that looks exactly like a measurement.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The parked claim is read as abandoned rather than pending | product | `later/` is excluded from the dashboard, so an `unbacked` claim with no visible owner drifts into looking like a decision | The parent roadmap stays OPEN with a blocker naming the owner decision, so the obligation is visible in the active estate rather than only here | Why the authoring session may not run this |
| 2 | A later session freezes the protocol AFTER a pilot run | implementation | The seven items can be fixed retroactively to match a result that has already been seen | The blocker's `Resolved when` requires the freeze to precede any output, and both arms' raw outputs plus prompts and settings are archived | The protocol must be FROZEN before either arm runs |
| 3 | The decoy stops being a decoy | implementation | A future check that asked for team imagery would make the seeded absence a legitimate finding, and the gate would silently start scoring it | `web_launch_benchmark_fixtures.test.ts` asserts no configured check id matches team/photo/portrait; a sabotage probe adding such a check was recorded reddening it | What is already built and must not be rebuilt |

## Acceptance Criteria

- [ ] AC-1 — All seven protocol items are frozen in writing, in a commit that
      precedes any arm's execution.
- [ ] AC-2 — Both arms' prompts, settings, raw outputs and scoring decisions are
      archived with the run.
- [ ] AC-3 — The decoy gate is evaluated FIRST, and its result is recorded
      whether or not the recall comparison is reached.
- [ ] AC-4 — The claim carries PROVE, DROP or UNDERPOWERED, and on DROP the
      skill stays default-off with the null recorded as the outcome rather than
      noted in passing.
