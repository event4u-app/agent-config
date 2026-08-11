---
stability: beta
keep-beta-until: 2026-08-17
---

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
- **Re-confirm; the subagent's confirmation does not count** — a destructive or irreversible mutation *proposed by a subagent* is subject to the same Hard Floor as one the orchestrator proposed, and the subagent's own "I checked, it's fine" does not satisfy the gate. Without this clause, delegation is a detour around it: ask a subagent, receive a blessing, act.
- **Deliver the floor, do not assume it** — the floor reaches a worker because [`generate_subagent_floor.ts`](../../src/scripts/generate_subagent_floor.ts) writes it into every dispatch prompt and CI fails on drift.

### Honest scope of the floor guarantee

The invariant above — *a subagent cannot do what its parent may not* — is now
**delivered** for subagents dispatched through this package's prompt templates:
the floor is generated from the kernel rules and drift-gated. It was previously
asserted here and carried by nothing; the brief schema, the spawn composer, and
all eight prompt templates contained no floor text at all.

What stays unproven, and is therefore not claimed: whether a subagent spawned by
a host primitive outside these templates inherits any of it. That is a host
property this package does not control and does not test. A contract that
quietly covered it would repeat the exact defect this section exists to close.

## The model ceiling — escalate, never silently degrade

`subagents.model_ceiling` (class C, default `""` —
`src/config/agent-settings.template.yml:795`,
[`settings-classes.md`](settings-classes.md)) caps the model a dispatched worker
may run on. Nothing is capped today, and that is exactly why the behaviour has
to be written down before the first consumer sets one: the cheapest moment to
decide what a capped worker does is while nobody depends on the answer.

```
A WORKER THAT CANNOT CARRY ITS SLICE UNDER THE CEILING ESCALATES.
IT NEVER SILENTLY DELIVERS THE DEGRADED RESULT AS IF IT WERE THE ASKED-FOR ONE.
```

- **The worker returns the escalation, not a lesser answer.** "The ceiling
  cannot carry this slice" is a legitimate return value and is the required one.
  Delivering a weaker result under a ceiling the requester set, without saying
  so, converts a spend control into a silent quality regression — and the
  orchestrator cannot verify what it was not told.
- **The orchestrator decides, and it is the orchestrator's decision alone.** On
  an escalation it may re-slice the task smaller so the ceiling does carry it,
  run the slice in-session, or surface the ceiling to the human. It never raises
  the ceiling itself: `subagents.model_ceiling` is class C, so no agent-reachable
  writer exists — `settings:set` refuses C keys by construction, which is the
  fence rather than a promise.
- **An unset ceiling is not a low one.** The default `""` means *uncapped*, and a
  worker must not read an absent value as permission to downshift. This is the
  absent-is-not-default trap the settings contract already names, applied to the
  one key that decides how good the answer is allowed to be.
- **No cap on the cap.** Per-task-class and dollar caps were considered and cut:
  no over-spend has been observed and nothing is capped today, so a cap would be
  a mechanism without a matched failure mode.

## Failure modes

- A research subagent that, finding the task underspecified, invents a broader task and "helpfully" does it.
- A worker that hits the model ceiling and returns its best degraded attempt as
  the answer, with no escalation — the silent-degrade failure the section above
  exists to forbid.
- A subagent that writes to shared memory / a roadmap dashboard as a side effect.
- A subagent that commits, pushes, or deletes because "the task implied it".
- An orchestrator that pastes a subagent's claim into the answer without verifying it.

## See also

- [`subagent-orchestration`](../../src/skills/subagent-orchestration/SKILL.md) — the dispatch modes this contract bounds.
- [`delegation-policy`](../../src/rules/delegation-policy.md) — the delegate-by-default trigger + verify-every-return Iron Law.
- [`capability-boundary`](capability-boundary.md) — the pack-level companion (this is the agent-level one).
- [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md) — the Hard Floor that applies inside subagents too.
