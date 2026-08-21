---
complexity: lightweight
---

# Stub: road to the roadmap-set front doors

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated
> stub. Created 2026-08-20 when
> [`road-to-user-out-of-the-loop.md`](../archive/road-to-user-out-of-the-loop.md) was
> drained. The parent's **mechanics** for multi-roadmap execution landed; its
> four **entry points** did not, and one of them is gated on observations that
> only those entry points can produce. Framework of record:
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Outcome state recorded on the parent: **transferred**.

## Why the split falls here and not somewhere else

The parent states its own architecture principle, and this stub is that
principle applied to its own leftovers:

> No autonomy feature binds to a command. Every mechanism lands in a shared
> layer each entry point already loads … A `/goal` entry point may exist later
> as a thin front door (P6.4), never as the carrier of the mechanics.

So the mechanics went where the principle says — the set contract, the
dependency union, auto-continuity, failure isolation and the lane shape are in
[`roadmap-process-loop § 3d`](../../../src/agent-src/contexts/execution/roadmap-process-loop.md),
and the set-scoped autonomy shape is in
[`autonomy-mechanics § Task-scope`](../../../src/agent-src/contexts/execution/autonomy-mechanics.md).
What is left here is front doors, which by the parent's own rule carry no
mechanics at all.

**This is not a capability the environment withheld.** All four items are
buildable in this repository today, and saying otherwise would misuse the
transfer shape. They moved for a different, stated reason: each is a new
command surface with its own downstream registration set, one of them is
observation-gated, and shipping four command front doors inside a drain commit
whose subject was the rule deltas would be the sprawl the parent's own
principle exists to prevent.

## The criteria, verbatim from the parent

Phase 2:

> Add `/roadmap:process-backlog [--limit N] [--filter …]`: selection like
> `/roadmap:next` but over an ordered set, with one contract for the whole set
> — candidates, branch names, dependency graph, artifact counts, and one
> decision sheet across all of them.

> Wire parallel lanes for independent set members (no declared dependency,
> disjoint owned paths), staged only after ten clean serial set runs. Isolation
> via the existing worktree scope lock, coordination via session-register
> branch claims, dispatch via the existing worktree orchestration mode,
> delivery one branch and one PR per lane. Cap at two lanes in the first
> iteration.

Phase 3:

> Support stacked branches: a dependent roadmap branches from its parent's
> branch and its PR targets that branch. Pushes stay restricted to the run's
> own branches. Execution never waits for a merge.

> Add `/roadmap:merge-train`: a single conversational surface presenting the
> whole stack at once, where each merge instruction issued in that session is
> followed by the agent retargeting and rebasing the dependent PRs — an
> executed per-PR instruction, never an agent decision.

Phase 6:

> Add `/goal <objective>` as a thin front door: intake, live screen, batched
> confidence gate, roadmap authoring, contract plus sheet, then execution. No
> mechanics of its own.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| `/roadmap:process-backlog` | Phase 2 Step 1 | A new command surface; the mechanics it would front already exist. |
| Parallel lanes | Phase 2 Step 5 | **Observation-gated**, and the observations are unobtainable without the item above: the parent stages lanes behind ten clean serial set runs, and zero set runs can occur while no set entry point exists. The lane *shape* and the recorded cap of two are already in § 3d. |
| Stacked branches | Phase 3 Step 2 | Needs a set run to have two members to stack, so it inherits the same gate. |
| `/roadmap:merge-train` | Phase 3 Step 3 | A new conversational surface over a stack that no run can currently produce. |
| `/goal <objective>` | Phase 6 Step 4 | A thin front door by the parent's own text; nothing depends on it. |

Nothing else moves. The parent's Phase 2 auto-continuity and failure-isolation
steps, its Phase 3 dependency detection, and every other Phase 1/4/5/6/8 item
are satisfied, narrowed or abandoned in its `## Outcome` section.

## Producer and probe — named, not wished

Promote **per item**, not per file.

- **`/roadmap:process-backlog`, `/roadmap:merge-train`, `/goal`**
  - **Producer:** whoever next authors a command in this suite — no external
    capability is required, which is why these three are ordered by demand
    rather than by a gate.
  - **Probe:** a command directory exists under `src/domains/product-basic/roadmap/`
    (or, for `/goal`, wherever its pack places it) and is registered across the
    command-cluster surfaces `lint_command_routing` checks.
  - **Measured reading, 2026-08-20:** `src/domains/product-basic/roadmap/`
    holds `ai-council`, `create`, `materialize`, `next`, `process-full`,
    `process-phase`, `process-step` and `command.md`. A tree-wide grep for
    `process-backlog` and `merge-train` under `src/domains/` and
    `src/agent-src/commands/` returns **zero** files; no `goal` command
    directory exists. **Three absent, as expected.**
- **Parallel lanes**
  - **Producer:** ten completed serial set runs, which requires
    `/roadmap:process-backlog` first. This is a genuine ordering constraint,
    not a preference.
  - **Probe:** ten recorded set runs that closed with no cross-roadmap
    interference. A set run is identifiable because the set contract prints
    its members, so the evidence is the run's own contract record.
  - **Measured reading, 2026-08-20: zero set runs**, and the count cannot rise
    while the entry point is absent. Stated the other way round so it is not
    over-read: zero here licenses "lanes are not ready", never "lanes are not
    wanted" — the parent's kill criteria for lanes are written and its cap is
    decided.
- **Stacked branches**
  - **Producer / probe:** one set run whose contract prints ≥ 2 members with a
    dependency edge between them. **Measured 2026-08-20: zero.**

## What this stub is NOT gated on

The shared promotion criteria in [`README.md § Promotion criteria`](README.md)
— recruited customer, funded security audit, ADR sign-off — do **not** govern a
drain-run transfer. Three of the five items here are gated on nothing but
someone deciding to write them; two are gated on observations. No Hard-Floor
act is pending in either group, which distinguishes this stub from the
repo-admin transfers listed alongside it.

## One inherited anti-goal that still binds

The parent's anti-goals hold here verbatim, and one of them constrains the
merge train specifically:

> Merge stays human and conversational — this plan makes merges batchable and
> decouples execution from them, it does not automate them.

So `/roadmap:merge-train` is a surface that *executes a per-PR instruction the
human issues in that session*. A train that decides which PR merges next is
not a narrower version of this item; it is a different item, and it is out of
scope for this stub as much as it was for the parent.
