---
complexity: lightweight
review_by: 2026-09-21
probe: none
---

# Stub: prove the re-add guard refuses a stale branch, from `main`

> **Stub — not active work.** Created 2026-08-22 by
> `road-to-generated-artifacts-out-of-index` as the disposition of its one
> deferred acceptance criterion. Capability-gated, not demand-gated: the
> decision is made, the mechanism is shipped, and the only thing missing is a
> vantage point that does not exist until the shipping change is itself the
> base.

## The criterion, verbatim

> **AC-2** — A pull request built from a commit that predates this change, which
> re-adds one of the paths and carries no guard on its own branch, is refused by
> the required check on `main`.

## The blocker

For a `pull_request` event GitHub builds the required check from the merge ref.
Until `feat/generated-artifacts-out-of-repo` is merged, `main` carries neither
the guard nor the untracked state, so a stale fixture PR opened today merges
against a base with nothing to refuse it. The refusal is observable from the
first moment it is not, and not before. This is a deployment dependency, not
unfinished work.

## What was verified without it

The content half, on a real merge tree rather than by inference. `origin/main`
merged into the branch produced `modify/delete` on all three paths and left the
stale version in the tree; resolved the careless way — the way PR #1505 was
resolved — all three read as re-added, and on that tree both required-job gates
exit 1, each naming its paths and the `git rm --cached` that fixes them. What
that does **not** establish is the workflow-provenance half: that the definition
GitHub runs comes from the merge ref rather than from the head branch alone.

## What closes this

1. `feat/generated-artifacts-out-of-repo` is merged, so `main` carries the guard
   and the untracked state.
2. Open a fixture PR from a commit that predates that merge, re-adding one
   protected path, on a branch that does **not** contain the guard. Label it as
   test infrastructure.
3. Observe `Sync + Generate Tools Consistency` — the one check
   `main protection` (ruleset 17749383) requires — refuse it, and capture the
   refusal naming the path.
4. Close the fixture PR unmerged.
5. Record the capture; AC-2 is then met as written.

The two PRs open at the time of writing — #1517 (`drain/road-to-drain-commands`)
and #1495 (`drain/road-to-per-turn-hook-economy`) — both carry all three paths
tracked, so either is a natural, non-synthetic instance of step 2 if it is still
open. Prefer the deliberate fixture: a real PR's red is someone else's problem
to resolve, and using it as evidence conscripts their work into this proof.

## Why a stub and not a roadmap

The AI council (2026-08-22, 2 seats + blind peer review, $0.10) chose the
precursor split — ship the minimum atomic enforcement slice, observe from the
new base, then close — over checking the criterion on inference, over weakening
it, and over paying a red estate gate. Both seats named the same abuse this
opens: a "precursor" is a legitimate split only when the slice unlocks a
verification that is otherwise impossible, never when it reorders feature work
to dodge the ratchet's friction. The test both stated: does the slice make an
impossible observation possible? Here it does, and nothing else rides along.

A stub is the estate-ratchet-compliant carrier the preservation test asks for —
`estate-count-budget.json` states in its own `not_gated` list that a stub is not
estate — so the criterion survives verbatim without buying its survival with a
baseline raise, which this roadmap's AC-4 forbids.

**One honest limit, stated rather than left to be discovered:** a stub is a
weaker container than an active roadmap. Nothing schedules it. If the fixture PR
is never opened, this criterion is never observed and nothing objects — the same
indefinite-deferral hole the preservation test names in its own text. The
counterweight is that the mechanism it would verify is already shipped and
already refusing on every merge tree it has been run against; what is unproven
is the platform's provenance guarantee, not the guard.
