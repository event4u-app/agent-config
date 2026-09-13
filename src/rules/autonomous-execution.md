---
type: "auto"
tier: "3"
description: "Ask-or-act on a workflow step — trivial-vs-blocking, autonomy opt-in, commit default; Hard Floor stays"
alwaysApply: false
load_context:
  - contexts/execution/autonomy-detection.md
  - contexts/execution/autonomy-mechanics.md
  - contexts/execution/autonomy-examples.md
triggers:
  - keyword: "personal.autonomy"
  - phrase: "autonomy mode"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
# obligation: line 4
obligation_frequency: "per-turn"
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are noise. This rule defines **trivial** (just act), **blocking** (still ask), the **hard floor** (always ask, no override), and the **commit default** (never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

The universal safety floor (production-branch merges, deploys, pushes, prod data/infra, whimsical bulk deletions, and commits containing bulk deletions or infra changes) is governed by the canonical [`non-destructive-by-default`](non-destructive-by-default.md) rule. It applies regardless of `personal.autonomy`, a standing autonomy directive, or any roadmap authorization. Nothing in **this** rule lifts it. If a trigger fires, stop and ask — every other section below assumes the floor has already been cleared.

## Setting — `personal.autonomy`

Three values: `on` (suppress trivial questions), `off` (ask trivial questions too), `auto` (default — same as `off` until the user opts in via a standing autonomy directive). Read once on the first turn and cache. Missing key → treat as `auto` (fail-closed, same as the shipped default; only the explicit cloud carve-out — no settings file at all — degrades to `on`). Full table, semantics, and cloud behavior: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md).

## Opt-in detection — match by intent, not exact string

In `auto` mode, flip to `on` when the user expresses **"stop asking on trivial steps, just work"** — matched by intent, speech-act-checked, reversible; in doubt → no speculative flips. Algorithm: [`contexts/execution/autonomy-detection.md`](../contexts/execution/autonomy-detection.md); summary + anchor phrases + taxonomy: [`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md) + [`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).

## Task-scope — autonomy is bound to the named task

```
A STANDING AUTONOMY DIRECTIVE TIED TO A NAMED DELIVERABLE
DOES NOT CARRY OVER TO A DIFFERENT, LATER DELIVERABLE.
NEW TASK → FRESH CONFIRMATION.
```

Litmus: does the directive name a single concrete deliverable? Yes → task-scoped, ends with the deliverable; no → conversation-wide trivial-question suppression only. Shapes table, re-confirmation triggers, and the in-doubt default: [`autonomy-mechanics § Task-scope`](../contexts/execution/autonomy-mechanics.md).

## User interrupts override the current task

A new instruction from the user mid-flight is **not** a continuation — see [`user-interrupt-priority`](user-interrupt-priority.md) for the mandatory STOP → run new task → ASK before resume protocol. Autonomy never authorizes silent-resume of the prior task.

## Validation-loop budget — `execution.fix_loop_max`, default 10, and a ladder

**Validation target** = a single identifiable artefact (file path, lint rule ID, test name, CI sub-task name) — natural-language clusters ("the linter stuff") don't count.

```
THE BOUND TRIGGERS A STRATEGY CHANGE, NEVER A QUESTION.
ATTEMPTS 1-3 — ROOT-CAUSE PLUS A TARGETED FIX.
ATTEMPTS 4-6 — A MANDATORY STRATEGY SHIFT. REPEATING THE APPROACH IS NOT AN ATTEMPT,
IT IS THE SAME ATTEMPT AGAIN.
ATTEMPTS 7-10 — ESCALATE INDEPENDENTLY: A SECOND SESSION, A PROVIDER-DIVERSE
REVIEWER, THE COUNCIL, THE TEAM, OR A ROLLBACK OF THE SLICE.
AT THE BOUND, IN ORDER: A NEW STRATEGY FROM THE ESCALATION → A NEW EPOCH ·
AN INDEPENDENT PHASE AVAILABLE → CONTINUE IT · THE RESIDUE OWNER-OWNED →
ONE NATIVE ASK · AN EXTERNAL PREREQUISITE OBJECTIVELY MISSING → `BLOCKED`
WITH EVIDENCE · OTHERWISE → A NEW EPOCH.
NO RUNG MAPS A COUNT TO AN OWNER ASK. A COUNT IS NOT A REASON TO ASK.
```

Failed attempt = an iteration that did not move the target red → green; tuning the tool around the target counts as one. The bound is `execution.fix_loop_max` (default 10, overridable globally, per project and per prompt). Council and team verdicts append to the run's `## Decisions`. Bands, the five bound outcomes and how to read a red: [`autonomy-mechanics § Validation-loop budget`](../contexts/execution/autonomy-mechanics.md).

### Antipattern — allowlist-growth as silent budget bypass

```
ALLOWLIST > 20 ENTRIES IN ONE SESSION = THE LINTER IS WRONG.
STOP. PROPOSE LINTER REDESIGN OR REMOVAL. DO NOT EXPAND THE ALLOWLIST FURTHER.
```

Crossing 20 entries spends the whole fix-loop bound for that target at once — fix the tool shape, not the list. Carried by the `block-config-weakening` PreToolUse guard, which blocks **on `claude` only** and is model-carried everywhere else; run `agent-config hooks:status` for the host you are on. Verify with the narrowest tool that proves the target green — never a meta-pipeline as per-iteration probe. Host reach, failed-attempt detail, suppression-sweep equivalents and adaptive effort (RDP): [`autonomy-mechanics § Validation-loop budget`](../contexts/execution/autonomy-mechanics.md).

Body migrated to `contexts/execution/autonomy-mechanics.md` (per P4 of `road-to-kernel-and-router.md`) — opt-in detection summary, task-scope shapes table, fix-loop bound and epoch mechanics, allowlist-antipattern detail, probe efficiency, adaptive effort (RDP).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`user-interrupt-priority`](user-interrupt-priority.md) — STOP-ASK-RESUME on new tasks; overrides autonomy
- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
