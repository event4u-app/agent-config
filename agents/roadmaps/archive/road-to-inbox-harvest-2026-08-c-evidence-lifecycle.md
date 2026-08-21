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

## Outcome

Closed 2026-08-20. **Archived does not mean achieved** — this roadmap's headline
proposal was measured and refused, and that refusal is the deliverable.

| Phase | Outcome | What it means |
|---|---|---|
| Phase 1 — measure which segment moves | **satisfied** | The three-segment drift table exists, with a code-vs-non-code ratio and an unanticipated merge axis. |
| Phase 2 — make the verdict segment-aware | **abandoned** | Step 2.1's pre-registered stop condition fired (code dominates at ~79 %). Steps 2.2 and 2.3 never shipped and are `[-]`. The currency verdict is unchanged. |
| Phase 3 — give the evidence a retention shape | **narrowed** | The tiering and the reproducibility verdict landed (3.1, 3.2). Compaction (3.3) is `[-]` abandoned by council decision — see the blocker. |

So the code in `dispatch_r2_reviewer.ts` is **untouched by this roadmap**. What
landed is one probe (`src/scripts/probe_review_binding_drift.ts`) and one
analysis file (`agents/evidence/analysis/review-binding-drift.md`). Two things a
reader should not infer from the `[x]` boxes:

- **The defect described in Context is still live.** `agents/roadmaps/` remains
  inside the review scope, and flipping a checkbox still moves `scope_hash`. The
  measurement found the incidence too low, and the relaxation's failure mode too
  silent, to justify touching an integrity gate — not that the mechanism was
  imaginary.
- **The evidence tree was not compacted, and it is still growing.** 5.7 MB →
  6.9 MB → **13 MB** under `agents/evidence` across the three measurements this
  plan recorded. Retention got a *shape*, not a *policy*. Anything that acts on
  that growth is a separate plan with its own blocker.

One thing the plan did not set out to find and did find: `--verify-current`
(CI's "Gate R2") already re-derives all three segments and blocks on any of
them, so the roadmap segment has teeth — just not in the verdict Phase 2
targeted. Any future reopening has to reconcile the two.

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

**Correction (2026-08-17) — every number in the paragraph above has grown, and
the direction is the point.** Re-measured: **38** `*.review-input/` directories
carrying **38** `diff.patch` files totalling **61,101** lines, **64**
`*.findings.md`, **6.9 MB** under `agents/evidence` (of which **5.1 MB** is
`reviews/`). The original figures are left in place rather than rewritten so the
growth rate stays auditable: +10 directories, +15,503 patch lines and +1.2 MB in
roughly two weeks. That strengthens the roadmap's premise rather than weakening
it — but any decision taken against the old numbers is being taken against a
tree ~36 % larger than the one they describe.

**Third reading (2026-08-20, at `1d2f73c40`), same convention — appended, not
substituted:** **73** `*.review-input/` directories carrying **73**
`diff.patch` files, **120** `*.findings.md`, **13 MB** under `agents/evidence`
(of which **11 MB** is `reviews/`). Series: 28 → 38 → 73 directories and
5.7 → 6.9 → 13 MB in about three weeks. The premise keeps strengthening and the
tree keeps outrunning every snapshot taken of it — which is the reason
acceptance criterion 4 can only ever be true *at a revision*, and the reason the
compaction decision was re-verified against a fresh list rather than the old
one.

## Non-goals

- Weakening what a binding proves. A review that no longer notices a code change
  is worse than one that re-binds too often; `evaluator-independence` and the R2
  contract are the floor, not the negotiable part.
- Deleting review evidence. Retention here means tiering and a regeneration
  guarantee; any actual removal is a separate, confirmable act.
- Changing who may dispatch or adopt a review.

## Phase 1 — Measure which segment actually moves

- [x] For every tracked binding under `agents/evidence/reviews/`, recompute the
      three segments at the recorded revision and at the branch tip, and record
      which segments differ. Write it to
      `agents/evidence/analysis/review-binding-drift.md`.
      *verify:* the file has one row per binding with three per-segment verdicts.
      → 52 artefacts, one row each, in § Per-binding segment verdicts. Measured by
      `probe_review_binding_drift`, which imports the scope definition from
      `dispatch_r2_reviewer` rather than restating it.
- [x] Split the differing rows into "code changed" and "only non-code paths
      changed" (roadmaps, dashboard, docs), and report the ratio. That ratio is
      the whole case for Phase 2.
      *verify:* the analysis states both counts and the ratio.
      → **64 code (79.0 %) · 10 non-code (12.3 %) · 7 unattributable (8.6 %)** over
      81 re-bind events. A second, independent axis the plan did not anticipate:
      a MERGE landed in the span of 25 events (30.9 %), including 23 filed under
      `code` — so 79 % is an upper bound, not an exact count. Netting the merge
      axis out leaves **8 of 81 (9.9 %)** the proposed fix would have prevented.
- [x] Record what each of the four 12.0.0-era re-binds was actually caused by,
      from the same data.
      *verify:* the analysis names a cause per re-bind, or says the data cannot
      attribute it.
      → All four attributed in § The 12.0.0-era re-binds, derived from the
      `11.0.0..12.0.0` tag span. Three hit one SKIP artefact (`roadmap-sweep-…`):
      two non-code-only, one `base-moved`. The fourth
      (`fix-branch-freshness-r2-findings`) was a genuine code change.

## Phase 2 — Make the verdict segment-aware, only if Phase 1 earns it

- [x] Decide from the Phase 1 ratio whether to act, and write the decision into
      the analysis file either way. A ratio that shows code changes dominate is
      a legitimate stop: the churn would then be reviews correctly noticing
      code, and nothing here should ship.
      *verify:* the analysis carries an explicit proceed or stop with the ratio
      that decided it.
      → **STOP.** § Decision — Phase 2 STOPS, citing 79.0 % code (re-measured
      2026-08-20 at `1d2f73c40`: **79.4 %** over 199 events, with the addressable
      share falling from 9.9 % to 7.0 % — the stop is strengthened, not reopened;
      both readings are kept side by side in the analysis file). The
      pre-registered stop condition is met, so this is the recorded outcome, not
      a failure to build. Three qualifications recorded there: the addressable
      share is 12.3 % (not the whole non-code remainder — `base-moved` is out of
      reach of a segment-aware verdict), Risk 1's failure mode is silent by
      construction, and a cheaper repair exists for 6 of the 10 events.
- [-] If proceeding: make the currency verdict consult all three segments, so a
      binding whose `scope_hash` moved solely through roadmap content is
      reported as `roadmap-drifted` rather than `stale` — a distinct verdict,
      not a pass.
      → Cancelled by the step 2.1 stop. Conditional on "if proceeding"; the
      ratio decided against.
- [-] Pin the negative case: a diff that touches code **and** a roadmap in the
      same range must still report `stale`. The failure mode of a segmented
      verdict is exactly a code change hiding behind a roadmap edit.
      → Cancelled with 2.2 — it pins a relaxation that is not shipping. Nothing
      about the current verdict changed, so the case it guards cannot arise.

## Phase 3 — Give the evidence a retention shape

- [x] Classify the 28 `review-input/` directories as active (binding current),
      recent, or archived (the reviewed content is merged and the binding is
      historical), and record the tier plus its byte cost per directory.
      *verify:* every one of the 28 carries a tier in the analysis file.
      → § Retention tiers: **30 directories, 3.24 MB** — 29 `archived`, 1 `active`
      (this change's own review). The pass enumerates DIRECTORIES, not artefacts:
      one directory has no committed artefact and was silently skipped until the
      R2 review of this change caught it.
      → **Re-run 2026-08-20 at `1d2f73c40`: 73 directories, 9.01 MB, all
      `archived`.** The 2026-08-15 figures are left above rather than rewritten so
      the growth stays auditable (+43 directories, +5.77 MB in five days). The
      criterion is "every directory carries a tier", which is satisfiable only *as
      of a revision* in a growing tree — so the revision is now named.
- [x] State the regeneration guarantee per tier: for which tiers a stored
      `diff.patch` can be re-derived from the recorded revisions, and for which
      it cannot (a force-push or a rewritten history makes it irreproducible, in
      which case the patch is the only copy and stays).
      *verify:* the analysis names the irreproducible directories explicitly.
      → **11 of 30 re-derived byte-for-byte (1.12 MB); 19 could not (2.12 MB)**,
      each named in § Regeneration guarantee. Reproducibility is ATTEMPTED, not
      asserted: the manifest records no base revision, so the probe reconstructs
      it from the merge commit's first parent and reports what actually
      happened. That bounds the compaction blocker at 34.7 % of the tree.
      → **Re-run 2026-08-20: 24 of 73 re-derived (2.63 MB); 49 could not
      (6.38 MB)**, each named in § Regeneration guarantee. The ceiling *fell* to
      **29.2 %** — the irreproducible share grew faster than the reproducible one,
      which is the direction that argues against compacting, not for it.
- [-] Compact the tiers that are provably reproducible. Blocked behind the
      blocker below — it removes committed evidence, which is a maintainer's
      call, not an agent's.
      → **Cancelled 2026-08-20.** `evidence-compaction-approval` resolved to
      option (a) — no compaction — so there is nothing for this step to do.
      Outcome state: `abandoned`. Nothing was deleted; all 73 `*.review-input/`
      directories stay.
      <!-- decision 2026-08-20: AI council, 2/2 quorum (anthropic + openai),
           recorded in agents/evidence/council/drain-blocker-dispositions-b.md
           (on origin/drain/council-records, not yet on main). Disposition D —
           decide now. Both seats converged on the ACTION ("no compaction") and
           differed only on the LABEL: openai returned `abandoned` and cancels
           this step outright; anthropic returned `narrowed`, keeping the tiering.
           Adopted: action = no compaction, step-3.3 outcome = `abandoned`, and
           the two labels do not conflict because `narrowed` describes Phase 3
           (which keeps 3.1 + 3.2) while `abandoned` describes this step, which
           has no half left once compaction is refused — it reads "compact the
           tiers" and nothing else.
           Reasoning, not just the verdict: (1) the ceiling is 2.63 MB of
           9.01 MB (29.2 %) and FELL from the 34.7 % the blocker quoted, because
           the irreproducible share grew faster; (2) option (b) requires a named
           tier boundary and there is none — all 73 directories are `archived`,
           and the only separating line is a per-directory reachability verdict,
           not a tier; (3) Risk 3 is asymmetric — a force-push turns a
           reproducible directory into the sole copy, and the loss surfaces only
           when someone needs it, so a recoverable 2.63 MB is traded against an
           unrecoverable record. The council's own rationale: "deletion offers
           limited value while creating avoidable evidence and rollback risk."
           What this does NOT decide: the 13 MB growth of agents/evidence is real
           and unaddressed. It is out of scope here, not solved. -->

## Blockers

### blocker: evidence-compaction-approval
- **Status:** resolved — 2026-08-20, option (a): no compaction. Disposition
  **D** (decide now); outcome state for step 3.3 `abandoned`. Decided by AI
  council, 2/2 quorum (anthropic + openai), recorded in
  `agents/evidence/council/drain-blocker-dispositions-b.md` <!-- ref-ignore -->
  (on `origin/drain/council-records`; not on `main` at the time of writing).
  Both seats converged on the action; the openai seat labelled the outcome
  `abandoned`, the anthropic seat `narrowed` with tiering retained. Adopted:
  action = no compaction, step-3.3 outcome = `abandoned`. Dissent recorded, not
  dropped. Rationale and the three supporting findings: § Decision — Phase 3
  compaction: NONE in `agents/evidence/analysis/review-binding-drift.md`.
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Question:** may provably-reproducible `diff.patch` bodies be dropped in
  favour of their recorded base/head revisions? Phase 3 produces the list and
  the proof of reproducibility; the removal itself is a bulk deletion of
  committed evidence and is not an agent's call.
- **Resolved when:** the maintainer records yes with a tier boundary, or no.
  → Satisfied by a recorded **no**. One qualification the field itself asks
  for and does not get: the decider was the AI council under delegated
  authority for this drain run, not the maintainer in person. The field says
  "the maintainer records", so the substitution is named rather than glossed.
  It is the weaker of the two on the axis the field cared about — an agent may
  not delete committed evidence — and the decision taken was the one that
  deletes nothing, so the delegation cannot have licensed the act the blocker
  was guarding against. Had the answer been (b), this substitution would not
  have been sufficient.
- **Blocks:** step 3.3 only. Phases 1 and 2 and the classification in 3.1–3.2
  proceed either way.
- **Evidence now available (Phase 3, 2026-08-15):** the list and the proof the
  blocker was waiting for exist. **30** directories totalling **3.24 MB**, 29 of
  them `archived`. **11** were re-derived byte-for-byte (**1.12 MB**); **19**
  were not (**2.12 MB**) and stay regardless. So option (b) reclaims at most
  **34.7 %** of the tree — and the tier boundary it would need to name is not a
  tier at all, since 29 of 30 sit in the same one. The only line that separates
  them is the per-directory re-derivation verdict in
  `agents/evidence/analysis/review-binding-drift.md`.
- **Correction (2026-08-17) — the list above is no longer decision-ready, and
  that is the part a maintainer needs before answering.** The tree now holds
  **38** directories, so the 30 Phase 3 classified cover **79 %** of it; eight
  are unclassified and carry no reproducibility verdict. Choosing option (b)
  against this list today would either skip those eight or act on them
  unverified — neither is what the option says. The percentage it quotes moves
  too: at most 34.7 % of *the 30*, and an unknown share of the eight. Re-run the
  Phase 3 probe before the decision is taken, not after; the decision itself is
  unchanged and still the maintainer's.
- **What to do:** pick exactly one — (a) no compaction: the tiering and the
  reproducibility verdict are the whole deliverable, and step 3.3 is marked
  `[-]` cancelled; or (b) compact at a named tier boundary, dropping only
  directories Phase 3 proved reproducible and leaving every irreproducible one
  intact. Mutually exclusive. (b) requires the boundary to be stated in this
  blocker, not chosen at execution time.
- **Chosen:** **(a)** — verbatim from the option set above, so the recorded
  decision and the offered option are the same text. Step 3.3 is `[-]`; the
  tiering (3.1) and the reproducibility verdict (3.2) stand as the deliverable.
  Option (b) was not merely declined for want of authority: the pre-decision
  re-run the correction above demanded was performed at `1d2f73c40`, and it
  showed the reclaimable ceiling *falling* to 29.2 % and no tier boundary
  existing to name — (b) is unstateable on this evidence, not just unapproved.
- **Re-run performed (2026-08-20), as the correction required:**
  `./scripts-run src/scripts/probe_review_binding_drift --write` at
  `1d2f73c40` → **73** directories, **9.01 MB**, all `archived`; **24**
  re-derived byte-for-byte (**2.63 MB**), **49** not (**6.38 MB**). So the
  decision was taken against a complete list, not the 30-of-38 the correction
  warned about — and the tree had grown again to 73 by then, which is itself the
  reason the correction was right to insist.

## Acceptance criteria

- [x] The per-binding segment-drift table exists and states the
      code-vs-non-code ratio.
- [x] Phase 2 carries an explicit proceed or stop decision citing that ratio.
- [-] If Phase 2 proceeded: a test asserts that a code change accompanied by a
      roadmap edit still reports `stale`.
      → Conditional on a proceed; Phase 2 stopped.
- [x] Every `review-input/` directory carries a retention tier and a
      reproducible-or-not verdict.
      → Satisfied **as of `1d2f73c40` (2026-08-20)**: all **73** directories on
      disk carry both, in § Retention tiers and § Regeneration guarantee of
      `agents/evidence/analysis/review-binding-drift.md`. The revision matters —
      this criterion is written as a universal over a set that grows with every
      review, so it is satisfiable only at a named revision and lapses the next
      time a review lands. It was in fact lapsed when this roadmap was closed
      (30 of 38 classified per the 2026-08-17 correction, then 30 of 73), and
      re-running the probe is what restored it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->
Re-reviewed at closure (2026-08-20), row by row, against what actually shipped —
not restamped. Two rows record a risk that never had a chance to fire because the
work they guarded was refused; one row was factually wrong about step 3.3's
glyph and is corrected; one row records a risk that MATERIALISED and was absorbed
by its own mitigation.
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A segment-aware verdict becomes an escape hatch | product | The whole value of the binding is that it notices when the reviewed content moved; a verdict that forgives one segment is one careless predicate away from forgiving a code change that rode along with a roadmap edit | **Did not fire — the relaxation never landed.** Phase 2 stopped at step 2.1, so no segment-aware verdict exists to be an escape hatch and the currency verdict is byte-identical to before this plan. Step 2.3's mixed-case failing test is therefore unwritten and stays the required precondition for any reopening: it is a debt this plan is handing forward, not a control it satisfied | Phase 2 — Make the verdict segment-aware, only if Phase 1 earns it |
| 2 | The mechanism is real and the incidence is nil | implementation | The roadmap-inside-scope mechanism is verified from source, but "verified mechanism" and "this is what has been costing us" are different claims, and building on the first while assuming the second is the premise error this package has recorded repeatedly | **MATERIALISED, and the mitigation absorbed it.** The mechanism is real (roadmaps are still inside the scope) and the incidence is low, not nil: 7.0 % of 199 re-bind events would have been prevented. Phase 1 measured before any code moved and step 2.1's pre-registered stop made the refusal a recorded outcome, so the premise error cost one probe and one analysis file instead of a change to an integrity gate | Phase 1 — Measure which segment actually moves |
| 3 | Compaction destroys the only copy | implementation | A patch is reproducible only while both recorded revisions remain reachable; a force-push or a pruned branch silently converts a reproducible directory into the sole record, and the loss is discovered when someone needs it | **Closed without exposure — nothing was dropped.** 3.2 named all 49 irreproducible directories first, and 3.3 is `[-]` cancelled (option (a), council 2026-08-20), so no patch was deleted and the reachability hazard was never taken on. The glyph in this cell previously read `[~]`, which was never true: the step was `[ ]` open-and-blocked and is now `[-]`. The hazard itself is unchanged for any future plan that reopens compaction | Phase 3 — Give the evidence a retention shape |
| 4 | Excluding roadmaps from the scope diff is chosen as the shortcut | implementation | The cheapest fix is adding `agents/roadmaps` to the exclusion list, which also hides genuine roadmap changes from every review that should have read them | **Held — the shortcut was not taken.** `REVIEW_SCOPE_EXCLUDES` is still its original two entries; no roadmap path was added. The measurement did surface a narrower, different question the plan never asked: the *generated* dashboard `agents/roadmaps-progress.md` appears in 7 of the 16 non-code re-binds, and excluding a generated artefact is not the same act as excluding authored roadmap content. It is recorded in the analysis file and deliberately left unanswered here | Context |
