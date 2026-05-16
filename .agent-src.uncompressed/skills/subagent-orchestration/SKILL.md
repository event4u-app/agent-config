---
name: subagent-orchestration
description: "Use when orchestrating implementer/judge subagents — seven modes (do-and-judge ±two-stage, do-in-steps/parallel/worktrees, do-competitively, judge-with-debate) — models from .agent-settings.yml."
source: package
domain: process
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

## The seven modes

Each mode has a decision row: when to use, when not, and the expected
model pairing. Defaults come from
[`subagent-configuration`](../../contexts/subagent-configuration.md).

### Topology hints — per-mode communication shape

Descriptive, not enforced. Documents the **expected agent-to-agent
communication topology** so consumers can predict latency, failure
modes, and where consensus is required. Cited from
[`external-findings.md § 2`](../../../agents/audit-2026-05-14-north-star/external-findings.md)
row 7 (Ruflo's `hierarchical, 6–8 agents, raft consensus` anti-drift
default).

| Mode | Topology | Anti-drift default | Notes |
|---|---|---|---|
| do-and-judge | `hierarchical` | 1 implementer · 1 judge · session-orchestrated | Two-node hub-and-spoke; orchestrator owns the loop. |
| do-and-judge-two-stage | `hierarchical` | 1 implementer · 2 sequential judges | Stages are serialized; spec-judge gates quality-judge. |
| do-in-steps | `ring` | N steps · 1 judge between each | Step N output → judge → step N+1 input; cycle on revise. |
| do-in-parallel | `star` | 6–8 implementers · 1 judge · session-hub | Capped by `subagents.max_parallel`; judge runs once on union. |
| do-competitively | `mesh` | 2–4 implementers · 1 judge | Implementers do not see each other; judge sees all candidates. |
| judge-with-debate | `hierarchical-mesh` | 2 judges · 1 meta-judge | Judges debate (mesh edge); meta-judge reconciles (hierarchical). |
| do-in-worktrees | `adaptive` | per-step topology of the underlying mode | Each worktree picks its own shape; chain is hierarchical. |

**Anti-drift default** (Ruflo convention, descriptive only):
`hierarchical, 6–8 agents, raft consensus`. Consumers free to
override per orchestration — the table is the **starting point**,
not a constraint. Topology is metadata for capacity planning, not
runtime-enforced.

**Glossary:**
- `hierarchical` — orchestrator hub; agents reply to hub only.
- `mesh` — agents see each other's outputs (e.g. competing diffs).
- `hierarchical-mesh` — peer debate followed by hub reconciliation.
- `ring` — output of step N feeds input of step N+1 in order.
- `star` — N agents fan out from a single hub; no peer comms.
- `adaptive` — topology shifts per step; outer chain remains hub.

### 1. do-and-judge

Implementer produces a diff; judge reviews; loop applies, revises, or
hands off. Hard ceiling: **two revision cycles**, then stop and hand
back to the user.

| When to use | When not | Model pairing |
|---|---|---|
| Single-change task with non-trivial risk | Tiny fix, or spike/exploration | implementer = session; judge = one tier up |

### 2. do-and-judge-two-stage

Implementer produces a diff; **two judges run sequentially** — first a
spec-compliance reviewer (does the diff satisfy the stated spec /
acceptance criteria?), then a code-quality reviewer (is the diff well-
written for the codebase it lands in?). The orchestrator only proceeds
to stage two if stage one returns `DONE` or `DONE_WITH_CONCERNS`. A
stage-one `BLOCKED` shortcuts the loop — there is no point quality-
reviewing a diff that does not satisfy the spec.

| When to use | When not | Model pairing |
|---|---|---|
| Spec is contested or AC are detailed; diff size makes one judge prone to missing one axis (correctness vs craft) | Spec is one sentence, or the diff is one line (collapse to mode 1) | implementer = session; spec-judge = one tier up; quality-judge = same tier as spec-judge, fresh context |

**Why two stages, not one judge with both rubrics:** combining the
rubrics in one prompt reliably regresses one of them — the judge "spends
attention" on whichever rubric appears last. Splitting the prompts
forces each judge to commit fully to its rubric.

**Stage-routing rule:**
- Stage-1 returns `DONE` → run stage-2.
- Stage-1 returns `DONE_WITH_CONCERNS` → run stage-2; concerns carry
  forward to the final envelope.
- Stage-1 returns `NEEDS_CONTEXT` → pause; stage-2 does not run.
- Stage-1 returns `BLOCKED` → final verdict is `BLOCKED`; stage-2
  does not run (saves cost).

### 3. do-in-steps

Plan is split into N steps; judge runs **between** steps. A step that
fails judgment is revised before the next step starts. Used for
multi-file changes where a mid-plan mistake would cascade.

| When to use | When not | Model pairing |
|---|---|---|
| Multi-step plan with ordered dependencies | Single-step change, or when steps are independent (use `do-in-parallel`) | implementer = session; judge = one tier up |

### 4. do-in-parallel

Independent slices run concurrently. No judge per slice — judge runs
once on the aggregated result. Parallelism capped by
`subagents.max_parallel` in `.agent-settings.yml`.

| When to use | When not | Model pairing |
|---|---|---|
| Independent slices (different files, non-overlapping) | Any slice touches shared state | implementer = session; judge = one tier up, run once |

### 5. do-competitively

Multiple implementers produce candidate diffs for the **same** slice.
Judge picks the winner and rejects the losers. Expensive — use only
when the solution space is genuinely broad.

| When to use | When not | Model pairing |
|---|---|---|
| Broad solution space (algorithm choice, API shape) | Well-defined problem with one good answer | implementers = same tier (≥2 instances); judge = one tier up |

### 6. judge-with-debate

Two judges each produce a verdict; a meta-judge reconciles
disagreements. Used for high-stakes changes (security, data
migration, public API) where a single judge is too easy to fool.

| When to use | When not | Model pairing |
|---|---|---|
| Security, data integrity, public API change | Routine internal refactor | judges = same tier (2x); meta-judge = one tier up |

### 7. do-in-worktrees

Cross-wing or cross-skill chain executed across isolated git
worktrees — each handoff in the chain runs in its own worktree, so
the workspace state of one step never leaks into the next. Operationalizes
the worktree boundary clause in
[`docs/contracts/cross-wing-handoff.md`](../../../docs/contracts/cross-wing-handoff.md)
§ 3. State-machine layer only — worktree creation/destruction lives
in [`using-git-worktrees`](../using-git-worktrees/SKILL.md) and
[`finishing-a-development-branch`](../finishing-a-development-branch/SKILL.md).

| When to use | When not | Model pairing |
|---|---|---|
| Multi-step cross-wing chain (≥2 senior skills, each ≥30 min) where one step's open files / branch state would confuse the next | Fast iteration where each step < 30 min — worktree overhead exceeds isolation benefit | implementers = same tier per step; judge = one tier up at chain end |

**Handoff shape:** initiator-skill emits the typed output declared in
its `## Output` block → control passes to delegated-skill in a fresh
worktree → delegated-skill consumes the input shape declared in its
`## Input` (or `## When the agent should load this`) block. The
handoff is auditable; `lint_handoffs.py` validates the chain.

**Example chain (W3 launch):** `positioning-strategy` (worktree A) →
`messaging-architecture` (worktree B, consumes positioning's
`positioning-statement.md`) → `gtm-launch` (worktree C, consumes
both prior artifacts). Each worktree carries one branch; the chain
end produces a single integration PR.

**Anti-pattern:** do not use for fast iteration loops where each
step is under ~30 minutes. The branch-creation, context-switch, and
worktree-cleanup cost dominates. Stick with mode 1 (do-and-judge)
or mode 3 (do-in-steps) for those.

**Competitive variant — per-candidate isolation.** When mode 5
(`do-competitively`) is combined with worktrees, each candidate
implementer runs in its own worktree (so candidates cannot read each
other's open files or branch state). Selection rules:

- **No auto-merge.** The orchestrator never merges a candidate
  branch. Hard Floor per [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) —
  applies even under standing autonomy. ADR-005 records the reasoning.
- **Ranked presentation.** Judge ranks candidates (1..N) with a
  one-line justification per rank; user picks the winner.
- **Loser worktrees stay.** The orchestrator does not delete losing
  worktrees automatically — the user keeps the option to harvest a
  partial idea before cleanup.

## Status taxonomy — every subagent return uses one envelope

Every implementer or judge return must conform to
[`schemas/subagent-status.json`](schemas/subagent-status.json). Four
statuses, no free-form alternatives:

| Status | Meaning | Required keys (beyond `status`, `summary`) |
|---|---|---|
| `DONE` | Work shipped, all gates green. | `evidence[]` |
| `DONE_WITH_CONCERNS` | Work shipped but caller must act on concerns. | `evidence[]`, `concerns[]` |
| `NEEDS_CONTEXT` | Paused; caller can unblock by answering. | `blocking_question` |
| `BLOCKED` | No path forward exists. | `blocking_reason` |

**Why a fixed taxonomy:** orchestrators (`/do-and-judge`, `/do-in-steps`)
route on status. Free-form "kind of done" returns force the orchestrator
to interpret prose, which silently regresses the two-revision ceiling and
the judge-rejected-do-not-apply rule. The schema makes routing mechanical.

**Tests:** `tests/test_subagent_status_schema.py` exercises all four
statuses plus rejection cases (missing required keys, unknown status,
extra fields, conditional-key violations).

**Distinguishing `NEEDS_CONTEXT` from `BLOCKED`:** `NEEDS_CONTEXT` means
*"you, the caller, can fix this by telling me X"*. `BLOCKED` means
*"no input from you unblocks this — escalate or rescope"*. If a subagent
is unsure, it picks `BLOCKED` and the caller can downgrade.

## Dispatch prompts — externalized

Each mode's literal dispatch template lives under
[`prompts/{mode}.md`](prompts/README.md). The orchestrator loads the
matching prompt at dispatch time and substitutes `{{placeholders}}`.
Edits to a prompt do not bloat this skill against the 400-line sunset
trigger; `tests/test_subagent_prompt_loading.py` confirms each of the
seven modes resolves to a loadable prompt that cites all four taxonomy
statuses.

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

Match task shape to one of the seven modes. When two modes could fit,
prefer the cheaper one (`do-and-judge` < `do-and-judge-two-stage` <
`do-in-steps` < `do-in-parallel` < `do-competitively` <
`judge-with-debate` < `do-in-worktrees`).

**Mode 6 (`do-in-worktrees`) is gated by `worktrees.mode`** from
`.agent-settings.yml` (default: `ask`). Resolve before picking:

| `worktrees.mode` | Mode 6 |
|---|---|
| `ask` | Eligible. `using-git-worktrees` will run the per-creation permission ask. |
| `on` | Eligible. Per-creation ask suppressed. |
| `off` | **Not eligible.** Fall back to mode 3 (`do-in-steps`) — same step-by-step chain, in-place on the current branch. Unless the user **explicitly asked this turn** for a worktree chain, in which case proceed with mode 6 and acknowledge the override per [`using-git-worktrees § Pre-flight`](../using-git-worktrees/SKILL.md). |

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

1. **Mode chosen** — one of the seven, with the one-line reason
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
