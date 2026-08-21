---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to merge-hotspot drawdown — the guards before the cutover

> **Source:** maintainer inbox handover `agents/tmp.old/merge-conflicts` (the
> question: *can we gitignore the three files we keep conflicting on?*), plus a
> live re-measurement that widened the finding from three paths to six, plus an
> AI-council pass (2 seats + blind peer review, $0.13, 2026-08-21) recorded at
> § Council verdict. Every number below was measured on `origin/main` at pinned
> commit `f39f14258c77b2aa617f1ea7b75ae7deba3b3a75`. Nothing is carried from memory.

## Goal

`sync_pr_branch` tells the truth about every path that actually conflicts in
this repo, the archive-index pair cannot be committed half-regenerated, the
generation cadence behind the #1 hotspot is measured rather than assumed, and
the two decisions the council refused to greenlight — union-merged ratchets and
an unguarded dashboard untrack — are recorded with their preconditions so a
later "just gitignore it" cannot land without them. The dashboard cutover
itself is NOT in this roadmap; its prerequisites are.

## § 0 Defect

**D1 — the conflict population was measured on one branch, and it is wider than
that.** The handover names three hotspot paths, observed on a single branch.
Measured across **all 7 of the 11 open PRs that are `mergeable: CONFLICTING`**
(`git merge-tree --write-tree origin/main origin/<branch>`, 2026-08-21), six
paths conflict, with the count of the 7 PRs each appears in:

| Path | PRs | Generated? | In `sync_pr_branch` GENERATED? |
|---|---|---|---|
| `agents/roadmaps-progress.md` | 7/7 | yes | yes |
| `agents/roadmaps/stubs/README.md` | 7/7 | no — authored | n/a |
| `src/config/estate-count-budget.json` | 7/7 | measured baseline | **no** |
| `src/config/gate-violation-baselines.json` | 7/7 | measured baseline | **no** |
| `agents/roadmaps/archive/INDEX.md` | 2/7 | yes | **no** |
| `agents/roadmaps/archive/index.json` | 2/7 | yes | **no** |

**D2 — `sync_pr_branch` calls two generated files authored.** `build_archive_index.ts`
writes `agents/roadmaps/archive/{INDEX.md,index.json}` (`:409–410`, both in one
call). The `GENERATED` array (`sync_pr_branch.ts:36–50`) does not list either,
so `classifyConflicts` (`:85`) routes them to `authored` and the tool tells the
reader to make a human decision about a file whose only correct resolution is
`task`-regenerate. That array already carries a comment recording this exact
defect once before, for `src/scripts/hook_manifest.json`: *"One session resolved
this same conflict three times and named it structural."* Same failure, two
more paths, 47 commits/60d each.

**D3 — the two ratchet baselines have no classification at all.**
`src/config/estate-count-budget.json` (93 commits/60d, `baseline_history` now
**71** entries) and `src/config/gate-violation-baselines.json` (55 commits/60d,
11 keyed gate entries, read via `gate_baseline.ts:42` `BASELINE_REL` by ~20 gate
scripts) both conflict in 7/7. Neither is gitignorable — untracking a baseline
deletes the ratchet, because the whole mechanism is a committed number a PR diff
can be compared against (`check_estate_count.test.ts`; `consistency.yml`). And
neither is `GENERATED`: a baseline conflict is not "regenerate", it is
"re-measure on the merged tree", which is a third class the tool does not have.
The consequence today is that the reader is offered a hand-merge of two
measurements — pick-a-side on a number, which is how a ratchet silently loosens.

**D4 — the cadence behind the #1 hotspot is unexplained.**
`agents/roadmaps-progress.md` was touched by **1030** commits in 60 days —
~17/day — against ~303 for the next path,
`internal/.condensation-hashes.json`. **Correction (post-review): that file is
DELETED, not untracked** — `23f189a58` dropped the hash cache entirely
(`feat(condense): read staleness off the projection`), it is in no `.gitignore`,
and no generator writes it. Its zero conflicts come from the mechanism being
removed, not from untracking, so it is **not** an in-repo precedent for the
untrack answer and must not be cited as one. Its churn number does not reproduce
either (301 on a relative window, 306-307 on absolute bounds). Nothing in the
handover asks *why* 17/day; it goes straight to merge strategy. A cadence that
high may itself be the defect, and a merge strategy chosen before measuring it
is a fix aimed at a symptom.

**D6 — the untrack has a named repo-side blocker, measured not assumed.**
Probed 2026-08-21 by classifying all 15 code references to the dashboard path as
READS_ON_DISK / GENERATES / PROSE_ONLY / READS_BUT_TOLERANT. Fourteen are safe:
prose, help text, exclusion sets scoped to `agents/roadmaps/` (which the
dashboard sits *outside*, so those exclusions never fire against the real file),
or existence checks guarded by sibling OR-markers. One is not.
`update_roadmap_progress.ts:1337` in `--check` mode reads the on-disk file and
compares it byte-wise against a fresh render; an absent file yields `current = ''`,
which differs from any non-empty render, so `--check` reports **stale and exits 1**
the moment CI checks out a commit where the file is not in git — even though the
generator still writes it locally. That path is reached from `taskfiles/content.yml`
(`roadmap-progress-check`), from the shipped pre-commit hook template, and from the
consumer workflow template. Inbound links are a non-issue by comparison: of 221
tracked-markdown mentions, exactly **one** is a real link into the dashboard
(`agents/roadmaps/archive/step-12-closure-report.md:70`). So the untrack is not a
`git rm --cached` plus a gitignore line; it is that plus a semantics change to
`--check`. Recorded here, carried into 4.2, not done in this roadmap.

**D7 — the consumer-rollout plan rests on a precedent that does not exist.**
The handover's consumer phase reasons from a shipped precedent: the canonical
gitignore block's own header says the Phase-5 migration *"unstages them on first
migrate run"*, so extending the block plus reusing that unstage would carry the
policy into every consumer repo. Probed 2026-08-21: **nothing unstages anything.**
`cmd_migrate.ts` refreshes the block (`_update_gitignore`, `:619-647`) and
performs no git index operation of any kind; no executable path in the repo runs
`git rm --cached` — `check_tracked_but_ignored.ts:80` and
`check_no_local_settings_committed.ts:85` only *print* the command, and
`/sync-gitignore:fix` states outright that git-ops are user-owned and must not be
run automatically. So the claim is false, and the plan built on it was not an
extension of shipped machinery but a new mechanism plus a deliberate reversal of
that design. Corrected in 2.2. Two smaller findings from the same probe, carried
into 4.2: adding the entry to `src/config/gitignore-block.txt` *is* sufficient to
reach consumers (`install.sh:1280` on any non-`--global` install, and
`cmd_refresh.ts:307` for `refresh --project`, which `init --project` aliases to
via `initRouting.ts:125-129`) — but `refresh --global` shells `install --global`,
which sets `SKIP_SYNC=true` (`install:181`) and therefore syncs no gitignore at
all.

**D5 — two decisions were about to ship without their semantics.** The handover
proposes `merge=union` on ratchet history and an untrack-then-roll-out-to-consumers
cutover. The council blocked both, unanimously, and the reasons are recorded
below because an unrecorded block is one a later change walks straight through.

## Council verdict (2026-08-21, 2 seats, blind peer review, $0.13)

Convergent, both seats:

1. **Absorb all six measured paths.** A path in 7/7 conflicting PRs cannot be
   deferred to a follow-up.
2. **Classify the archive pair `GENERATED` now, keep both tracked** pending a
   reader audit — and *do not* count the classification as conflict reduction.
   It improves the resolution advice; it does not lower GitHub's
   `CONFLICTING` count.
3. **Block `merge=union` for any ratchet history.** Verbatim: it *"converts a
   visible Git conflict into a potentially silent application-level conflict."*
   Two branches appending a same-date entry with different counts union-merge
   into two contradictory records, and the draft specified no identity, no
   reduction, no duplicate detection and no monotonicity guarantee. Where
   append-safety is wanted, the answer is **one file per record** (filename
   collision = content identity, the precedent `.gitattributes:62–66` already
   uses for memory YAML), not a line-based driver.
4. **Cut the stubs-README restructure as an implementation phase**, and do not
   put a union driver on authored prose. Re-measure after the dashboard cutover:
   the dashboard co-conflicts in the same merges and inflates today's number.
5. **Cut the one-sentence docs phase as a phase** — it is a rollout checklist
   item, and phase status falsely implies it blocks something.
6. **Untrack the dashboard only through a guarded cutover.** The guards named
   are, in order: land the `GENERATED` classification with paired regeneration
   and fixture tests; land sync-tool support for an intentional
   tracked→untracked transition; introduce old/new consumer compatibility
   checks. Only then freeze, drain, and cut over — with a named human
   coordinator and a timeline.
7. **`REMEASURED` is an authority escalation, not a label.** "Re-measure
   instead of merge" delegates resolution to a script and its environment, so
   it may only ever *name* the resolution for a human to run; it must not
   auto-resolve.
8. **Every phase needs a rollback trigger.** The draft had none.

Divergent, recorded not resolved: whether the per-gate split of
`gate-violation-baselines.json` is already decided by its keyed-dict structure
(seat 1) or conditional on first proving gate independence and a coherent
measurement epoch (seat 2). Both agree the split is the leading design. This
roadmap ships neither — it ships the block and the precondition, per B2.

**This roadmap delivers council guard 1, plus the two measurements the council
asked for.** Guard 2 (sync-tool support for an intentional tracked→untracked
transition) is **not** delivered and is the open gate. Guard 3 (old/new consumer
compatibility checks) is **not** delivered either: what shipped is a
*measurement* of the propagation path (D7), and the council asked to *introduce*
checks — a measured gap discharges nothing. **Corrected post-review:** an earlier
version of this line claimed "guards 1–3", while the stub simultaneously said
"guard 3 half-discharged" and its own probe section said no version guard exists.
One delivered guard, two open. The cutover is out of scope because guard 2 does
not exist and a consumer-CI-breaking change is owner-reserved.

## Phase 1 — Tell the truth about what conflicts

- [x] **1.1 Classify the archive-index pair as GENERATED.** Add
      `agents/roadmaps/archive/INDEX.md` and `agents/roadmaps/archive/index.json`
      to `GENERATED` in `sync_pr_branch.ts`, with a comment naming
      `build_archive_index.ts` as the writer and this roadmap as provenance.
      Not already the case: both are written by one generator call and both
      currently classify as `authored`.
      verify: `isGenerated('agents/roadmaps/archive/INDEX.md')` and
      `isGenerated('agents/roadmaps/archive/index.json')` both return true in
      `tests/scripts/sync_pr_branch.test.ts`, and a `classifyConflicts` case
      asserts both land in `generated` and not in `authored`.
- [x] **1.2 Add a REMEASURED class for the two ratchet baselines.** A third
      classification beside `GENERATED` and authored, carrying
      `src/config/estate-count-budget.json` and
      `src/config/gate-violation-baselines.json`. Its message says *re-run the
      measurement on the merged tree and record the result* — never
      hand-merge, never pick a side, and never auto-resolved by this tool
      (council point 7: the tool names the resolution, a human runs it).
      verify: a `classifyConflicts` test asserts each of the two paths lands in
      `remeasured` and in neither of the other two buckets; a second test
      asserts the emitted message for a remeasured conflict contains the
      re-measure instruction and does not contain the read-both-sides advice
      that authored conflicts get.
- [x] **1.3 Keep the classification honest about what it buys.** One sentence in
      the `sync_pr_branch.ts` header: classification changes the advice, not the
      conflict — a path stays a hotspot by frequency while becoming mechanical
      to resolve (council point 2).
      verify: the sentence exists in the file header and names this roadmap.

## Phase 2 — Correct two claims that are not true

- [x] **2.1 The archive-pair atomicity gate the council asked for already exists
      — record that instead of building it.** Council point: CI should reject a
      commit regenerating only one of `agents/roadmaps/archive/{INDEX.md,index.json}`.
      Probe before building: `build_archive_index.ts:392-401` regenerates both in
      memory and byte-compares each against the committed artefact, naming
      whichever drifted; the task is wired at `taskfiles/content.yml:132-135` and
      runs in CI at `.github/workflows/consistency.yml:160`. A half-regenerated
      commit is stale on its un-regenerated half the moment CI checks it out.
      **Honest null, pre-registered by the probe-before-building order:** the
      invariant holds and a second gate would be a duplicate. Record the probe
      with its failing direction; build nothing.
      verify: the evidence file carries the command and the observed red
      (`archive index out of date (agents/roadmaps/archive/index.json)`) produced
      by making exactly one side stale, plus the two registration file:lines. No
      new script is added.
- [x] **2.2 Correct the false unstage claim in the canonical gitignore block.**
      `src/config/gitignore-block.txt`'s header asserts the Phase-5 migration
      unstages the paths it lists. Nothing does (D7). Replace the claim with what
      is actually true — an entry here ignores a path going forward and leaves an
      already-committed file tracked — and state why the correction matters: a
      consumer-rollout plan was reasoning from it as precedent.
      verify: `grep -c "unstages them on first migrate run" src/config/gitignore-block.txt`
      returns 0, the replacement names `cmd_migrate.ts`'s actual behaviour with
      file:line, and this roadmap is cited as provenance.

## Phase 3 — Measure the cadence before anyone designs against it

- [x] **3.1 Attribute the dashboard's 1030 commits/60d.** For
      `agents/roadmaps-progress.md`, classify the commits touching it by author
      shape: standalone regeneration commits vs. commits where it rides along
      with unrelated work vs. merge commits. Pre-registered expectation: the
      ride-along class dominates, i.e. the cadence is a by-product of the
      per-step flip cadence rather than 17 genuine dashboard events per day.
      **Honest null:** if standalone regenerations dominate, the cadence is real
      and cannot be reduced — publish that and close the phase; it removes
      "reduce the cadence" from the cutover's option set.
      verify: the measurement lands under `agents/evidence/` with the exact
      commands, the three counts, and a one-line verdict either way.
- [x] **3.2 Attribute the estate-budget conflict anatomy. THE HONEST NULL
      FIRED.** Over the same window, classify commits touching
      `src/config/estate-count-budget.json` as `baseline_history` append vs.
      `baseline` walk vs. both. Pre-registered expectation: appends dominate (71
      history entries against a handful of baseline moves). Pre-registered honest
      null: if baseline moves dominate, an append-safety split buys little and
      the REMEASURED class from 1.2 is the whole available fix.
      **Result: baseline moves dominate — 39 of 43 commits move the baseline, and
      exactly 1 in 60 days is a pure append.** So the null is the outcome, and
      `REMEASURED` is the whole fix on this file rather than an interim step.
      **The first published number (40 of 43 pure appends) was WRONG** and was
      caught by an independent reviewer, not by me: the method classified `-U0`
      hunks by regex, and the `baseline` object uses the same key names as a
      history entry, so a pure baseline walk matched the entry-line pattern. The
      tell was in the output — `structure keys only: 0`, a cell that cannot be
      non-zero — and it shipped unquestioned into an ADR premise and a PR body.
      verify: the evidence file carries the corrected JSON-parse method, the five
      per-class counts, the defect mechanism, and the single worked example
      commit (`e79f0450e`, a pure baseline walk counted as an append).

## Phase 4 — Record what the council refused

- [x] **4.1 Record the union-merge block as a durable decision.** An ADR stating
      that `merge=union` is not available for any ratchet history in this repo,
      with the council's failure case (same-date contradictory records) and the
      six preconditions that would reopen it: stable globally unique record
      identity, immutable-record semantics, deterministic order-independent
      reduction, rejection of duplicate/contradictory identities, proof no
      consumer depends on file order or last-record-wins, and CI validation that
      a clean textual merge cannot weaken the effective baseline. Name the
      per-record-file alternative and its `.gitattributes:62–66` precedent.
      verify: the ADR exists, is numbered by the `adr-create` path, appears in
      the regenerated index, and `grep` finds the six preconditions in it.
- [x] **4.2 Stub the cutover, do not start it.** A stub under
      `agents/roadmaps/stubs/` for the dashboard untrack plus consumer rollout,
      carrying: the three council guards in order, the version-skew matrix
      (new-canonical × old-consumer is the kill zone — a consumer pulling the
      new gitignore while running the old `roadmap-progress-check.yml` goes
      permanently red), the `git rm --cached` requirement that a gitignore
      entry alone does not satisfy, and the reason it is not in this roadmap:
      guard 3 does not exist, and breaking consumer CI is owner-reserved.
      A stub is the documented promotion path and is not counted as estate.
      verify: the stub file exists, is listed in
      `agents/roadmaps/stubs/README.md`, and names guards 1–3 with this
      roadmap as the record of which of them Phase 1–2 discharged.
- [x] **4.3 The sync-first sentence, as a checklist item not a phase.** In
      `/create-pr` § 1b-ii and the conflict-facing docs page: on
      `CONFLICTING`, run the sync task before touching the GitHub web editor —
      the web editor cannot tell generated from authored, which is the exact
      failure path the handover observed. Council point 5: this is a checklist
      line, and its adoption is not measurable without telemetry this repo has
      ruled out.
      verify: the sentence exists at both locations and names this roadmap;
      the AC does not claim behavioural adoption.

## Rollback triggers, per phase

Council point 8 asked for one per phase. An earlier version of this roadmap
recorded the point and shipped none, which is the failure the point names.

- **Phase 1 (classification).** Revert the `REMEASURED` class if the tool is ever
  observed *performing* a measurement rather than naming it, or if a path lands
  in two arrays — `isGenerated` wins the routing, so a duplicate would silently
  hand a baseline a `git checkout --ours` instruction. Revert the archive-pair
  entry if `build_archive_index` stops writing both files in one call.
- **Phase 2 (corrections).** Nothing to roll back: a probe that built nothing,
  and a header sentence replaced by a true one. If the corrected header is read
  as a feature *removal*, the fix is one more sentence, not a revert.
- **Phase 3 (measurements).** A measurement is not revertible; it is
  **falsifiable**. Both are superseded the moment someone re-runs the published
  commands and gets different counts — which already happened to 3.2, and the
  corrected entry carries the mechanism that hid it.
- **Phase 4 (records).** Reopen ADR-239 only on the six preconditions it names,
  never on the conflicts having got worse. Promote or delete the cutover stub if
  its four probes stop being measurable — a stub whose probes cannot be run is
  the burial its own risk row names.

## Blockers

None. Every step above is agent-executable on this checkout; the two decisions
that are not (the cutover, and the per-gate baseline split the council left
divergent) are recorded as 4.1/4.2 artefacts rather than as open blockers,
because a blocker here would keep this roadmap open on work nobody is doing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | REMEASURED is read as auto-resolve | implementation | A later change makes the tool run the re-measurement itself; a wrong or environment-dependent measurement then overwrites a deliberate ratchet tightening and nothing objects, because the number looks measured either way | 1.2 asserts the message names the resolution and the tool never performs it; the council's authority-escalation finding is quoted at the code | Phase 1 — Tell the truth about what conflicts |
| 2 | Classification is banked as drawdown | product | The archive pair is classified, the conflict count does not move, and a later reader concludes the hotspot work failed — or worse, that it succeeded | 1.3 states the distinction in the file header; § 0 D2 and council point 2 state it twice more | Phase 1 — Tell the truth about what conflicts |
| 3 | The cutover stub is a burial | product | 4.2 records the untrack and nobody ever runs it, so the maintainer's actual question stays unanswered while a roadmap archives as complete | The stub carries the three guards with 1–2 marked discharged, so the remaining work is one named guard plus a human cutover, not a re-analysis | Phase 4 — Record what the council refused |
| 4 | The corrected header reads as a feature removal | implementation | 2.2 deletes a sentence describing behaviour, and a reader concludes the unstage was removed rather than that it never existed | The replacement states the probe result with file:line and names what would have to be built, so absence is distinguishable from regression | Phase 2 — Correct two claims that are not true |
| 5 | Phase 3 measures and nothing consumes it | implementation | Both cadence measurements land as evidence and no decision changes, making them cost without leverage | Both carry a pre-registered honest null that removes a named option from the cutover's option set either way, so both outcomes feed 4.2 | Phase 3 — Measure the cadence before anyone designs against it |

## Acceptance Criteria

- [x] **AC-1** — `sync_pr_branch` classifies every one of the six measured
      conflicting paths, and the classification is asserted in tests: three
      `GENERATED` (dashboard, archive INDEX.md, archive index.json), two
      `REMEASURED` (both baseline files), one authored (stubs README).
      **The `authored` row is a tautology and is marked as one:**
      `classifyConflicts` uses `authored` as its `else` branch, so every
      non-empty string lands somewhere and "absent from all three buckets" is
      unreachable by construction. The falsifiable half is the five non-default
      rows.
- [x] **AC-2** — the archive-pair atomicity invariant is shown to be already
      enforced, with the observed red from a one-sided-staleness probe and the
      two registration file:lines recorded, and **no** new gate is added for it;
      and `src/config/gitignore-block.txt` no longer claims an unstage that no
      code performs.
- [x] **AC-3** — both Phase 3 measurements exist under `agents/evidence/` with
      their commands, their counts and a verdict, and each states which option it
      removed from the cutover's option set. 3.1 removed "throttle the
      generation"; 3.2, after correction, removed "split the history for
      append-safety" — its honest null fired, and the entry carries the method
      defect that first hid it.
- [x] **AC-4** — the union-merge block is an ADR carrying all six reopening
      preconditions, and the cutover stub names council guards 1–3 with the two
      this roadmap discharged marked as such. Neither claims the cutover
      happened.
- [x] **AC-5** — this roadmap archives in the same change that creates it, so
      the estate carries no net addition (precedent: the net-zero
      `baseline_history` entry for road-to-agent-velocity).
