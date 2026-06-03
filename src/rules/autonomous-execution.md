---
type: "auto"
tier: "3"
description: "Whether to ask or act on a workflow step — trivial-vs-blocking, autonomy opt-in, commit default; Hard Floor non-destructive-by-default"
alwaysApply: false
load_context:
  - contexts/execution/autonomy-detection.md
  - contexts/execution/autonomy-mechanics.md
  - contexts/execution/autonomy-examples.md
triggers:
  - intent: "trivial workflow question"
  - intent: "autonomy mode"
  - keyword: "personal.autonomy"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are noise. This rule defines **trivial** (just act), **blocking** (still ask), the **hard floor** (always ask, no override), and the **commit default** (never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

The universal safety floor (production-branch merges, deploys, pushes, prod data/infra, whimsical bulk deletions, and commits containing bulk deletions or infra changes) is governed by the canonical [`non-destructive-by-default`](non-destructive-by-default.md) rule. It applies regardless of `personal.autonomy`, a standing autonomy directive, or any roadmap authorization. Nothing in **this** rule lifts it. If a trigger fires, stop and ask — every other section below assumes the floor has already been cleared.

## Setting — `personal.autonomy`

Three values: `on` (suppress trivial questions), `off` (ask trivial questions too), `auto` (default — same as `off` until the user opts in via a standing autonomy directive). Read once on the first turn and cache. Missing key → treat as `on`. Full table, semantics, and cloud behavior: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md).

## Opt-in detection — match by intent, not exact string

In `auto` mode, flip to `on` for the rest of the conversation when the user expresses **"stop asking on trivial steps, just work"**. Recognize **intent**, not the literal substring. Opt-out (same intent, reversed) flips back to `off`. Both directions are **speech-act-checked**: the phrase must be a meta-instruction to the agent, not content / quote / subject / code / third-party reference / hypothetical. In doubt → keep current mode, no speculative flips.

Algorithm and speech-act heuristic: [`contexts/execution/autonomy-detection.md`](../contexts/execution/autonomy-detection.md). Anchor phrases (DE+EN), no-flip patterns, counter-examples, trivial-vs-blocking taxonomy, commit-policy summary, and named failure modes: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md) + [`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).

## Task-scope — autonomy is bound to the named task

```
A STANDING AUTONOMY DIRECTIVE TIED TO A NAMED DELIVERABLE
DOES NOT CARRY OVER TO A DIFFERENT, LATER DELIVERABLE.
NEW TASK → FRESH CONFIRMATION.
```

Two distinct autonomy shapes — keep them apart:

| Shape | Trigger | Scope |
|---|---|---|
| **Conversation-wide trivial-question suppression** | "stop asking on trivial steps, just work" — no deliverable named. | Sticky for the rest of the conversation. Suppresses trivial workflow questions only; never lifts blocking, Hard Floor, or [`scope-control`](scope-control.md) gates. |
| **Task-scoped autonomous execution** | "work autonomously on X", "arbeite die Roadmap Y komplett ab", "do PROJ-123 end-to-end" — a deliverable / artifact / ticket is named. | Bound to **that** task. Ends when the task ends. Does **not** authorize starting a new, distinct task autonomously. |

Litmus test: does the directive name (or unambiguously point to) a single concrete deliverable? Yes → task-scoped, scope ends with the deliverable. No → conversation-wide, trivial-question suppression only.

When the user later issues a **new** request — different ticket, different roadmap, different artifact, different feature — treat it as a fresh task. Re-confirm autonomy for the new scope before:

- creating a branch / worktree / PR / tag for the new work,
- implementing a roadmap whose **authoring** was the prior turn's deliverable (per [`scope-control § authoring vs implementation`](scope-control.md#authoring-vs-implementation--verb-discipline)),
- expanding scope beyond the new task's literal ask.

In doubt whether the new request inherits or needs fresh confirmation → fresh confirmation. The Hard Floor and [`scope-control`](scope-control.md) gates apply to every task regardless.

## User interrupts override the current task

A new instruction from the user mid-flight is **not** a continuation — see [`user-interrupt-priority`](user-interrupt-priority.md) for the mandatory STOP → run new task → ASK before resume protocol. Autonomy never authorizes silent-resume of the prior task.

## Validation-loop budget — hard cap N=3 per target

Autonomous flows must not iterate indefinitely on the same validation target. **Validation target** = a single identifiable artefact: a file path, a lint rule ID, a test name, a CI sub-task name. Natural-language clustering ("the linter stuff") does **not** count as a target — agents will rename their way out of the budget.

```
3 CONSECUTIVE FAILED ATTEMPTS ON THE SAME VALIDATION TARGET → STOP.
SURFACE THE 3 ATTEMPTS + BLOCKING ISSUE. ASK USER FOR GUIDANCE.
DO NOT ITERATE BEYOND N=3 WITHOUT EXPLICIT USER APPROVAL.
COUNTER RESETS ONLY ON A DIFFERENT TARGET OR USER-APPROVED CONTINUATION.
```

A "failed attempt" is an iteration that did not move the target from red to green. Tuning the tool around the target (e.g. growing an allowlist, loosening a threshold, suppressing a check) counts as an attempt — and is usually a sign the **tool**, not the content, is wrong.

### Antipattern — allowlist-growth as silent budget bypass

```
ALLOWLIST > 20 ENTRIES IN ONE SESSION = THE LINTER IS WRONG.
STOP. PROPOSE LINTER REDESIGN OR REMOVAL. DO NOT EXPAND THE ALLOWLIST FURTHER.
```

Crossing the 20-entry threshold counts as the 3rd validation-target failure for the linter in question, regardless of prior attempt count. The fix is a tool-shape change (heuristic tightening, scope narrowing, deletion), not more entries. Same logic for: warning-suppression lists growing past ~20, `// noqa` / `# type: ignore` sweeps over many files in one session, test `skip` / `xfail` bulk-adds to chase green.

### Probe efficiency — direct over orchestration

When validating a single target, run the **specific** check, not a meta-task that fans out to dozens of sub-tasks. Use the failing tool's direct entry point (the specific script invocation, the specific runner target, the single-test filter for the project's test runner) rather than the full CI meta-pipeline. Full-pipeline runs are appropriate at phase boundaries, not as a per-iteration probe.

Concrete tool mapping — verify with the narrowest tool that proves the target green: a single `curl` / Playwright spec / browser run for HTTP behavior, the project's test runner with a `--filter` for one test, a debugger / `xdebug` step-through for one frame. Never substitute a meta-pipeline for a tool that pinpoints the failure.

## See also

- [`user-interrupt-priority`](user-interrupt-priority.md) — STOP-ASK-RESUME on new tasks; overrides autonomy
- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
