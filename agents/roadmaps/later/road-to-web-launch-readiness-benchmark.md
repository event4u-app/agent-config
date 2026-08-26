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

> **Parent:** `road-to-web-launch-readiness`, **archived 2026-08-25 by approved
> rescope** — a second AI council, 2/2, decided the parent may close around
> these two steps once the maintainer's standing delegation supplied the
> authority the first council found missing. The first council's ruling is not
> overturned: it held that parking is a council decision and that treating the
> parking as *completion* is owner-reserved. The owner delegated exactly that.
>
> **This file is now the only place the benchmark lives, which raises its
> stakes rather than lowering them.** The parent no longer holds an open step
> pointing here, so the controls below — the promotion gate, the accountable
> trigger and the eligibility rule — are what keep this from becoming abandoned
> work. Both seats of the second council said so explicitly; one named the
> failure mode as `later/` becoming "where work goes to die".

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

## The promotion gate, the trigger, and who is eligible

Added 2026-08-25 as binding conditions of the parent's approved rescope (AI
council 2/2). The openai seat asked for an enforceable gate in place of a
passive `revisit-if`, on the ground that a gate blocks an action while a
revisit-note only invites a review: *"This is more enforceable than a passive
`revisit-if` entry."*

**The promotion gate — one-way, and it is the load-bearing control.**

> `claim:web-launch-readiness-finds-more` must remain `unbacked` and the
> `web-launch-readiness` command must remain default-off. Neither may change,
> and no comparative claim about this command may be published anywhere —
> README, CLAIMS ledger, release notes, skill description — until this roadmap
> records a verdict from an execution that satisfies
> `b-benchmark-independent-execution`.

`unbacked` + default-off is already the shipped state, so the gate forbids no
current behaviour; what it forbids is a future session promoting the claim on
the strength of the *infrastructure* existing. That is the specific misread the
gate exists to stop, and it is available because the fixtures, the ground truth
and 18 passing tests all look like validation without being any.

**`unbacked` is a repository disposition, never an experimental verdict.** Kept
apart in writing at the openai seat's request: the benchmark did not run, so no
superiority, parity or failure conclusion may be drawn in either direction. A
reader who takes `unbacked` for a resolved null believes an experiment happened.

**The accountable trigger.** This roadmap is reviewed whenever any of these
occur, whichever comes first — it does not wait on a calendar alone:

1. The claim or the command is proposed for promotion, default-on, or external
   publication. This is the gate above firing, and it is the strongest trigger
   because it is the moment the missing evidence would actually matter.
2. A ground-truth-blind protocol designer or evaluator becomes available.
3. Any fixture, `GROUND-TRUTH.md` row, decoy, or protocol input changes — a
   changed input invalidates a frozen protocol, so the freeze must be re-taken.
4. The next roadmap review at which this file has no accountable owner.
5. `review_by: 2026-12-31` in this file's own frontmatter.

**Who is eligible to freeze the protocol and run the arms.** The condition is
*exposure*, not identity, and it is decidable rather than a judgement call:

- **Ineligible** — any session that has read `tests/fixtures/web-launch-benchmark/GROUND-TRUTH.md`,
  authored or edited the nine checks, the site-type axis, the region axis, the
  three fixture sites, or this roadmap's protocol section. **The session that
  wrote this paragraph is ineligible on every one of those counts** and is
  recording that fact rather than leaving a later reader to infer it.
- **Eligible** — a session or human that can freeze the seven items with the
  fixture *inputs* visible and the expected-defect *manifest* not. The manifest
  is a single file, so the isolation is mechanical: withhold
  `GROUND-TRUTH.md`.
- **Not sufficient** — merely being a later session. Both councils said so; a
  new session in this same repository can open the manifest in one read.

**Why THIS session did not freeze the seven items, though it was asked to.** The
anthropic seat proposed exactly that, so that the future evaluator would run
this experiment rather than invent one. The openai seat refused, and the refusal
is adopted: *"Having this ground-truth-aware council select sample sizes,
metrics, or thresholds would freeze contamination into the experiment rather
than eliminate it."* The conflict that bars this session from running the arms
bars it equally from parameterising them. The cost is real and is accepted: the
future evaluator may design a different experiment from the one imagined here,
and a different experiment is a better outcome than a contaminated one.

## Blockers

### b-benchmark-independent-execution

- **Blocks:** 3.2 and 3.3.
- **Owner:** maintainer.
- **Resolved when:** a session that did NOT author the checks, the fixtures or
  the ground truth has frozen all seven protocol items above in writing, before
  seeing either arm's output.
- **Status:** open — **unchanged, and deliberately so.** The parent's rescope
  did not resolve this blocker and could not: it moved the *closure* decision,
  not the *independence* condition. The 2026-08-25 council was asked to freeze
  the seven items and declined, on the ground that a ground-truth-aware seat
  parameterising the experiment freezes the contamination in rather than
  removing it. So this stays open with the eligibility rule above naming who
  may close it.
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
