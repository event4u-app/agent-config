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
* Budget is the constraint — each subagent call multiplies cost; non-interactive bulk cohorts → batch/caching via the [`token-optimizer`](../token-optimizer/SKILL.md) index branch
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

### Always-on auto-dispatch

"By default" is governed by the [`delegation-policy`](../../rules/delegation-policy.md)
rule — the single source of the auto-trigger. It gates on the activation context
([`auto-orchestration-activation`](../../contexts/execution/auto-orchestration-activation.md)):
dispatch only when `emergency.orchestration_halt` is not set, the host
manifest reports `subagent_spawn: true`, and the task is classified delegable.
A matched signal → dispatch, surfacing mode + per-subtask tiers in one line;
an ambiguous verdict → ask, always; any gate failing → in-session no-op.
There is no more per-layer on/off setting (always-on orchestration). Never
lifts a safety floor.

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
- **Fork vs. named subagent — an ordering, never a default (road-to-cache-economy
  Phase 4).** On a host that offers a fork primitive, decide fork-vs-named
  ORTHOGONALLY to the form picked above: tool and scope fit is first-order,
  cache inheritance is second-order. A fork is preferred only when the child
  continues the parent's task under identical tools and constraints (it then
  reads the parent's cache on its first request); a named subagent is
  preferred the moment isolation, a different tool set, or nested dispatch is
  needed — a fork cannot nest, and forking forces background mode, which
  changes the tool set and invalidates the very prefix that motivated the
  fork. `do-in-parallel`-shaped fan-out from one parent has this shape by
  construction (a known, unfixable upstream cost — see
  [`prompts/README.md`](prompts/README.md) § Prompt-cache discipline). NEVER
  encode "always fork" — that was proposed and cut (council 2026-07-30):
  the cache-sharing benefit cannot be predicted before the fork happens.
- Record the outcome in the telemetry line (`dispatch_mode` field, mode id
  or `none`) so the gate's value is measurable inside the ADR-117
  prove-or-drop window.

## Severity-conditioned team composition — conditions pattern

Incident-style severity tiers (Critical / High / Medium / Low) refine
composition and activation **within** the form the static gate already
picked — severity never overrides the form gate, the Iron Law, or any
safety floor. Guidance, not a new object class (persona-catalog
disposition). Severity→composition table + escalation rule →
[`subagent-modes-detail` § Severity-conditioned team composition](../../agent-src/contexts/execution/subagent-modes-detail.md).

## The nine modes

Each mode has a decision row: when to use, when not, and the expected
model pairing. Defaults come from
[`subagent-configuration`](../../contexts/subagent-configuration.md).

### Topology hints — per-mode communication shape

Descriptive lookup material (per-mode topology table, anti-drift default,
glossary) lives in
[`subagent-topologies`](../../agent-src/contexts/execution/subagent-topologies.md) —
pull it for capacity planning; it is metadata, not runtime-enforced.

Per-mode decision rows (when to use / when not / model pairing) and the
mode-2 stage-routing contract live in
[`subagent-modes-detail` § Modes 1–6](../../agent-src/contexts/execution/subagent-modes-detail.md) —
pull them at dispatch time.

### 1. do-and-judge

Implementer produces a diff; judge reviews; loop applies, revises, or
hands off. Hard ceiling: **two revision cycles**, then stop and hand
back to the user.

### 2. do-and-judge-two-stage

Implementer produces a diff; **two judges run sequentially** — spec
compliance first, code quality second. Stage-one `BLOCKED` shortcuts the
loop (no point quality-reviewing a diff that misses the spec). Stage
routing + why-two-stages rationale → modes-detail § Mode 2.

### 3. do-in-steps

Plan is split into N steps; judge runs **between** steps. A step that
fails judgment is revised before the next step starts. Used for
multi-file changes where a mid-plan mistake would cascade.

### 4. do-in-parallel

Independent slices run concurrently. No judge per slice — judge runs
once on the aggregated result. Parallelism capped by
`subagents.max_parallel` in `.agent-settings.yml`.

### 5. do-competitively

Multiple implementers produce candidate diffs for the **same** slice.
Judge picks the winner and rejects the losers. Expensive — use only
when the solution space is genuinely broad.

### 6. judge-with-debate

Two judges each produce a verdict; a meta-judge reconciles
disagreements. Used for high-stakes changes (security, data
migration, public API) where a single judge is too easy to fool.

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

> **Disposition (2026-07-28, honest null).** The adversarial-council finding-
> coverage benchmark resolved as a published null (see `docs/benchmark.md`) —
> this mode is NOT sold as a defect-detection capability. It stays default-off
> bound to that null; scheduled for removal at the next major unless external
> evidence (a consumer-filed case where the panel surfaced a real defect the
> single verifier missed) appears first. Its remaining honest value is
> perspective diversity + decision documentation, nothing more.
(ADR-122).

## Status taxonomy — every subagent return uses one envelope

Every implementer or judge return must conform to
[`schemas/subagent-status.json`](schemas/subagent-status.json). Exactly
four statuses — `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` ·
`BLOCKED` — no free-form alternatives; orchestrators route on status
mechanically. Meaning/required-keys table, why-fixed rationale, and the
`NEEDS_CONTEXT`-vs-`BLOCKED` distinction →
[`subagent-modes-detail` § Status taxonomy](../../agent-src/contexts/execution/subagent-modes-detail.md).

**The envelope is the ONLY return channel** (token-economy-dispatch
Phase 6). A worker writes its full output to disk (runtime artifact dir,
gitignored) and returns the bounded envelope — `summary` +
`artifact_paths` + verdict, size caps validator-enforced
(`_lib/subagent_response.ts`: summary ≤ 2,000 chars, whole envelope
≤ 12,000). The orchestrator reads FROM the artifact paths on demand —
never instructs a worker to paste its full result into the return, and
never ingests a transcript-shaped return wholesale: dispatching N workers
grows the orchestrator context by N envelopes, not N transcripts.

## Dispatch prompts — externalized

Each mode's literal dispatch template lives under
[`prompts/{mode}.md`](prompts/README.md). The orchestrator loads the
matching prompt at dispatch time and substitutes `{{placeholders}}`.
Edits to a prompt do not bloat this skill against the 400-line sunset
trigger. Eight prompt files cover modes 1–7 and 9 (the standalone judge
reuses [`prompts/do-and-judge.md`](prompts/do-and-judge.md); mode 8's
live-app rubric lives in
[`subagent-modes-detail` § Mode 8](../../agent-src/contexts/execution/subagent-modes-detail.md));
each prompt cites all four taxonomy statuses — see
[`prompts/README.md`](prompts/README.md).

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

**Mode 6 (`do-in-worktrees`) is instruction-only** (ADR-229). There is no
setting to resolve — `worktrees.mode` was deleted:

| Situation | Mode 6 |
|---|---|
| The user asked for a worktree chain in the chat ("do this in a worktree", "use mode 6") | Eligible. Proceed via [`using-git-worktrees`](../using-git-worktrees/SKILL.md); the request is the permission, so there is no further ask. |
| Anything else | **Not eligible**, however well the chain shape fits. Fall back to mode 3 (`do-in-steps`) — the same step-by-step chain, in place on the current branch. Do not offer mode 6 as an option. |

Because mode 6 is unreachable unprompted, it is effectively off the
cheapness ladder above unless the user named it; read that ordering as
covering modes 1–8 in the default case.

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

After every auto-dispatched run, write one audit-log-v1 line
(`input_kind: "orchestration"`) via the `orchestration_record` recorder —
never hand-author the JSON. Line shape, field semantics, recorder
invocation, and `token_delta` sourcing priority →
[`orchestration-telemetry` § Emit procedure](../../agent-src/contexts/execution/orchestration-telemetry.md).
Skip emit when `emergency.orchestration_halt` is set or `spawn_count == 0`
(in-session run).

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
| Cross-model review WITH repo access   | [`/team`](../../domains/meta/team/command.md) (collaborative; subagents are in-session same-weights) |
| Verifying completeness               | [`verify-completion-evidence`](../verify-completion-evidence/SKILL.md) |
| What a subagent owns vs never owns   | [`subagent-boundary`](../../../docs/contracts/subagent-boundary.md) |
