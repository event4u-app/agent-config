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

## Validation-loop budget — hard cap N=3 per target

**Validation target** = a single identifiable artefact (file path, lint rule ID, test name, CI sub-task name) — natural-language clusters ("the linter stuff") don't count.

```
3 CONSECUTIVE FAILED ATTEMPTS ON THE SAME VALIDATION TARGET → STOP.
SURFACE THE 3 ATTEMPTS + BLOCKING ISSUE. ASK USER FOR GUIDANCE.
DO NOT ITERATE BEYOND N=3 WITHOUT EXPLICIT USER APPROVAL.
COUNTER RESETS ONLY ON A DIFFERENT TARGET OR USER-APPROVED CONTINUATION.
```

Failed attempt = an iteration that did not move the target red → green; tuning the tool around the target counts as an attempt.

### Antipattern — allowlist-growth as silent budget bypass

```
ALLOWLIST > 20 ENTRIES IN ONE SESSION = THE LINTER IS WRONG.
STOP. PROPOSE LINTER REDESIGN OR REMOVAL. DO NOT EXPAND THE ALLOWLIST FURTHER.
```

Crossing 20 entries counts as the 3rd validation-target failure — fix the tool shape, not the list. Enforced at tool-call time by the `block-config-weakening` PreToolUse guard (`src/scripts/hooks/block_config_weakening.ts`) **on `claude`, the one host that both binds `pre_tool_use` and honours a deny**: it counts allowlist entries added per session, warns from 5, and blocks past 20. It is *bound* on augment and cowork as well, and ignored there — `host_semantics.ts` verifies claude alone, and both trampolines discard dispatcher output and `exit 0` unconditionally. Everywhere else the cap is model-carried and "enforced at tool-call time" is not a claim this rule can make. **Corrected 2026-08-17 in both directions:** this sentence used to certify augment, claude and cowork as the enforcing set (an over-claim of two hosts) and to explain the rest with "the guard has nowhere to bind" (false for cursor, cline and gemini, whose native pre-tool events `native_event_aliases` already maps onto `pre_tool_use` — unbound, not unbindable; only windsurf and copilot carry no pre-tool alias row here). The four states are tabulated once in [`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../docs/contracts/hook-architecture-v1.md). Run `agent-config hooks:status` to see which slots are bound on the host you are actually on — the sibling rules `git-history-discipline` and `evaluator-independence` qualify the identical slot, and an unqualified claim here would read as a guarantee the manifest does not give. Baselines and budget thresholds warn only — a rising count there may be a legitimate ratchet reset, which the edit alone cannot distinguish. Verify with the narrowest tool that proves the target green (a single `curl` / Playwright spec for HTTP/UI, the test runner with a `--filter`, an `xdebug` step-through) — never a meta-pipeline as per-iteration probe. Failed-attempt detail, suppression-sweep equivalents, probe-efficiency detail, and adaptive effort & stop (RDP): [`autonomy-mechanics § Validation-loop budget`](../contexts/execution/autonomy-mechanics.md).

Body migrated to `contexts/execution/autonomy-mechanics.md` (per P4 of `road-to-kernel-and-router.md`) — opt-in detection summary, task-scope shapes table, N=3 mechanics, allowlist-antipattern detail, probe efficiency, adaptive effort (RDP).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`user-interrupt-priority`](user-interrupt-priority.md) — STOP-ASK-RESUME on new tasks; overrides autonomy
- [`non-destructive-by-default`](non-destructive-by-default.md) — universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent floor against context-derived asks
- [`commit-policy`](commit-policy.md) — never-commit / never-ask Iron Law
- [`/commit:in-chunks`](../commands/commit/in-chunks.md), [`/commit`](../commands/commit.md)
