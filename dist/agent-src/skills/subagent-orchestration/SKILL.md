---
model_tier: inherit
name: subagent-orchestration
description: "Use when orchestrating implementer/judge subagents — form gate + nine modes (do-and-judge ±two-stage, steps/parallel/worktrees, competitively, debate, live-app-judge, adversarial-council)."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
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
  (non-interactive bulk cohorts → batch/caching levers via
  [`token-optimizer`](../token-optimizer/SKILL.md) index branch)
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

## RDP: parallel async dispatch by default

Within the Reasoning Discipline Protocol, dispatch independent subtasks to
parallel subagents **by default** and keep working while they run (async), rather
than blocking on each return — intervene only if one goes off track. Engage per
[`rdp-gate`](../../contexts/execution/rdp-gate.md).

### Settings-gated auto-dispatch

"By default" is governed by the [`delegation-policy`](../../rules/delegation-policy.md)
rule — the single source of the auto-trigger. It gates on the activation context
([`auto-orchestration-activation`](../../contexts/execution/auto-orchestration-activation.md)):
dispatch only when `subagents.enabled`, `subagents.auto != off`, the host
manifest reports `subagent_spawn: true`, and the task is classified delegable.
`auto: ask` → ask once; `auto: on` → surface mode + per-subtask tiers in one
line; any gate failing → in-session no-op. Never lifts a safety floor.

## Worker-prompt contract

Every dispatched worker prompt obeys five rules that prevent the two classic
handoff failures (lossy re-summarization dropping the user's requirements;
over-scripted prompts that break on first contingency): (a) user
constraints **verbatim**, (b) describe the goal — don't script the approach,
(c) translate environment paths into the worker's sandbox, (d) pre-declare
check-in conditions, (e) attach relevant knowledge read-only (auto-surface,
never auto-write — ADR-098 floor). The five rules verbatim:
[`subagent-spawn-contract` § Worker-prompt rules](../../contexts/execution/subagent-spawn-contract.md).

When to delegate at all is [`delegation-policy`](../../rules/delegation-policy.md);
the spawn boundary is the [`subagent-spawn-contract`](../../contexts/execution/subagent-spawn-contract.md).

## Hand-off worked examples

Ordered / fan-out hand-offs embed each step's return **verbatim** in the next prompt and state what to do with it (never "continue from before" — the lossy re-summarization failure). Two worked shapes: [`subagent-spawn-contract` § Hand-off worked examples](../../contexts/execution/subagent-spawn-contract.md).

## Form gate — deterministic, BEFORE mode selection

With auto-dispatch on by default (ADR-117), mode selection happens without
a human in the loop — so the FORM is decided by a static table first, and
only then is the specific mode picked inside that form. Static table only:
no learned routing, no self-modifying selector (rejected, stays rejected).

| Task shape (structural signal) | Form | Modes in the form |
|---|---|---|
| ≥ 2 independent, verifiable slices | parallel | `do-in-parallel`, `do-competitively` |
| Multi-step cross-wing chain needing filesystem isolation | worktrees | `do-in-worktrees` |
| Ordered steps with declared dependencies | steps | `do-in-steps` |
| Single change with non-trivial risk / contested spec / decision | judge | `do-and-judge`, `do-and-judge-two-stage`, `judge-with-debate`, `do-with-live-app-judge` |
| High-risk change needing defect-FINDING coverage (opt-in, advisory) | verify-council | `adversarial-verification-council` (default-off; `subagents.adversarial_council`) |
| Single slice below the delegability floor, unstructured, or frontier-priced | none | no dispatch — run in-session |

Rules:

- The gate consumes the SAME structural signals as
  `auto_dispatch.ts::classifyTask` (slice count, dependency declarations,
  size floor) — it never re-interprets the task text on vibes.
- Ambiguous shape → `none` (in-session), never a speculative spawn — the
  delegation-policy default.
- Record the outcome in the telemetry line (`dispatch_mode` field, mode id
  or `none`) so the gate's value is measurable inside the ADR-117
  prove-or-drop window.

## The nine modes

Each mode has a decision row: when to use, when not, and the expected
model pairing. Defaults come from
[`subagent-configuration`](../../contexts/subagent-configuration.md).

### Topology hints — per-mode communication shape

Descriptive lookup material (per-mode topology table, anti-drift default,
glossary) lives in
[`subagent-topologies`](../../agent-src/contexts/execution/subagent-topologies.md) —
pull it for capacity planning; it is metadata, not runtime-enforced.

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

Mode 6 = **go/no-go** (strict-er verdict wins); for defect-FINDING coverage (the
*union* of what diverse models catch) use Mode 9.

### 7. do-in-worktrees

Cross-wing or cross-skill chain executed across isolated git worktrees —
each handoff runs in its own worktree so one step's workspace state never
leaks into the next. Use for a multi-step cross-wing chain (≥2 senior
skills, each ≥30 min); not for fast iteration under 30 min (overhead
dominates). Full handoff shape, example chain, competitive per-candidate
isolation, and the no-auto-merge Hard Floor →
[`subagent-modes-detail`](../../agent-src/contexts/execution/subagent-modes-detail.md) § Mode 7.

### 8. do-with-live-app-judge (gated — UI-heavy tasks)

Implementer ships the change AND starts the dev server; the judge drives
the RUNNING app (Playwright / browser) against a written rubric, never
reading the diff. Use for UI-heavy change where "looks right in the diff"
≠ "works in the app"; not for backend/logic (a diff judge is cheaper).
Experimental until `verdict_changed_outcome` telemetry proves it. Rubric,
adoption gate, and the async-verifier future candidate →
[`subagent-modes-detail`](../../agent-src/contexts/execution/subagent-modes-detail.md) § Mode 8.

### 9. adversarial-verification-council (gated — opt-in, advisory)

A panel of N (default 2) **distinct-model** skeptics red-teams a real,
already-verified change through the `judge-*` lenses — each prompted to *break*
it. Returns reconcile deterministically
([`_lib/adversarial_reconcile.ts`](../../scripts/_lib/adversarial_reconcile.ts))
into one findings-by-severity envelope with provenance + cross-model confidence
([`schemas/adversarial-findings.json`](schemas/adversarial-findings.json)). Unlike
Mode 6 it emits a **findings-union**, not a go/no-go verdict. **Advisory only —
never auto-gates (Hard Floor).** Default-off (`subagents.adversarial_council`);
opt-in high-risk changes only; registered claim + high-risk tier need
cross-*vendor* skeptics. Invariants, skeptic prompt, reconciliation, prove-or-drop
gate → [`subagent-modes-detail`](../../agent-src/contexts/execution/subagent-modes-detail.md) § Mode 9
+ [`prompts/adversarial-verification-council.md`](prompts/adversarial-verification-council.md)
(ADR-122).

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
nine modes resolves to a loadable prompt that cites all four taxonomy
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

Run the form gate first, then match task shape to one of the nine modes. When two modes could fit,
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

Use the matching dispatch prompt and orchestrate inline via this skill.
Describe each dispatch step explicitly in chat so the user can follow it.

* `do-and-judge` → [`prompts/do-and-judge.md`](prompts/do-and-judge.md)
* `do-and-judge-two-stage` → [`prompts/do-and-judge-two-stage.md`](prompts/do-and-judge-two-stage.md)
* `do-in-steps` → [`prompts/do-in-steps.md`](prompts/do-in-steps.md)
* `do-in-parallel` → [`prompts/do-in-parallel.md`](prompts/do-in-parallel.md)
* `do-competitively` → [`prompts/do-competitively.md`](prompts/do-competitively.md)
* `judge-with-debate` → [`prompts/judge-with-debate.md`](prompts/judge-with-debate.md)
* `do-in-worktrees` → [`prompts/do-in-worktrees.md`](prompts/do-in-worktrees.md)
* `adversarial-verification-council` → [`prompts/adversarial-verification-council.md`](prompts/adversarial-verification-council.md)
* Standalone judge → judge prompt in [`prompts/do-and-judge.md`](prompts/do-and-judge.md)

### 5. Report

Follow the output format below. Never merge a diff without reporting
the judge verdict.

### 6. Emit telemetry

After every auto-dispatched run, write one telemetry line to
`agents/runtime/state/audit/YYYY-MM.jsonl` (current UTC month — use
`new Date().toISOString().slice(0, 7)` to compute the filename).
The line is a standard audit-log-v1 object with `input_kind:
"orchestration"` and an `orchestration` sub-object per
[`orchestration-telemetry.md`](../../agent-src/contexts/execution/orchestration-telemetry.md).

Minimal emit (fill what is observable; `token_delta_provenance: "estimated"` if
host usage metadata is unavailable):

```json
{"schema_version":1,"id":"<ulid>","ts":"<iso>","work_id":"<work_id>","phase":"implement","outcome":"success","confidence_band":"high","risk_class":"low","input_kind":"orchestration","type":"phase","orchestration":{"task_size_estimate":<int>,"spawn_count":<int>,"tiers":[...],"token_delta":<int>,"token_delta_provenance":"estimated","wall_clock_ms":<int>,"outcome":"DONE","verify_mode":"deterministic"}}
```

Skip emit when `subagents.enabled: false` or `spawn_count == 0` (in-session run).

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

1. **Mode chosen** — one of the nine, with the one-line reason
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
| Configuration reference              | [`subagent-configuration`](../../agent-src/contexts/execution/subagent-configuration.md) |
| Do-and-judge loop                    | Inline — see [`prompts/do-and-judge.md`](prompts/do-and-judge.md) |
| Stepwise plan with judge gates       | Inline — see [`prompts/do-in-steps.md`](prompts/do-in-steps.md) |
| Standalone judge on an existing diff | Inline — see judge prompt in [`prompts/do-and-judge.md`](prompts/do-and-judge.md) |
| External / networked second opinion  | [`ai-council`](../ai-council/SKILL.md) |
| Verifying completeness               | [`verify-before-complete`](../verify-before-complete/SKILL.md) |
| What a subagent owns vs never owns   | [`subagent-boundary`](../../../docs/contracts/subagent-boundary.md) |
