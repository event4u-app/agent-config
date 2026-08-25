---
complexity: structural
status: draft
estate_offset_exempt: "Carried into the /analyze:inbox branch of 2026-08-24 from an uncommitted staged file in the main checkout, where it would otherwise have been stranded. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived only status: draft roadmaps, which were never counted and cannot serve as offsets. Stays status: draft, so it charges no gated metric."
execution:
  mode: phase-checkpoints
---
# Road to merge surface zero

> **Source:** maintainer session 2026-08-24 (*"warum haben alle PRs CI-Probleme
> & Mergekonflikte?"*), then a full re-measurement of the **actual** open-PR set
> via the GitHub API plus `git merge-tree --write-tree` against
> `origin/main = d6238520f`. Every number below names the command that produced
> it.
>
> **Two corrections to the session's first diagnosis, both maintainer-flagged
> and both confirmed by measurement.** They are recorded rather than quietly
> fixed, because the second one invalidated an entire proposed phase:
>
> 1. **There is no zombie tail.** The first pass inferred the open-PR set from
>    `refs/pull/*/head` SHAs matched against surviving `refs/heads/*` (the API
>    was rate-limited) and reported **18 open PRs, 12 of them 500–10 294 commits
>    behind**. `gh pr list --state open` reports **6 open PRs, all created
>    2026-08-23, all `base: main`, none older than one day.** The twelve
>    "zombies" were *closed or merged* PRs whose pull refs still exist. A
>    proposed phase to revive them by merging `main` in — and, before the
>    maintainer's objection, one to close them — both addressed an empty
>    population.
> 2. **Two of the six are not a merge-surface problem at all.** PRs #1598 and
>    #1596 are `behind=0` and merge **CLEAN**; they are red on tests. Attributing
>    them to this roadmap's mechanism would have been wrong.
>
> Prior art this builds on, not repeats:
> `agents/roadmaps/archive/road-to-merge-hotspot-drawdown.md` and
> `agents/roadmaps/archive/road-to-generated-artifact-conflict-drawdown.md`.
> Their path-scoped fixes held **on the paths they named** — the `GENERATED` and
> `REMEASURED` classes exist in `src/scripts/sync_pr_branch.ts:41–120`. This
> roadmap exists because the same *mechanism* re-manifested on a **new path
> population**, which falsifies path-by-path as the unit of fix.

## Goal

A correct PR cannot go red or conflicted because someone else merged first.
Concretely: repo-global regenerated state (pack manifests, reports, derived
docs) is no longer carried in PR diffs but written once on `main` after merge;
ratchet baselines advance only on `main` and are read from the merge-base side,
so a stale-but-correct PR still passes; and the drain opens work against fresh
`main` instead of in same-base batches. Measured success is a conflict-rate drop
against the § 0 baseline (Phase 5), not an impression.

## § 0 — Measured state

`gh pr list --state open --limit 100`, then per PR
`git merge-tree --write-tree --name-only origin/main origin/<branch>`:

| PR | behind | ahead | API verdict | merge-tree |
|---|---|---|---|---|
| #1605 trigger-delivered-rule-bodies | 114 | 17 | CONFLICTING | 9 conflicts |
| #1604 deterministic-time-in-gates | 114 | 14 | CONFLICTING | 9 conflicts |
| #1601 frontend-fidelity-calibration | 107 | 8 | CONFLICTING | 4 conflicts |
| #1600 skill-delivery-over-mcp | 107 | 17 | CONFLICTING | 9 conflicts |
| #1598 chained-clip-continuity | **0** | 19 | MERGEABLE / UNSTABLE | **CLEAN** |
| #1596 standing-payload-diet | **0** | 12 | MERGEABLE / BLOCKED | **CLEAN** |

**D1 — the conflicting population is repo-global regenerated state, and three of
its members are unclassified.** Conflict frequency across the four conflicting
PRs, with the writer verified from each file's own header or generator:

| Path | PRs | Writer | In `sync_pr_branch` classes? |
|---|---|---|---|
| `agents/reports/originality.json` + `.md` | 3 | `src/scripts/lint_originality.ts` | **no** |
| `docs/proof.md` | 3 | `build_proof.ts` (header: *GENERATED … do NOT hand-edit*) | **no** |
| `internal/reports/exec-evidence-feasibility.json` | 3 | `check_claims.ts` | **no** |
| `src/domains/meta/pack.yaml` | 3 | `generate_pack_manifests.ts` (header: *DO NOT EDIT BY HAND*) | **no** |
| `src/domains/engineering-base/pack.yaml` | 2 | same | **no** |
| `docs/CLAIMS.md` | 2 | authored **append ledger** | n/a (authored) |
| `src/config/gate-violation-baselines.json` | 2 | ratchet baseline | yes — `REMEASURED` |
| `src/scripts/hook_manifest.json` | 1 | `task build-ts` | yes — `GENERATED` |
| `dist/agent-src/rules/ui-audit-gate.md` | 1 | `task sync` | yes — `dist/agent-src/` prefix |

**The `pack.yaml` anatomy was the open question of the first pass, and it is
settled: the conflict is pure aggregate drift.** `git diff` of the two sides
shows `artefact_count: 299` vs `300` and `token_passport.total_tokens: 283807`
vs `285795` — two branches legitimately measuring two trees, plus one appended
skill name (`+ overbuild-review-lens`). Regeneration resolves both halves.
It is not an authored conflict and belongs in Phase 1.

**D2 — main's progress fails stale-but-correct PRs.** The four conflicting PRs
are 107–114 commits behind, i.e. roughly one day at current main velocity. Gates
that turn that into a red state without the PR's diff being wrong:
`task sync-check` (`taskfiles/content.yml`, whole-tree `dist == rewrite(src)`),
`check_estate_count` (`consistency.yml:324`, deliberately no warn-and-allow),
and the freshness/drift checks for originality and proof. **Scope note:** D2 is
*not* the cause for #1598/#1596 — those are `behind=0`. Their reds
(Node Tests shards, `Rule backstops`, `Sync + Generate Tools Consistency`) are
ordinary work and deliberately out of scope here.

**D3 — the drain opens same-base batches.** #1605/#1604 share behind=114;
#1601/#1600 share behind=107 — two batches from two base commits. Given D1, the
first merge of a batch conflicts every sibling by construction. There is no
merge queue: `grep -l merge_group .github/workflows/*.yml` returns nothing, so
GitHub's queue could not run required checks even if enabled.

**D4 — the BASELINE class names the resolution but the gate read-path still
punishes the innocent side.** `sync_pr_branch.ts:89–120` records the council
verdict (2026-08-21, both seats) that a baseline conflict is re-measured by a
human and never auto-merged. That verdict stands and is not reopened here. It
governs *conflict resolution* only: the gate still reads the committed number on
the merge ref, so a PR that never touched a baseline fails when `main` advanced
it.

## Phase 1 — Generated aggregates leave the PR diff

- [x] **1.1 Add the four unclassified generated paths to `sync_pr_branch.ts`.**
      `agents/reports/originality.{json,md}`, `docs/proof.md`,
      `internal/reports/exec-evidence-feasibility.json`, and
      `src/domains/*/pack.yaml` are regenerated, never hand-merged — the tool
      currently routes all four to a human decision. This is advice-only and
      banks no drawdown (the header's own rule), but it stops the wrong
      instruction today.

      **PATH LIST CORRECTED 2026-08-24 by measurement, and the step stays open.**
      `pr_conflict_census` over 60 days (1,843 merges, 533 with a resolution)
      says this list is aimed at the wrong four:

      | named here | measured resolutions |
      |---|---:|
      | `docs/proof.md` | 26 |
      | `src/domains/*/pack.yaml` | 12 |
      | `internal/reports/exec-evidence-feasibility.json` | 3 |
      | `agents/reports/originality.{json,md}` | **0 — appears in neither window** |

      The generated paths that actually conflict, none of them named:
      **`agents/roadmaps-progress.md` 339** · `agents/roadmaps/stubs/README.md`
      61 · `agents/roadmaps/archive/index.json` 60 ·
      `agents/roadmaps/archive/INDEX.md` 59 ·
      `internal/.condensation-hashes.json` 50 · `agents/index.md` 15 ·
      `docs/catalog.md`.

      **`roadmaps-progress.md` needs no classification: it is already fixed.**
      339 resolutions over 60 days, **zero in the last three** — it is untracked
      at `.gitignore:108`. The census measures the before and the after of a
      repair the tree already made, which is the strongest evidence in this
      roadmap that the mechanism is the right target.

      So the remaining work here is the FIVE unfixed generated paths above, not
      the four this step named. Recorded rather than silently re-scoped, because
      one of the four turned out to have never conflicted at all and a reader
      should be able to see that the list moved and why.
      verify: `tests/scripts/sync_pr_branch.test.ts` gains a `classifyConflicts`
      case per path; the four measured § 0 conflict sets classify with zero
      AUTHORED rows among them.

      **DONE 2026-08-25, and two candidates were REFUSED on evidence.** Each
      shipped entry carries its **write site**, because this list tells a human to
      discard one side of a conflict and an entry added on frequency alone would
      tell them to discard hand work:

      | path | write site |
      |---|---|
      | `docs/proof.md` | `build_proof.ts:500` |
      | `docs/skills-catalog.md`, `llms.txt` | `generate_catalog.ts` (`:166`) |
      | `agents/reports/originality.{json,md}` | `lint_originality.ts:340` |
      | `src/domains/*/pack.yaml` | `generate_pack_manifests.ts:427`, and the file's own line 1 reads *"DO NOT EDIT BY HAND"* |

      The pack manifests needed a **named pattern**, not a literal: `isGenerated`
      matches on equality or a trailing-slash prefix, and loosening that matcher
      would make every future entry ambiguous about which kind of match it asks
      for.

      **Refused — `internal/reports/exec-evidence-feasibility.json`**, which THIS
      STEP names. `check_claims.ts:431` **reads** it; only its `backed_claims`
      count is checked mechanically, and the classification inside is a human
      judgment that regeneration would discard.

      **Refused — `agents/roadmaps/stubs/README.md`**, which came from this
      roadmap's own corrected census table, written in an earlier session **on
      conflict count alone** (61 resolutions). It is hand-authored prose, and
      `check_no_stub_inventory_table.ts:79` guards it *against* carrying a
      generated index — the opposite of being generated. Correcting an earlier
      entry of my own rather than carrying it forward.

      Both refusals ship as test cases, because that is the direction which costs
      work: an over-broad classification tells someone to throw away a
      hand-written file.
- [ ] **1.2 Gate PR diffs against touching them.** A PR may not modify the
      Phase-1.1 path set; allowlist is the post-merge bot plus an explicit
      `regen-intended` label. A PR that changes inputs stops carrying the
      re-rendered outputs.
      verify: the gate fails a probe commit that edits `docs/proof.md`, and
      passes the same commit with the label.

      **BLOCKED on 1.3, and the dependency is measured rather than argued.** With
      1.1's classification live, this gate was run against the **last 40 merged
      PRs**: **22 of them — 55 % — touch a generated path and would fail it.**

      | path | PRs of 40 |
      |---|---:|
      | `docs/proof.md` | 13 |
      | `src/domains/meta/pack.yaml` | 9 |
      | `src/domains/engineering-base/pack.yaml` | 9 |
      | `agents/index.md` | 7 |
      | `docs/catalog.md` | 7 |

      The step's allowlist is *"the post-merge bot plus an explicit
      `regen-intended` label"*, and **the post-merge bot does not exist** — 1.3 is
      owner-reserved. So shipping this gate today makes carrying regenerated
      output an error while providing **no other route for that output to reach
      `main`**: every one of those 22 PRs would need the escape label, which
      turns the allowlist into the default and the gate into paperwork.

      This is the ordering the phase numbering hides. 1.2 reads as independent of
      1.3 and is not: it is the *enforcement* half of a mechanism whose *writer*
      half is the owner's to authorise.

      Reproduce the figure:
      `git log --merges --first-parent -40 origin/main`, then
      `git diff --name-only <sha>^1 <sha>` filtered through
      `isGenerated` from `src/scripts/sync_pr_branch.ts`.
- [ ] **1.3 One writer on `main`, post-merge.** A workflow regenerates the set
      after each merge and pushes a single bot commit when output changed.
      Loop guard: the workflow ignores its own commits; idempotence asserted by
      running the generator twice in-job and diffing.
      verify: two consecutive runs on an unchanged tree produce no second
      commit; a run after a merge that shifts `artefact_count` produces exactly
      one.

      **OWNER-RESERVED 2026-08-25, AI council 2/2** — the one point both seats
      reached independently and stated in the same terms. A workflow that pushes
      a commit to `main` is **privileged trunk mutation**, a different risk class
      from everything else in this roadmap, and the maintainer's delegation of
      *sequencing* decisions to the council does not extend to activating it.

      One seat proposed landing it disabled or manual-dispatch-only as
      containment for 3.1; the other refused, and the refusal carried on its own
      argument: **"infrastructure ready" is not containment.** A disabled writer
      closes nothing, and wiring a mechanism that *can* auto-commit to the trunk
      is the step that needs authorisation, not switching it on afterwards.

      An autonomous run may **design and propose** this writer. It may not merge
      it. That is why this step stays open rather than being attempted.
- [ ] **1.4 Move the freshness gates to the writer.** Originality freshness and
      proof drift run on `main` post-merge, where staleness is actionable, and
      leave the PR merge-ref path, where staleness is someone else's merge.
      verify: `gate-coverage.yml` shows both gates on the main-side job and
      absent from the PR job; a deliberately stale tree on `main` still reds.

## Phase 2 — The CLAIMS.md append surface stops appending

- [ ] **2.1 Split to one file per claim.** `docs/claims/<claim-id>.md`; two PRs
      registering different claims stop colliding by construction.
      verify: `docs/CLAIMS.md` is generated from the directory and rides the
      Phase-1.3 writer; `check_claims.ts` reads the directory; the
      `<!-- claim:<id> -->` binding contract is unchanged and its tests pass.
- [ ] **2.2 Add a claim-ID uniqueness gate.** The monolith prevented duplicate
      IDs structurally; a directory must prevent them explicitly.
      verify: the gate fails a probe adding a second file with an existing ID.

## Phase 3 — Baselines advance on main, merge-base judges the PR

- [ ] **3.1 Read the governing baseline from the TARGET commit.** Gate scripts
      reading `gate-violation-baselines.json` resolve it via
      `git show <target-sha>:<path>` instead of the merge-ref working tree, and
      the count is measured on the **prospective merge result**. Pass/fail is
      decided exclusively by that pair.
      verify: the 165 → 160 → 163 case **FAILS**; a resolution failure on the
      ref, the blob or the JSON is a hard error rather than an empty ratchet;
      the merge-base reading survives as a **diagnostic** that names the cause.

      **REWRITTEN 2026-08-25 — the criterion this step used to carry selected
      the losing invariant.** It read *"a PR held deliberately 100 commits behind
      a tightened baseline passes"*, which is the contribution invariant, and B5
      was the contradiction between that and 3.3. AI council 2/2 on **ABS**; the
      rewrite is the unblocking action this step's own text named.

      **The acceptance test is INVERTED rather than deleted**, on both seats'
      insistence: the worked example that killed the merge-base read is now the
      case that must fail, and it is pinned as a test.

      **Landed this change** — `loadBaselinesAt` and `diagnoseRegression` in
      `src/scripts/_lib/gate_baseline.ts`, 11 tests. Three properties, each
      because a seat asked for it by name:

      - the policy is read from the **target**, never from the merge tree, so a
        PR cannot loosen the number it is judged against in the same diff;
      - an unresolvable ref, a missing blob or unparseable JSON is a
        `BaselineResolutionError` — `loadBaselines`'s empty-ratchet-on-missing
        stays correct for a working-tree read and would be a silent policy swap
        here;
      - the merge-base number is kept as a **diagnostic** separating
        `branch-regression` from `main-tightened`, because the remediations
        differ and *"rebase and re-run"* is wrong advice for a PR that genuinely
        reintroduced violations. A test asserts it never returns the exculpatory
        answer when the merge-base reading is missing.

      **STILL OPEN, and it is the larger half:** every gate's read site must move
      onto this reader, and the PR job must measure on `refs/pull/N/merge` with a
      freshness binding so the result that passed is the result that lands. Both
      seats named that binding as essential and neither treated the synthetic
      merge alone as sufficient.

      **The contradiction that produced B5, kept for the record.** These two
      acceptance criteria selected **different contracts** and no implementation
      order reconciled them; the resolution above picks one and rewrites the
      loser.

      Worked example, from the numbers this repository actually carries. main
      tightens `ci-parity:local-only` 165 → 160. A PR that branched earlier
      measures 163. The merge-base read returns 165, so it **passes** — and after
      it merges, main measures 163 against a baseline of 160. **A tightening is
      undone by a PR that never touched the baseline file and never saw a red.**
      That is exactly what 3.3 forbids.

      The two contracts, named so the next reader picks one rather than
      re-deriving the conflict:

      - **Absolute invariant** — no merge may leave `main` above its current
        baseline. 3.3 selects this.
      - **Contribution invariant** — a PR passes if it did not worsen its own
        merge-base state, even when the merge result undoes improvements made
        since it branched. **This step's verify sentence selects this.**

      One seat proposed satisfying both by checking the PR delta against
      merge-base AND the absolute count against main's current baseline, with no
      new infrastructure. The other refused on a correctness ground rather than a
      preference: **violation counts are not necessarily compositional.** Conflict
      resolution, file movement, generated outputs and interactions with changes
      on `main` can make the prospective merge regress even when the isolated PR
      delta is non-positive. If trunk health is the invariant, the **merge result**
      is what has to be measured — not the branch.

      Also recorded, because it is a third thing "post-merge enforcement"
      currently blurs: *prevention before merge*, *detection after merge*, and
      *baseline maintenance after a successful tightening* are three different
      jobs, and only the first protects an uninterrupted trunk invariant. A
      post-merge job that pushes a baseline commit may **normalise** a regression
      rather than prevent it.

      **Unblocked 2026-08-25:** the roadmap picked ABS and this step's "100
      commits behind passes" is gone, replaced by validating the prospective
      merge result. The operational cost is real and was named rather than
      waved away — a tightening on `main` can invalidate an otherwise unchanged
      PR — and it is not NEW work: Phase 4.1 already requires a rebase onto
      fresh `origin/main` before opening, so this makes the pre-merge gate
      enforce what the roadmap already asks for at merge time.

      **Unanimous, and applies to whichever contract wins:** a failed merge-base,
      target-ref or baseline-blob resolution is a **hard error**. `loadBaselines`
      today returns an empty ratchet on a read failure, so a silent working-tree
      fallback would change the governing policy depending on an infrastructure
      error, invisibly.
- [ ] **3.2 Rebaseline on `main` only, and gate PRs against editing it.**
      Tightening lands in the post-merge job; the file leaves the pairwise
      conflict surface entirely. This is neither the union merge the council
      refused nor re-measurement inside the conflict tool — there is no conflict
      left to resolve.
      verify: the § 0 conflict set for `gate-violation-baselines.json` is empty
      on a re-measurement of the same four branches after the gate lands.
- [ ] **3.3 Prove the ratchet did not loosen.** A test asserts a deliberate
      tightening on `main` still fails a PR that regresses past it.
      verify: the test fails when the Phase-3.1 read is pointed back at the
      merge-ref tree — i.e. it has been seen red against the change it guards.

      **UNBLOCKED 2026-08-25 — this criterion WON.** It selects the absolute
      invariant, which the council picked 2/2; 3.1's conflicting sentence was
      rewritten rather than this one. Nothing here changes.

      The asymmetry below still holds and is now the whole remaining task: this
      can only be demonstrated on a **prospective merge result**, so the test
      that satisfies it needs the PR job 3.1 leaves open, not just the reader
      3.1 landed.

      Note the asymmetry that makes this the harder half to satisfy: 3.1 can be
      demonstrated on a branch, while this can only be demonstrated on a
      **prospective merge result** — the state where the loosening actually
      appears.

## Phase 4 — The drain serializes

- [ ] **4.1 Rebase onto fresh `origin/main` immediately before opening a PR,
      and cap concurrent drain PRs at 2.** With Phases 1–3 landed, same-base
      siblings no longer share writable global files, so this alone should carry
      the conflict rate under the Phase-5 threshold.
      verify: over the Phase-5 window, no two open drain PRs share a
      behind-count, and none exceeds 24 h of base drift at open time.

## Phase 5 — Verification window

- [ ] **5.1 Run 20 drain PRs and publish the thresholds, hit or miss.**
      **T1:** ≤ 3 of 20 conflict against `main` at merge time (baseline: 4 of 6,
      and 4 of 4 among PRs with behind > 0). **T2:** zero PRs fail
      `sync-check`, the estate ratchet, or a freshness gate without their diff
      touching the gated surface (baseline: all four conflicting PRs).
      verify: `src/scripts/pr_conflict_census.ts` lands as the § 0 measurement
      made repeatable, and its output for the window is committed next to this
      roadmap. A miss is published as a miss.

## Blockers

- **B1 — `dist/` untrack.** `dist/` is tracked at 14 MB and is the single
  largest merge surface in the repository, but untracking it changes the
  delivery path (the install one-liner, `dist/install/install.mjs`, the publish
  prepack chain, `ci-gate-dist-install-freshness`). **Blocks:** a measured
  inventory of every consumer reading `dist/` from the git tree rather than from
  the npm artifact. Until that exists, `dist/` stays tracked and the Phase-1.3
  writer explicitly excludes it. Status: open.
- **B2 — GitHub merge queue.** **Blocks:** `merge_group` triggers wired into
  every required workflow (currently zero across the workflow set) plus measured
  per-PR CI wall-time to size throughput. An unmeasured queue on a multi-shard
  pipeline can lengthen the backlog rather than shorten it. Status: open.
- **B4 — the post-merge writer is owner-reserved, and five steps depend on it.**
  AI council 2/2 (2026-08-25): a workflow that pushes a commit to `main` is
  privileged trunk mutation, a different risk class from the rest of this
  roadmap, and a delegation of *sequencing* decisions does not extend to
  activating it. One seat proposed landing it disabled as containment; the other
  refused because **"infrastructure ready" is not containment** — wiring a
  mechanism that *can* auto-commit to the trunk is the step needing
  authorisation, not switching it on afterwards. **Blocks:** 1.2 (measured: 55 %
  of the last 40 merged PRs would fail its gate with no other route for the
  output), 1.3 itself, 1.4, and 2.1's "rides the Phase-1.3 writer" clause. An
  autonomous run may design and propose the writer; it may not merge it.
  Status: open.
- **B5 — 3.1 and 3.3 select contradictory invariants. RESOLVED 2026-08-25:
  the ABSOLUTE invariant wins; 3.1's criterion was rewritten.** AI council 2/2,
  a second round asking only for the pick the roadmap's own text said it owed.
  Both seats: CONTRIB permits the 165 → 160 → 163 regression, so it does not
  deliver the trunk invariant this roadmap already committed to — one seat put
  the authority question sharply, that choosing CONTRIB *"would weaken the
  already stated uninterrupted-trunk guarantee, not merely relocate its check"*,
  which is why picking ABS is the council-decidable direction and picking
  CONTRIB would not have been.

  **SPLIT-BY-FILE was refused on a sharper ground than fragility:** finding #1
  establishes that non-compositionality exists, not WHERE, so a per-ratchet
  classification of "safe to regress" would be *"a guess wearing process
  clothes"*.

  **And ABS does NOT require B4** — both seats, independently. A read-only PR job
  can evaluate the prospective merge tree and load the baseline from the target
  commit; the post-merge writer is needed for detection and baseline
  maintenance, not for prevention. This is the finding that keeps Phase 3 alive
  while B4 stays owner-reserved.

  Status: **closed — decided.** The reader landed with 11 tests; the PR job and
  its freshness binding remain open under 3.1.
- **B5-superseded — the original diagnosis, kept because the reasoning is load-bearing.** AI council 2/2 on the
  diagnosis, split on the remedy. 3.1's verify sentence selects a *contribution*
  invariant ("100 commits behind passes"); 3.3 selects an *absolute* one ("a
  tightening still fails a PR that regresses past it"). No implementation order
  reconciles them, and the proposal to satisfy both with a delta check was
  refused on a correctness ground: **violation counts are not necessarily
  compositional**, so a prospective merge can regress even when the isolated PR
  delta is non-positive. **Blocks:** 3.1, 3.2, 3.3. **What unblocks:** the
  roadmap picks one invariant and rewrites the losing criterion. Status: open.
- **B3 — union merge drivers for any ratchet or ledger file.** Refused by the
  AI council 2026-08-21 (recorded in the archived hotspot-drawdown roadmap).
  Inherited unchanged; Phase 3 takes the one-writer route *because* union merge
  is off the table. Status: closed — decided, not pending.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Post-merge writer fails silently | implementation | The single writer errors or is skipped, so a generated aggregate goes stale on `main` with no PR-side gate left to notice — Phase 1.4 removed exactly that gate | Phase 1.4 keeps the freshness gates alive on the main-side job, so staleness reds on `main`; a report stale > 24 h falsifies Phase 1's premise and is published before any patch-up | Phase 1 — Generated aggregates leave the PR diff |
| 2 | Merge-base read weakens the ratchet | implementation | Reading the baseline from the merge-base side could let a regression through whenever `main` tightened after the branch started | Phase 3.3 asserts a tightening still fails a regressing PR, and the test must have been seen red against the pointed-back read | Phase 3 — Baselines advance on main, merge-base judges the PR |
| 3 | Claim-ID collision after the split | implementation | The monolithic ledger prevented duplicate claim IDs structurally; a per-file directory does not | Phase 2.2 adds an explicit uniqueness gate, verified against a probe that adds a duplicate ID | Phase 2 — The CLAIMS.md append surface stops appending |
| 4 | The drain cap is ignored under time pressure | process | The 2-PR cap and the rebase-before-open step are prompt-carried, so a batch run can silently reintroduce same-base siblings | Phase 4.1's verify is observable after the fact (no two open PRs share a behind-count), so a violation is detectable rather than assumed away | Phase 4 — The drain serializes |
| 5 | The measured population is too small to move T1 | product | Six open PRs, four conflicting: a 20-PR window may not separate the fix from normal variance | T1 is stated against both denominators (4 of 6 overall, 4 of 4 among behind > 0), and a miss is published rather than reinterpreted | Phase 5 — Verification window |

## Acceptance Criteria

- [ ] **AC-1** — Every path in the § 0 D1 table is either classified in
      `sync_pr_branch.ts` or no longer appears in PR diffs at all.
- [ ] **AC-2** — Re-measuring the four § 0 conflicting branches after Phases 1–3
      yields conflicts only on genuinely authored paths (`src/cli/mcp/dispatch.ts`,
      `src/rules/ui-audit-gate.md`, `src/config/gate-coverage.yml`,
      `src/scripts/hook_manifest.yaml`, the roadmap files) — zero on generated
      aggregates, reports, derived docs, or baselines.
- [ ] **AC-3** — T1 and T2 from Phase 5.1 are published against the § 0
      baseline, hit or miss, with the census script committed.
- [x] **AC-4** — `pr_conflict_census.ts` answers "why is everything red" as one
      command, so the § 0 measurement never has to be reconstructed by hand.
      **Met.** `./scripts-run src/scripts/pr_conflict_census --limit 2000` prints
      the ranked path list, the generated share, and the window it actually
      scanned. Reading:
      `agents/evidence/analysis/merge-conflict-census-2026-08-24.md`.

      It counts **resolutions, not touches**: `git show --name-only` on a merge
      commit prints the combined diff, so a clean merge prints nothing and a
      resolved one prints exactly the resolved paths. Validated both ways before
      any figure was taken — a merge with five known conflicts printed those five,
      a clean PR merge printed nothing.

      Two defects were found by running it rather than by writing it, and both
      would have produced a confident wrong answer:

      - **The default `--limit 200` measured the newest THREE DAYS while the
        header said "60 days ago".** A 60-day window holds 1,843 merge commits
        here. The census now prints the window it scanned and flags truncation;
        a mislabelled window reads as a trend.
      - **`isGenerated()` misclassified the top four hotspots**, reporting a
        10 % generated share where the answer is **50 %**. A test now pins both
        directions — the five paths it missed and seven authored paths it must
        not claim.

## Premise re-measured 2026-08-24 — the motivating population is now empty

Recorded rather than quietly corrected, because it changes what this roadmap may
claim and not what it may do.

This file's § Source measures **6 open PRs, all created 2026-08-23, all
`base: main`**, against `origin/main = d6238520f`. Re-measured at
`HEAD 0f7c26ee9`, 110 commits later, with `gh pr list --state open`:

```
open PRs: 0
```

All six merged. So every per-PR figure in § Source — the behind-counts, the
CLEAN/CONFLICT verdicts, the #1598 and #1596 attribution — is **history, not a
present state**, and no phase may be justified by the urgency of that set.

The irony is exact and worth keeping rather than smoothing away: this file's own
correction 1 records that a proposed phase "addressed an empty population", and
its premise is now in that same condition. A live-state measurement is not a
finding that keeps; it decays silently, which is why
[`direct-answers`](../../src/rules/direct-answers.md) Iron Law 2 forbids
asserting PR state from memory at all.

**What this does not settle.** The *structural* claims are independent of any
PR set and were not re-measured here: `dist/` tracked at ~14 MB as the largest
merge surface, and `merge_group` triggers wired into zero required workflows.
Those may well still hold. But they are the roadmap's B1 and B2 **open
blockers**, not its executable phases.

**Consequence for status.** It stays `status: draft`. Flipping it to `ready`
alongside the one flip this run did make would assert an executable plan on a
dissolved premise with two open blockers underneath. Re-measure the open-PR set,
or re-anchor the phases onto the two structural claims and let the blockers gate
them — either is a real path; the flip is not.

### Re-anchored 2026-08-24 — the second path, taken

The premise is re-anchored on **history**, not on a PR set, because the section
above is right that a live-state figure decays. `pr_conflict_census` (AC-4,
built this run) measures merge-conflict *resolutions* over a fixed window, and
history does not dissolve between the measurement and the phase.

**60 days, 1,843 merges, 533 carrying a resolution: 703 of 1,394 resolutions
(50 %) are on GENERATED paths.** That is Phase 1's premise, quantified for the
first time and independent of who has a PR open. Full reading and method:
`agents/evidence/analysis/merge-conflict-census-2026-08-24.md`.

**Two repairs the tree already made are visible in the numbers**, which is the
part that changes what the phases should do rather than only justifying them:

- `agents/roadmaps-progress.md` — **339 resolutions in 60 days, zero in the last
  three.** Untracked at `.gitignore:108`. The largest merge surface in the
  repository was removed by deleting it from the index.
- `src/config/estate-count-budget.json` — **105 in 60 days, and all 9 recent ones
  fall on 2026-08-22**, the day ADR-243 removed its stored baseline. None after.
  Phase 3's target, already hit by a different change.

Neither is a causal claim: the dates line up and the mechanism is plausible, but
nothing was held constant and merge volume varies. Recorded as observation.

**What the re-anchoring moves.** Phase 1's path list is aimed at four paths, one
of which (`agents/reports/originality.*`) has **never** conflicted; the five that
do are unnamed (§ 1.1 now carries the table). Phase 3's headline case is done.
Phase 2's target, `docs/CLAIMS.md`, is the **only** top-ten authored path with a
rising trend — 38 over 60 days but 12 in the newest three. And three authored
hotspots sit in no phase at all: `gate-violation-baselines.json` 29,
`taskfiles/ci-fast.yml` 24, `gate-coverage.yml` 18. This drain run hit the last
two on two branches in one day and moved `.secret-allow`'s pin into
`gate-coverage.yml` five times.

**Status still stays `draft`**, and the re-anchoring is why rather than despite:
it changes what the phases should target, and a plan whose phase list the
evidence just moved is not a plan to mark executable in the same change that
moved it.

**Also worth knowing:** its two blockers are written as `- **B1 —` bullets, and
`check_estate_count` counts only `### blocker:` headings
(`/^###[ \t]+blocker:/`). So B1 and B2 are invisible to the ratchet today. That
is left as-is deliberately — converting them would grow `open_blockers` by two,
which has no allowance and would be a substantive estate act smuggled into a
carry.
