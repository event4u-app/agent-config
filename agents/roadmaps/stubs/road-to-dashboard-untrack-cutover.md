---
complexity: lightweight
---

# Stub: road to untracking the roadmap dashboard, at home and in every consumer

> **Stub — not active work.** Created 2026-08-21 by
> [`road-to-merge-hotspot-drawdown`](../archive/road-to-merge-hotspot-drawdown.md)
> step 4.2. Capability-gated, not demand-gated: the maintainer has already
> decided the outcome — *"die Dateien sollten nicht mehr in den Repos landen oder
> bleiben"* — and the AI council (2026-08-21, 2 seats) agreed the dashboard
> should be untracked. What is missing is one of the council's three named
> guards plus a human cutover, and one of the two things the plan assumed
> already existed does not.

## The criterion, verbatim

From the maintainer's handover, on the consumer half:

> "wichtig ist, das soll nicht nur bei ac passieren, sondern bei jedem anderen
> repo und modul des consumer projects, welches uns nutzt. die dateien sollten
> nicht mehr in den repos landen oder bleiben."

And the council's disposition on the mechanism, both seats: untrack the
dashboard, **through a guarded cutover** — never as a bare `git rm --cached`
plus a gitignore line.

## What moved here, complete

Everything in the handover's Phase 2 (repo-side untrack) and Phase 6 (consumer
rollout), specifically:

1. `git rm --cached agents/roadmaps-progress.md` + the `.gitignore` entry.
2. The generator's self-header claim about the timestamp living in git history,
   which untracking falsifies (either embed a generation timestamp or drop the
   claim; silently keeping a false claim is not an option).
3. The one real inbound link, `agents/roadmaps/archive/step-12-closure-report.md:70`.
4. Removing `agents/roadmaps-progress.md` from `sync_pr_branch.ts`'s `GENERATED`
   list, one release after the untrack — straggler branches created before it
   still carry the tracked file.
5. `/agents/roadmaps-progress.md` into `src/config/gitignore-block.txt`.
6. A consumer unstage mechanism — which does **not** exist (see P3).
7. Inverting the shipped `roadmap-progress-check.yml` from *fail-if-stale* to
   *fail-if-tracked*.
8. A `BREAKING_CHANGES` entry with both migration paths, and the first-party
   consumer run (Galawork et al.) as evidence.

## Guards — two discharged, one open

The council named three guards, in order. Two were discharged by the parent
roadmap and are recorded here so this stub is not a re-analysis:

- **Guard 1 — `GENERATED` classification with paired regeneration and fixture
  tests. DISCHARGED.** `agents/roadmaps/archive/{INDEX.md,index.json}` are
  classified, the two ratchet baselines have a `REMEASURED` class, and all six
  measured conflicting paths are asserted in
  `tests/scripts/sync_pr_branch.test.ts`. The paired-regeneration half was found
  already enforced: `build_archive_index --check` names a one-sided drift and
  runs at `.github/workflows/consistency.yml:160`.
- **Guard 3 (partial) — old/new consumer compatibility. HALF-DISCHARGED, and
  the discharged half is the bad news.** The propagation path is confirmed
  (`install.sh:1280` on any non-`--global` install; `cmd_refresh.ts:307` for
  `refresh --project`, which `init --project` aliases to via
  `initRouting.ts:125-129`), so a template line reaches consumers with no code
  change. But `refresh --global` shells `install --global`, which sets
  `SKIP_SYNC=true` (`install:181`) and syncs no gitignore at all — a
  global-scope consumer never receives the entry.
- **Guard 2 — sync-tool support for an intentional tracked→untracked
  transition. OPEN.** Nothing exists. This is the gate.

## Re-entry probes, measured 2026-08-21

**P1 — `--check` must not fail on an absent dashboard.** *This is the repo-side
blocker and it is not optional.* `update_roadmap_progress.ts:1337` in `--check`
mode reads the on-disk file and byte-compares it against a fresh render; an
absent file yields `current = ''`, which differs from any non-empty render, so
`--check` reports **stale and exits 1** the moment CI checks out a commit where
the file is not in git. Reached from `taskfiles/content.yml`
(`roadmap-progress-check`), from the shipped pre-commit hook template, and from
the consumer workflow template. Baseline: **fails** — absence is not a
distinguished case anywhere on that path. Probe: with the file deleted from a
scratch worktree, `roadmap:progress-check` exits 0.

**P2 — the version-skew kill zone must be closed.** A consumer that pulls the new
gitignore block while still running the old `roadmap-progress-check.yml` goes
**permanently red**: the workflow asserts a committed file the block now ignores.
Four-cell matrix; only *new×new* and *old×old* are green, and *new-canonical ×
old-consumer* is the one a rollout actually produces. Baseline: **no version
guard exists** in the template, and old copies in consumer repos are not
auto-updated. Probe: a scratch repo on the old workflow plus the new block is
green, or fails with a message naming the fix.

**P3 — an unstage mechanism must exist, and building one is a policy reversal.**
A gitignore entry does not untrack an already-committed file, which is the
maintainer's *"oder bleiben"* half. The plan assumed a precedent —
`gitignore-block.txt` claimed the Phase-5 migration unstages what it lists — and
that claim was **false**: `cmd_migrate.ts` refreshes the block
(`_update_gitignore`, `:619-647`) and performs no git index operation, and no
executable path in the repo runs `git rm --cached`
(`check_tracked_but_ignored.ts:80` and `check_no_local_settings_committed.ts:85`
only print it; `/sync-gitignore:fix` states that git-ops are user-owned and must
not be run automatically). Corrected in the parent's 2.2. Baseline: **zero**
automated unstage paths. Probe: an unstage runs on refresh with the working-tree
file untouched, visible under `--dry-run`, and no commit made in the consumer's
repo — **and** the reversal of the user-owned-git-ops design is recorded as a
decision, because that design is deliberate and this would overturn it.

**P4 — the drain-order call.** With the untrack landing on `main`, every open
branch conflicts once more on the removal commit. Measured at transfer: **7 of 11
open PRs are already `CONFLICTING`** on this exact path, so they need a
resolution pass either way and untracking first is strictly better for them
going forward. Against that, the council's operational objection: a developer
who pulls and sees a file they are editing "deleted" reaches for `git restore`,
producing a modify/delete conflict plus confusion — and this repository routinely
runs several concurrent agent sessions on one checkout. Baseline: 7 conflicting
PRs, ~5 live sessions observed on 2026-08-21. This is a judgement, not a probe;
it belongs to the coordinator below.

## Named producer

**The maintainer, as cutover coordinator.** Not an agent, and the reason is
specific rather than procedural: P2 breaks *consumer* CI, which is a
compatibility commitment and therefore owner-reserved; P3 asks for a deliberate
reversal of a stated design; and P4 is a scheduling call across other people's
open branches. P1 and Guard 2 are agent-executable and are the right first slice
once the coordinator sets a date — nothing in P1 needs a human, it needs an
`--check` that treats absence as a distinguished case.

## Rollback triggers, per the council

- **Untrack:** revert if a clean clone cannot reproduce the artefact, if a
  supported consumer re-tracks it on refresh, or if packaging loses required
  content.
- **Checker inversion:** revert or disable if old/new consumer combinations
  cannot be told apart safely.
- **Consumer rollout:** pause if refresh deletes authored content, touches
  unrelated files, or needs manual recovery outside the documented procedure.

## What is explicitly NOT here

The two ratchet baselines. They are not gitignorable at all — an untracked
baseline is a baseline no PR diff can be compared against — and their
append-safety fix is blocked on its own terms by
[ADR-239](../../../docs/decisions/ADR-239-no-union-merge-for-ratchet-baselines.md).
The stubs README append surface is also not here: the council cut it and asked
for a re-measurement *after* this cutover, because the dashboard co-conflicts in
the same merges and inflates today's number.
