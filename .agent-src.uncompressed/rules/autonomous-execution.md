---
type: "auto"
description: "Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/execution/autonomy-detection.md
  - .agent-src.uncompressed/contexts/execution/autonomy-mechanics.md
  - .agent-src.uncompressed/contexts/execution/autonomy-examples.md
---

# Autonomous Execution

User's time is the scarce resource. Trivial workflow questions are
noise. This rule defines **trivial** (just act), **blocking** (still
ask), the **hard floor** (always ask, no override), and the **commit
default** (never commit, never ask — review-first by design).

## Hard Floor — see [`non-destructive-by-default`](non-destructive-by-default.md)

The universal safety floor (production-branch merges, deploys, pushes,
prod data/infra, whimsical bulk deletions, and commits containing
bulk deletions or infra changes) is governed by the canonical
[`non-destructive-by-default`](non-destructive-by-default.md) rule.
It applies regardless of `personal.autonomy`, a standing autonomy
directive, or any roadmap authorization. Nothing in **this** rule
lifts it. If a trigger fires, stop and ask — every other section
below assumes the floor has already been cleared.

## Setting — `personal.autonomy`

Three values: `on` (suppress trivial questions), `off` (ask trivial
questions too), `auto` (default — same as `off` until the user opts
in via a standing autonomy directive). Read once on the first turn
(per [`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules))
and cache. Missing key → treat as `on`. Full table, semantics, and
cloud behavior:
[`contexts/execution/autonomy-mechanics.md`](../contexts/execution/autonomy-mechanics.md).

## Opt-in detection — match by intent, not exact string

In `auto` mode, flip to `on` for the rest of the conversation when
the user expresses **"stop asking on trivial steps, just work"**.
Recognize **intent**, not the literal substring. Opt-out (same intent,
reversed) flips back to `off`. Both directions are
**speech-act-checked**: the phrase must be a meta-instruction to the
agent, not content / quote / subject / code / third-party reference /
hypothetical. In doubt → keep current mode, no speculative flips.

Algorithm and speech-act heuristic:
[`contexts/execution/autonomy-detection.md`](../contexts/execution/autonomy-detection.md).
Anchor phrases (DE+EN), no-flip patterns, counter-examples:
[`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).

## Trivial — JUST ACT, do not ask

In `personal.autonomy: on` or `auto`-after-opt-in, do not ask
trivial workflow questions — pick the obvious next step and proceed.
In `personal.autonomy: off`, ask them. Worked cases:
[`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).

## Blocking — STILL ASK regardless of `personal.autonomy`

Beyond the Hard Floor above, the autonomy setting also never
overrides:

- **Vague-request triggers** in [`ask-when-uncertain`](ask-when-uncertain.md)
  — ambiguous requirements stay ambiguous; pick-one-and-pray is wrong.
- **Architectural / structural choices** that the codebase doesn't
  already settle (multi-stack picks, library introductions).
- **Security-sensitive paths** — see [`security-sensitive-stop`](security-sensitive-stop.md).
- **Scope expansion** beyond the stated task — see [`scope-control`](scope-control.md).
- **Remote-state operations** — push, merge, rebase, force-push,
  branch create/delete/switch, PR create/close/retarget, tag/release.
  Permission-gated by [`scope-control`](scope-control.md); the
  prod-trunk and deploy-tied subset is governed by
  [`non-destructive-by-default`](non-destructive-by-default.md).
- **Destructive ops** — see [`non-destructive-by-default`](non-destructive-by-default.md)
  for the full taxonomy (whimsical bulk deletions, content
  destruction, commits containing bulk deletions or infra changes).

When in doubt whether something is trivial or blocking → it is
blocking. Ask.

## Commit policy — see [`commit-policy`](commit-policy.md)

Committing is governed by the canonical [`commit-policy`](commit-policy.md)
rule, which applies regardless of `personal.autonomy`. Summary:

- NEVER commit unless user said so this turn, a commit command was
  invoked, a standing instruction is active, or the roadmap authorizes it.
- NEVER ask about committing. The user invokes a command or says so.
- In autonomous mode, the **only** permitted commit-related question is
  the one-shot pre-scan ask at the start of roadmap execution.

Push, merge, rebase, branch creation, PR operations, and tags remain
permission-gated by [`scope-control`](scope-control.md#git-operations--permission-gated).

## Failure modes

Autonomy-side wrong-behavior patterns (sequencing-only asks, CI-run
asks, commit asks, no-trade-off option blocks, re-asking after a
standing opt-in):
[`contexts/execution/autonomy-examples.md`](../contexts/execution/autonomy-examples.md).
For Hard-Floor failure modes see
[`non-destructive-by-default`](non-destructive-by-default.md#failure-modes).

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) —
  universal safety floor; never overridden by autonomy
- [`scope-control`](scope-control.md) — git-ops permission gate
  (push/merge/branch/PR/tag stays explicit)
- [`ask-when-uncertain`](ask-when-uncertain.md) — vague-request
  triggers that always require asking
- [`no-cheap-questions`](no-cheap-questions.md) — mode-independent
  floor against context-derived, sequencing-only, and
  Iron-Law-violating asks (applies in `off` and pre-opt-in `auto` too)
- [`direct-answers`](direct-answers.md) — Iron Laws on brevity and
  no-flattery (this rule extends to no-trivial-questions)
- [`/commit:in-chunks`](../commands/commit/in-chunks.md) — auto-split and commit without confirmation
- [`/commit`](../commands/commit.md) — split and commit with confirmation
