---
complexity: lightweight
review_by: 2027-01-11
---

# Stub: road to skill uplift measured against a no-skill arm

> **Arrivals:** 4 (at least) — latest `inbox-2026-10-k` (2026-10-11); earlier:
> `inbox-2026-09-o`, `inbox-2026-09-p`, `inbox-2026-09-b`. Subject-matched floor
> ("with skill vs without skill" outcome measurement); the consumed-inbox tree
> is gitignored, so the count is machine-local and the ordering is the finding.

> **Stub — not active work.** Created by round `inbox-2026-10-k`
> (`agents/tmp.old/inbox-2026-10-k/`) because the subject has now arrived four
> times and no held object carried it: the trigger half lives in
> [`road-to-live-trigger-eval.md`](road-to-live-trigger-eval.md), the
> invocation half in
> [`road-to-skill-tiering-live-arm.md`](road-to-skill-tiering-live-arm.md), and
> the package-level lift in `docs/benchmark.md`. None measures whether one
> explicitly invoked skill improves the outcome of the task it is for. Verified
> against `main` @ `d41121927`.

## What already exists

- The harness shape: `src/scripts/run_skill_evals.ts` scaffolds every scenario
  into a `baseline` and a `with-skill` arm (`:286`) and aggregates
  `baseline_pass` against `with_skill_pass` (`:320`).
- What it cannot do: spawning is a stub, `_spawn_subagent(...)` (`:95-100`),
  which "authors implement once for their environment" (`:21-25`); every
  assertion without a live trace is recorded `pass: null`, manual-pending
  (`:209-266`). 146 skills carry an `evals/` directory.
- The package-level answer: `docs/benchmark.md` measures `package` against
  `vanilla` and records a PASS on a weak host and HONEST-NULLs on a strong one.
  That is the whole package, not a skill.

## What the round asked for

A pilot of three to five skills, each with a reproducible task, a deterministic
outcome check and at least one negative-trigger case, run in a fresh session
with the skill unavailable and again with it available, recording task success,
tool calls, tokens, wall time and retries; deterministic checks first, a judge
only as a supplement that may never turn a deterministic fail into a pass, and
no new assertion vocabulary until three skills need the same one. Kill: no
measurable outcome advantage at a higher cost means the skill is improved,
demoted or parked — never that the eval is adjusted.

## Why it is not a roadmap

It needs live host sessions and paid runs that no repository run can produce,
and choosing which skills to spend on is a priority call. ADR-263 already
frames skills as explicitly invoked reference material, which is the setting a
no-skill arm measures, so the question is not contested — only unfunded.

## The posed owner question — 4 arrivals

Exactly one of:

1. **Fund a pilot.** Implement `_spawn_subagent` for one host, pick three
   skills with an `evals/` directory and a deterministic outcome check, and
   publish the result either way — a null is a valid close.
2. **Fold into the tiering live arm.** Extend
   `road-to-skill-tiering-live-arm.md`'s paired sessions with a per-skill
   outcome column, accepting that its arm design measures invocation first.
3. **Decline and record why.** State in this file that per-skill uplift is not
   measured, and that the package-level benchmark is the only efficacy claim
   the suite makes.

Recommendation: (1), smallest form — three skills, one host, one paired run
each, published with its honesty label; it is the only option that answers the
question this subject keeps arriving with.

## Promotion probe

Promote when the owner answers (1), or when `_spawn_subagent` gains a real
implementation for any host for another reason.
