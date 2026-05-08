---
type: "auto"
tier: "3"
description: "Whether to ask or act on a workflow step — trivial-vs-blocking, autonomy opt-in, commit default; Hard Floor in non-destructive-by-default"
alwaysApply: false
source: package
load_context:
  - ../contexts/execution/autonomy-detection.md
  - ../contexts/execution/autonomy-mechanics.md
  - ../contexts/execution/autonomy-examples.md
triggers:
  - intent: "trivial workflow question"
  - intent: "autonomy mode"
  - keyword: "personal.autonomy"
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

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
