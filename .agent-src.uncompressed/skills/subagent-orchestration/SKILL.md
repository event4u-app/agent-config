---
name: subagent-orchestration
description: "Use when orchestrating implementer/judge subagents — five modes (do-and-judge, do-in-steps, do-in-parallel, do-competitively, judge-with-debate) — models from .agent-settings.yml."
source: package
---

# subagent-orchestration

## When to use

* A task benefits from a second agent reviewing before apply — safety,
  regression risk, cross-layer change
* A plan has clear, independent slices that can be worked on in
  parallel — unrelated bug fixes, multi-file migrations
* A solution space is broad enough that multiple candidate
  implementations are worth producing and comparing
* The user explicitly asks "have a second agent review this" or "try
  this two different ways"

Do NOT use when:

* The task is small and the overhead of a second agent exceeds the
  value — single file, one-liner fix
* The user is still exploring — route to brainstorming / planning
  skills first
* Budget is the constraint — each subagent call multiplies cost
* The implementer and judge would be the same model on the same
  context — no added signal

## Goal

Land a verified change (or set of changes) by combining implementer
and judge subagents in a mode chosen deliberately, with model pairing
read from `.agent-settings.yml` — never silently improvised.

## The Iron Law

```
NO JUDGE ON THE SAME MODEL AS THE IMPLEMENTER ON THE SAME CONTEXT.
```

Same model + same context = same blind spots. The whole point of a
judge is a fresh pair of eyes. If `.agent-settings.yml` resolves to
identical implementer and judge models, surface the mismatch before
running — do not silently continue.

## The five modes

Each mode has a decision row: when to use, when not, and the expected
model pairing. Defaults come from
[`subagent-configuration`](../../contexts/subagent-configuration.md).

### 1. do-and-judge

Implementer produces a diff; judge reviews; loop applies, revises, or
hands off. Hard ceiling: **two revision cycles**, then stop and hand
back to the user.

| When to use | When not | Model pairing |
|---|---|---|
| Single-change task with non-trivial risk | Tiny fix, or spike/exploration | implementer = session; judge = one tier up |

### 2. do-in-steps

Plan is split into N steps; judge runs **between** steps. A step that
fails judgment is revised before the next step starts. Used for
multi-file changes where a mid-plan mistake would cascade.

| When to use | When not | Model pairing |
|---|---|---|
| Multi-step plan with ordered dependencies | Single-step change, or when steps are independent (use `do-in-parallel`) | implementer = session; judge = one tier up |

### 3. do-in-parallel

Independent slices run concurrently. No judge per slice — judge runs
once on the aggregated result. Parallelism capped by
`subagents.max_parallel` in `.agent-settings.yml`.

| When to use | When not | Model pairing |
|---|---|---|
| Independent slices (different files, non-overlapping) | Any slice touches shared state | implementer = session; judge = one tier up, run once |

### 4. do-competitively

Multiple implementers produce candidate diffs for the **same** slice.
Judge picks the winner and rejects the losers. Expensive — use only
when the solution space is genuinely broad.

| When to use | When not | Model pairing |
|---|---|---|
| Broad solution space (algorithm choice, API shape) | Well-defined problem with one good answer | implementers = same tier (≥2 instances); judge = one tier up |

### 5. judge-with-debate

Two judges each produce a verdict; a meta-judge reconciles
disagreements. Used for high-stakes changes (security, data
migration, public API) where a single judge is too easy to fool.

| When to use | When not | Model pairing |
|---|---|---|
| Security, data integrity, public API change | Routine internal refactor | judges = same tier (2x); meta-judge = one tier up |

## Procedure

### 1. Inspect the task shape

Before picking a mode, check:

* Is the task single-change or multi-step?
* Are slices truly independent, or do they share state?
* Is solution space narrow (one right answer) or broad (trade-offs)?
* Is risk high enough to justify debate?

Do not pick a mode until these four questions have concrete answers.

### 2. Resolve models

Read `.agent-settings.yml`:

* `subagents.implementer_model` → empty = session model
* `subagents.judge_model` → empty = one tier above implementer
* `subagents.max_parallel` → integer, default 3

If resolution produces an unknown alias or implementer == judge in the
same context, **stop** and report. Do not improvise.

### 3. Pick the mode

Match task shape to one of the five modes. When two modes could fit,
prefer the cheaper one (`do-and-judge` < `do-in-steps` < `do-in-parallel`
< `do-competitively` < `judge-with-debate`).

### 4. Dispatch

Hand off to the matching command:

* `do-and-judge` → [`/do-and-judge`](../../commands/do-and-judge.md)
* `do-in-steps` → [`/do-in-steps`](../../commands/do-in-steps.md)
* `judge` (standalone) → [`/judge`](../../commands/judge.md)

Modes without a dedicated command (`do-in-parallel`,
`do-competitively`, `judge-with-debate`) are orchestrated inline via
the skill — describe the dispatch explicitly in chat so the user can
follow it.

### 5. Report

Follow the output format below. Never merge a diff without reporting
the judge verdict.

## Gotcha

* **Identical model both sides** — same blind spots. The Iron Law
  blocks this before dispatch.
* **Judge drifts off-task** — judge reviews *the diff*, not the task
  description. Always attach the diff to the judge prompt.
* **Infinite revision loop** — hard ceiling of two revisions in
  `do-and-judge`; then hand back to the user.
* **`do-in-parallel` on overlapping slices** — race conditions,
  conflicting diffs. Verify independence before splitting.
* **Cost surprise on `do-competitively`** — N implementers + 1 judge =
  N+1 subagent calls for one slice. Confirm budget before dispatch.

## Output format

1. **Mode chosen** — one of the five, with the one-line reason
2. **Model pairing** — implementer model / judge model (resolved)
3. **Verdict** — applied / revised / handed back
4. **Evidence** — diff summary, test output, or judge transcript
5. **Next step** — what the user does now (review PR, pick winner, etc.)

## Do NOT

* NEVER run implementer and judge on the same model and same context
* NEVER exceed the two-revision ceiling in `do-and-judge` without user
  consent
* NEVER run `do-in-parallel` on slices that touch shared files
* NEVER apply a diff that the judge rejected without explicit user
  override
* NEVER silently resolve an unknown model alias to a fallback

## Handover

| Task                                 | Skill / command                      |
|--------------------------------------|--------------------------------------|
| Configuration reference              | [`subagent-configuration`](../../contexts/subagent-configuration.md) |
| Do-and-judge loop                    | [`/do-and-judge`](../../commands/do-and-judge.md) |
| Stepwise plan with judge gates       | [`/do-in-steps`](../../commands/do-in-steps.md) |
| Standalone judge on an existing diff | [`/judge`](../../commands/judge.md)  |
| External / networked second opinion  | [`ai-council`](../ai-council/SKILL.md) |
| Verifying completeness               | [`verify-before-complete`](../verify-before-complete/SKILL.md) |
