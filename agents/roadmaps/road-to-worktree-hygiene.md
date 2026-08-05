---
complexity: lightweight
status: ready
---

# Road to worktree hygiene — 249 worktrees, 40 GB, one prune that does nothing

> Planned, not scheduled, and deliberately kept out of the session that found it.
> A bulk branch/worktree sweep is exactly the kind of work that must not ride
> along on an unrelated change.
>
> **Promoted draft → ready 2026-08-05.** The `Why draft` trigger below
> ("materially affects clone size, disk, or a tool that walks worktrees") fired
> on the **disk** leg: 40 GB under one worktree root, with the count up 209 → 249
> in five days. AI council 2026-08-05 (2 members, $0.05) converged 2/2 on
> adopting the roadmap now and on extending the existing gate script rather than
> adding a parallel one. Its decisive point: the maintainer currently has **no
> list at all**, so the removal decision already exists and is merely
> un-actionable — a classified safe set turns an unbounded chore into one
> reviewable approval.

## The finding

`git worktree list` reports **249** entries in this checkout (filed at 209).
They accumulate one per feature branch and are never removed on merge;
`git worktree prune` only clears registrations whose directory is already gone —
measured this pass that is **0 of 249**, so here it does nothing at all. Disk is
**40 GB** under `.claude/worktrees/` alone, beside **692** local branches. On top
of disk, a stale worktree is a second copy of the repo that can hold an old
`.agent-settings.yml`, a stale `node_modules` symlink, or a branch that looks
alive in `git branch` long after its PR merged.

Nothing here is broken. This is hygiene, and it was filed so the number did not
quietly become 400. It reached 249 instead — hence `ready`.

## Why it is not a one-liner

Every removal is a deletion, and deletions in this repo carry a verification
duty, not just a permission gate:

- A worktree's branch may hold commits that never reached `main` — a cherry-pick
  gives the same content a different SHA, so `git rev-list --count main..branch`
  alone proves nothing. Content has to be checked, as it was for the four
  branches removed on 2026-07-31.
- A worktree may hold **uncommitted** work. `git status --porcelain` per worktree
  is the floor before any removal.
- Some worktrees belong to concurrent sessions. A sweep run while another agent
  or terminal is working in one destroys live state.

## Phase 1 — inventory, classify, record

- [x] Inventory: per worktree — path, branch, dirty?, commits not on `main`,
      whether that content is reachable on `main` anyway, PR state if any.
      <!-- done 2026-08-05: `inventory` mode on the EXISTING
      src/scripts/worktree_cleanup_check.ts (council Decision 2, option 1 — reuse
      the already-tested per-worktree gate rather than a parallel script). Reports
      path, branch, trunk-ancestry, dirty count, detached HEAD, location
      convention, and liveness. PR state is deliberately NOT fetched: it needs a
      network call per worktree and trunk-ancestry already answers the question
      the PR state was a proxy for. -->
- [x] Classify: **safe** (clean, merged, content on `main`) · **review**
      (unique commits or dirty) · **live** (another session's).
      <!-- done 2026-08-05: `safe` requires ALL of — on a branch, merged into the
      trunk, clean incl. untracked, inside a conventional worktree root, and no
      git activity for 48 h. Result: 143 safe / 78 review / 28 live of 249.
      Two real defects were found and fixed while building it, both pinned by
      regression tests: (1) plain `git status` refreshes the on-disk index, so the
      check bumped the very mtime it reads as the liveness signal — two runs moved
      10 worktrees safe → live (151/80/18 → 143/78/28); fixed with
      `--no-optional-locks`, classification now stable across consecutive runs.
      (2) git reports worktree paths as realpaths, so a repo reached through a
      symlinked parent mis-classified conventional worktrees as non-standard;
      fixed by canonicalising the longest existing ancestor. -->
- [ ] Present the safe set as a list and remove **only after explicit approval** —
      per `scope-control`, branch and worktree deletion is permission-gated, and
      a bulk sweep does not inherit a single earlier approval.
      <!-- PRESENTED 2026-08-05, removal NOT run: `inventory --plan` emits the 143
      `git worktree remove` + `git branch -d` pairs (never `-D`, so git itself
      re-checks the merge). Running them is a Hard-Floor bulk deletion needing the
      maintainer's explicit this-turn approval — see blocker
      `safe-set-removal-approval`. This step stays open by design: the roadmap
      cannot close without a human, and that is the correct shape, not a gap. -->
- [x] Leave the review set untouched with its reason recorded, so the next pass
      starts from a shorter list rather than the same 209.
      <!-- done 2026-08-05: nothing in the review set was touched. Reasons recorded
      in agents/evidence/reports/worktree-inventory.md — 63 non-standard location,
      9 unsaved work, 4 unmerged, 2 detached HEAD. The 63 are excluded from the
      safe set deliberately: beside the repo they can be mistaken for sibling
      packages, so the layout call is the maintainer's, not mechanical. -->
- [x] Record whatever count remains, so a later pass can tell growth from
      residue.
      <!-- done 2026-08-05: agents/evidence/reports/worktree-inventory.md carries
      the baseline table (249 / 40 GB / 692 branches / 0 prunable) plus the
      growth-vs-residue read for the next pass. It also states the honest limit:
      the `live` figure is inflated by this session's own pre-fix runs and decays
      once the 48 h window passes; the structural figures are unaffected. -->

## Non-goals

- **No automatic pruning on merge.** A hook that deletes worktrees is exactly the
  wrong place for irreversible cleanup; the sweep stays deliberate and reviewed.
- **Not a git-hygiene framework.** One inventory script and a reviewed list.
- **No creation-side quota or convention enforcement.** One council member
  suggested guarding future growth at creation time. Out of scope here and
  deliberately not filed: this roadmap measures and cleans, and a mechanism to
  prevent growth needs its own evidence that the convention is what fails —
  `worktree-lifecycle` already documents the conventional roots.

## Why `draft` (superseded — kept for the trail)

Nothing is failing. Promote when the count materially affects clone size, disk,
or a tool that walks worktrees — or simply when a maintainer wants the list.

*Fired 2026-08-05 on the disk leg (40 GB) — see the promotion note at the top.*

## Acceptance criteria

- [x] A repeatable inventory exists that classifies every worktree and whose
      verdict does not change when it is run twice.
- [x] The review set is recorded with a per-entry reason, untouched.
- [x] The residual counts are recorded so growth can be told from residue.
- [ ] The safe set has been removed after explicit maintainer approval, and the
      post-removal count is recorded.

## Blockers

### blocker: safe-set-removal-approval

- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 step 3, and the last acceptance criterion
- **What to do:** review the prepared plan
  (`./scripts-run src/scripts/worktree_cleanup_check inventory --plan`) and
  approve, narrow, or decline the removal of the 143 safe worktrees and their
  fully-merged branches. Bulk deletion is a Hard-Floor action
  (`non-destructive-by-default`): an agent may prepare and surface it, never
  perform it, and a single earlier approval never covers a bulk sweep.
- **Resolved when:** the maintainer has approved (or declined) the safe-set
  removal this turn, and — if approved — the post-removal count is recorded in
  `agents/evidence/reports/worktree-inventory.md`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Removing a worktree that holds the only copy of some work | implementation | A branch may carry commits reachable from no other ref, or uncommitted files; a wrong removal destroys work with no undo | `safe` requires trunk-ancestry AND a clean tree; unmerged branches additionally run the existing unique-commit gate; the plan uses `git branch -d`, never `-D`, so git re-checks the merge at execution time | Phase 1 — inventory, classify, record |
| 2 | Sweeping a worktree another session is using | implementation | A concurrent agent or terminal loses live state mid-task | Liveness (git-dir mtime within 48 h) excludes the worktree from the safe set; the report states plainly that liveness is a heuristic, not a lock, which is why the safe set is a proposal for review | Phase 1 — inventory, classify, record |
| 3 | The measurement corrupts its own signal | implementation | The check reads git-dir mtime as liveness while `git status` rewrites the index — a self-poisoning report that silently reclassifies on every run | Found and fixed during this pass (`--no-optional-locks`); pinned by a regression test asserting two consecutive runs agree | Phase 1 — inventory, classify, record |
| 4 | The prepared plan is never approved | product | The tooling's payoff is contingent on a human acting on a 143-item deletion; if that never happens, the 40 GB persists and the mechanism was built for nothing | Accepted, and named by the council as the strongest argument against adopting this roadmap: the inventory itself has standalone value (the maintainer now knows 143/249 are safe, 63 are in non-standard locations, 4 are unmerged), and the residual counts make a later decision cheaper than this one | blocker: safe-set-removal-approval |
