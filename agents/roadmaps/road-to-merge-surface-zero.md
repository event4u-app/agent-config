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

- [ ] **1.1 Add the four unclassified generated paths to `sync_pr_branch.ts`.**
      `agents/reports/originality.{json,md}`, `docs/proof.md`,
      `internal/reports/exec-evidence-feasibility.json`, and
      `src/domains/*/pack.yaml` are regenerated, never hand-merged — the tool
      currently routes all four to a human decision. This is advice-only and
      banks no drawdown (the header's own rule), but it stops the wrong
      instruction today.
      verify: `tests/scripts/sync_pr_branch.test.ts` gains a `classifyConflicts`
      case per path; the four measured § 0 conflict sets classify with zero
      AUTHORED rows among them.
- [ ] **1.2 Gate PR diffs against touching them.** A PR may not modify the
      Phase-1.1 path set; allowlist is the post-merge bot plus an explicit
      `regen-intended` label. A PR that changes inputs stops carrying the
      re-rendered outputs.
      verify: the gate fails a probe commit that edits `docs/proof.md`, and
      passes the same commit with the label.
- [ ] **1.3 One writer on `main`, post-merge.** A workflow regenerates the set
      after each merge and pushes a single bot commit when output changed.
      Loop guard: the workflow ignores its own commits; idempotence asserted by
      running the generator twice in-job and diffing.
      verify: two consecutive runs on an unchanged tree produce no second
      commit; a run after a merge that shifts `artefact_count` produces exactly
      one.
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

- [ ] **3.1 Read the baseline from the merge-base side.** Gate scripts reading
      `gate-violation-baselines.json` resolve it via
      `git show $(git merge-base origin/main HEAD):<path>` instead of the merge-ref
      working tree, so a PR is judged against the baseline that existed when its
      work began.
      verify: a PR held deliberately 100 commits behind a tightened baseline
      passes; the count of affected read sites is re-pinned from
      `src/scripts/_lib/gate_baseline.ts` and named in the step's own output.
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
- [ ] **AC-4** — `pr_conflict_census.ts` answers "why is everything red" as one
      command, so the § 0 measurement never has to be reconstructed by hand.

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

**Also worth knowing:** its two blockers are written as `- **B1 —` bullets, and
`check_estate_count` counts only `### blocker:` headings
(`/^###[ \t]+blocker:/`). So B1 and B2 are invisible to the ratchet today. That
is left as-is deliberately — converting them would grow `open_blockers` by two,
which has no allowance and would be a substantive estate act smuggled into a
carry.
