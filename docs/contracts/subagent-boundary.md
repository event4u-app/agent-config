# Subagent Boundary Contract

What a subagent **owns** and what it must **never** own. As delegation spreads
(the `subagent-orchestration` modes, the `delegation-policy` auto-trigger,
workflow fan-out), the failure mode is scope drift: a subagent quietly
redefining the task, expanding scope, or bypassing a floor. This contract draws
the line.

## The ownership line

A subagent **executes one scoped, named task and returns a conclusion.** That is
the whole of its authority.

### A subagent OWNS

- **Its scoped task** — the single, well-specified slice it was dispatched with.
- **Its method** — how it searches, reads, reasons, or drafts within that slice.
- **Its return** — a conclusion + evidence, sized to what the orchestrator asked for (structured output when a schema was given).

> **Explainability is durable, not host-ephemeral.** The return must carry a brief
> *why + evidence* (which sources/steps led to the conclusion) **in the artefact /
> output itself**, not only in the host's session reasoning. A user opening the
> result later — possibly across sessions — must be able to trace the *why* without
> reassembling provider chat logs. This is the reasoning-in-notes discipline applied
> to delegation: conclusions + evidence travel with the output, raw chain-of-thought
> does not.

### A subagent must NEVER own

- **Task meaning** — it does not redefine, broaden, or reinterpret the parent task. An ambiguous slice returns "ambiguous + why", it does not guess a bigger task.
- **Cross-task memory / state** — it does not write durable memory, mutate shared roadmaps, or persist decisions for other tasks; its output is its only channel.
- **Pack / surface decisions** — it does not decide what ships, what installs, or what a pack contains; those are orchestrator + human calls.
- **Safety-floor bypass** — every floor applies *inside* the subagent. The Hard Floor ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)), the domain safety floors, [`scope-control`](../../src/rules/scope-control.md), and [`commit-policy`](../../src/rules/commit-policy.md) are not lifted by being one level down. A subagent cannot do what its parent may not.
- **Silent scope expansion** — touching files / systems beyond its slice is a contract violation, surfaced, not absorbed.

## Orchestrator obligations (the other side)

- **Verify, never adopt blind** — a subagent return is evidence, not truth; the orchestrator verifies per [`delegation-policy`](../../src/rules/delegation-policy.md)'s Iron Law before adopting it.
- **Tier-size the slice, not the agent** — dispatch at the slice's complexity, not the session's.
- **Own the safety decision** — a Hard-Floor or egress action surfaced by a subagent is decided by the orchestrator + human, never executed by the subagent.

## Failure modes

- A research subagent that, finding the task underspecified, invents a broader task and "helpfully" does it.
- A subagent that writes to shared memory / a roadmap dashboard as a side effect.
- A subagent that commits, pushes, or deletes because "the task implied it".
- An orchestrator that pastes a subagent's claim into the answer without verifying it.

## See also

- [`subagent-orchestration`](../../src/skills/subagent-orchestration/SKILL.md) — the dispatch modes this contract bounds.
- [`delegation-policy`](../../src/rules/delegation-policy.md) — the delegate-by-default trigger + verify-every-return Iron Law.
- [`capability-boundary`](capability-boundary.md) — the pack-level companion (this is the agent-level one).
- [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md) — the Hard Floor that applies inside subagents too.
