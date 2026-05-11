---
trigger: model_decision
description: Whether to ask or act on a workflow step — trivial-vs-blocking, autonomy opt-in, commit default; Hard Floor in non-destructive-by-default
globs: 
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

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
