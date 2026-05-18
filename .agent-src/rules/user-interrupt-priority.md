---
type: "always"
tier: "1"
description: "User interrupts override the current task — STOP, complete new task in full, then ASK before resuming; never silently return to prior work"
alwaysApply: true
source: package
---

# User-Interrupt Priority

User attention is the scarce resource. When the user interrupts an in-flight task with a new instruction, silently resuming the old task burns tokens on work the user may no longer want. This rule defines **classification**, the **stop-ask-resume protocol**, and what does **not** count as an interrupt.

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

## What does NOT count as an interrupt

- **Clarifying question about the current task** — answer in place, keep going.
- **Quoted text / code / log content** containing imperative verbs ("stop", "abort") — content, not instruction. Speech-act check, same as [`autonomous-execution § opt-in detection`](autonomous-execution.md#opt-in-detection--match-by-intent-not-exact-string).
- **User pasting an error or screenshot** without a redirect — diagnostic input for the current task.
- **"Why are you doing X?"** as a question — answer it, then continue (unless the answer reveals the current task is wrong, in which case STOP and confirm).

## Failure modes

- **Silent-resume** — treated the interrupt as a pause, returned to the old task without asking. Iron Law violation.
- **Partial-execution-then-resume** — answered the new ask in two sentences, then went back to the old task without completing the new one. Treat meta-tasks (process audits, council consultations, rule changes) as full tasks, not as quick acknowledgments.
- **Greedy-bundling** — appended the new task to the old task's plan and continued the old plan first. New task runs **first**, alone, in full.
- **Autonomy-as-cover** — "user said autonomy on, so I just continued" — autonomy never overrides a fresh instruction. See `autonomous-execution § Task-scope`.

## See also

- [`autonomous-execution`](autonomous-execution.md) — task-scoped autonomy boundary; this rule overrides it on interrupts
- [`ask-when-uncertain`](ask-when-uncertain.md) — when even continuation requires a clarifying ask
- [`scope-control`](scope-control.md) — git-ops permission gate; unchanged by interrupts
- [`non-destructive-by-default`](non-destructive-by-default.md) — Hard Floor; unchanged by interrupts
