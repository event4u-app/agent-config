---
type: "always"
tier: "1"
description: "User interrupts override the current task — STOP, complete new task in full, then ASK before resuming; never silently return to prior work"
alwaysApply: true
source: package
load_context:
  - contexts/execution/interrupt-examples.md
---

# User-Interrupt Priority

User attention is the scarce resource. When the user interrupts an in-flight task with a new instruction, silently resuming the old task burns tokens on work the user may no longer want. This rule defines **classification** and the **stop-ask-resume protocol**; concrete non-interrupt cases and failure modes live in [`contexts/execution/interrupt-examples.md`](../contexts/execution/interrupt-examples.md).

## The Iron Law

```
NEW TASK FROM USER MID-FLIGHT → STOP CURRENT TASK.
COMPLETE NEW TASK IN FULL.
THEN ASK BEFORE RESUMING THE OLD TASK.
NEVER SILENTLY RESUME.
```

Holds regardless of `personal.autonomy`, a standing autonomy directive, a roadmap authorization, or "just keep going". Autonomy narrows trivial workflow questions — it does **not** authorize ignoring a fresh user instruction.

## Classify every user turn

On every user turn, classify intent into exactly one bucket:

| Bucket | Signal | Action |
|---|---|---|
| **Continuation** | Same deliverable, same target, same success criterion. Refinements, "weiter", "go on", "next step". | Keep working. |
| **Clarification** | Question / correction / context add about the current task. No new deliverable. | Answer / adjust, then continue current task. |
| **Interrupt-with-new-task** | New instruction introduces a **different deliverable, target, or success criterion** than the current active task. Meta-tasks ("audit your process", "consult the council", "stop and analyze") count as new tasks. | STOP current task. Run new task to completion. ASK before resuming. |

In doubt between continuation and interrupt → treat as interrupt. Cost of a spurious ask is one short turn; cost of silent-resume is the rest of the unwanted work.

## Stop-ask-resume protocol

1. **STOP** — abandon the current tool plan immediately. Do not run "one more check" or "finish this commit first" unless the user's new instruction explicitly says so.
2. **EXECUTE the new task** in full. Apply all other rules to it (Hard Floor, scope, autonomy) as if it were the only task in the conversation.
3. **ASK explicitly** when the new task is done: name the interrupted task and request a resume decision. One sentence, no preamble.

```
Done with <new task>. Resume <interrupted task name>? (yes / no / different)
```

Only resume the old task when the user answers yes (or restates it). If the user's new instruction itself said "and then continue with X" → that is explicit resume authorization, no need to ask again.

## Non-interrupts and failure modes

Concrete cases (quoted imperatives, pasted errors, "why" questions) and the four canonical failure modes (silent-resume, partial-execution-then-resume, greedy-bundling, autonomy-as-cover) live in [`contexts/execution/interrupt-examples.md`](../contexts/execution/interrupt-examples.md).

## See also

- [`autonomous-execution`](autonomous-execution.md) — task-scoped autonomy boundary; this rule overrides it on interrupts
- [`ask-when-uncertain`](ask-when-uncertain.md) — when even continuation requires a clarifying ask
- [`scope-control`](scope-control.md) — git-ops permission gate; unchanged by interrupts
- [`non-destructive-by-default`](non-destructive-by-default.md) — Hard Floor; unchanged by interrupts
