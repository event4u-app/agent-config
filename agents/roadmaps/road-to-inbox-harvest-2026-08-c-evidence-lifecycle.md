---
complexity: lightweight
status: ready
---

# Road to a review binding that survives a checkbox

**Goal.** Stop a code review from being invalidated by an edit that did not
touch code, and give the review evidence a retention shape — without weakening
what the binding proves.

**Source:** `agents/tmp.old/feedback-12.0.0.txt`, raised by three of its five
passes as the largest remaining structural cost. Triage:
`agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`.

## Context

The R2 completion-review manifest already carries **three** hash segments —
`scope_hash`, `roadmap_hash`, `ac_hash`
(`src/scripts/dispatch_r2_reviewer.ts:417-419`). The reviews asked for that
segmentation to be built; it exists. The defect is one layer down, and it is
sharper than the reviews stated:

- The staleness verdict compares **only** `scope_hash`
  (`dispatch_r2_reviewer.ts:331`). The other two segments are written, parsed,
  and never consulted for currency.
- `scope_hash` is `sha256` of `git diff <base>...HEAD` with exactly **two**
  exclusions: `agents/evidence/reviews` and `agents/evidence/metrics`
  (`dispatch_r2_reviewer.ts:112-115`).
- `agents/roadmaps/` is therefore **inside** the code scope. Flipping one
  checkbox changes `scope_hash` and invalidates the binding — and because the
  dashboard regenerates on every roadmap touch, a single checkbox produces two
  in-scope file changes.

So the segment that exists to hold roadmap content does not protect the review
from roadmap content. That is a mechanism, not yet an incidence: how often the
churn is *actually* caused by a roadmap-only change is Phase 1's job, because a
mechanism that fires rarely does not justify touching an integrity gate.

The cost side is measured: **28** `*.review-input/` directories carrying **28**
`diff.patch` files totalling **45,598** lines, **50** `*.findings.md`,
**5.7 MB** under `agents/evidence`, and **4** re-bind entries in the 12.0.0
changelog era alone.

## Non-goals

- Weakening what a binding proves. A review that no longer notices a code change
  is worse than one that re-binds too often; `evaluator-independence` and the R2
  contract are the floor, not the negotiable part.
- Deleting review evidence. Retention here means tiering and a regeneration
  guarantee; any actual removal is a separate, confirmable act.
- Changing who may dispatch or adopt a review.

## Phase 1 — Measure which segment actually moves

- [ ] For every tracked binding under `agents/evidence/reviews/`, recompute the
      three segments at the recorded revision and at the branch tip, and record
      which segments differ. Write it to
      `agents/evidence/analysis/review-binding-drift.md`.
      *verify:* the file has one row per binding with three per-segment verdicts.
- [ ] Split the differing rows into "code changed" and "only non-code paths
      changed" (roadmaps, dashboard, docs), and report the ratio. That ratio is
      the whole case for Phase 2.
      *verify:* the analysis states both counts and the ratio.
- [ ] Record what each of the four 12.0.0-era re-binds was actually caused by,
      from the same data.
      *verify:* the analysis names a cause per re-bind, or says the data cannot
      attribute it.

## Phase 2 — Make the verdict segment-aware, only if Phase 1 earns it

- [ ] Decide from the Phase 1 ratio whether to act, and write the decision into
      the analysis file either way. A ratio that shows code changes dominate is
      a legitimate stop: the churn would then be reviews correctly noticing
      code, and nothing here should ship.
      *verify:* the analysis carries an explicit proceed or stop with the ratio
      that decided it.
- [ ] If proceeding: make the currency verdict consult all three segments, so a
      binding whose `scope_hash` moved solely through roadmap content is
      reported as `roadmap-drifted` rather than `stale` — a distinct verdict,
      not a pass.
      *verify:* a test constructs both cases and asserts the two verdicts differ
      and that a real code change still reports `stale`.
- [ ] Pin the negative case: a diff that touches code **and** a roadmap in the
      same range must still report `stale`. The failure mode of a segmented
      verdict is exactly a code change hiding behind a roadmap edit.
      *verify:* that test exists and fails when the segment check is inverted.

## Phase 3 — Give the evidence a retention shape

- [ ] Classify the 28 `review-input/` directories as active (binding current),
      recent, or archived (the reviewed content is merged and the binding is
      historical), and record the tier plus its byte cost per directory.
      *verify:* every one of the 28 carries a tier in the analysis file.
- [ ] State the regeneration guarantee per tier: for which tiers a stored
      `diff.patch` can be re-derived from the recorded revisions, and for which
      it cannot (a force-push or a rewritten history makes it irreproducible, in
      which case the patch is the only copy and stays).
      *verify:* the analysis names the irreproducible directories explicitly.
- [~] Compact the tiers that are provably reproducible. Deferred behind
      the blocker below — it removes committed evidence.

## Blockers

### blocker: evidence-compaction-approval
- **Status:** open
- **Owner:** maintainer
- **Question:** may provably-reproducible `diff.patch` bodies be dropped in
  favour of their recorded base/head revisions? Phase 3 produces the list and
  the proof of reproducibility; the removal itself is a bulk deletion of
  committed evidence and is not an agent's call.
- **Resolved when:** the maintainer records yes with a tier boundary, or no.
- **Blocks:** step 3.3 only. Phases 1 and 2 and the classification in 3.1–3.2
  proceed either way.
- **What to do:** pick exactly one — (a) no compaction: the tiering and the
  reproducibility verdict are the whole deliverable, and step 3.3 is marked
  `[-]` cancelled; or (b) compact at a named tier boundary, dropping only
  directories Phase 3 proved reproducible and leaving every irreproducible one
  intact. Mutually exclusive. (b) requires the boundary to be stated in this
  blocker, not chosen at execution time.

## Acceptance criteria

- [ ] The per-binding segment-drift table exists and states the
      code-vs-non-code ratio.
- [ ] Phase 2 carries an explicit proceed or stop decision citing that ratio.
- [ ] If Phase 2 proceeded: a test asserts that a code change accompanied by a
      roadmap edit still reports `stale`.
- [ ] Every `review-input/` directory carries a retention tier and a
      reproducible-or-not verdict.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A segment-aware verdict becomes an escape hatch | product | The whole value of the binding is that it notices when the reviewed content moved; a verdict that forgives one segment is one careless predicate away from forgiving a code change that rode along with a roadmap edit | Step 2.3 pins the mixed case as a required failing test before the relaxation lands, and the new verdict is a distinct label rather than a pass | Phase 2 — Make the verdict segment-aware, only if Phase 1 earns it |
| 2 | The mechanism is real and the incidence is nil | implementation | The roadmap-inside-scope mechanism is verified from source, but "verified mechanism" and "this is what has been costing us" are different claims, and building on the first while assuming the second is the premise error this package has recorded repeatedly | Phase 1 measures the ratio before any code moves, and step 2.1 makes a stop the documented outcome rather than a failure | Phase 1 — Measure which segment actually moves |
| 3 | Compaction destroys the only copy | implementation | A patch is reproducible only while both recorded revisions remain reachable; a force-push or a pruned branch silently converts a reproducible directory into the sole record, and the loss is discovered when someone needs it | 3.2 requires the irreproducible set to be named before anything is dropped, and 3.3 is `[~]` behind a maintainer blocker | Phase 3 — Give the evidence a retention shape |
| 4 | Excluding roadmaps from the scope diff is chosen as the shortcut | implementation | The cheapest fix is adding `agents/roadmaps` to the exclusion list, which also hides genuine roadmap changes from every review that should have read them | The plan routes through the verdict rather than the scope: the segments already exist, so the fix is to consult them, and the exclusion list stays at its two entries | Context |
