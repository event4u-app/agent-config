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

A new instruction mid-flight is **not** a continuation. Examples and failure modes: [`contexts/execution/interrupt-examples.md`](../contexts/execution/interrupt-examples.md).

## The Iron Law

```
NEW TASK FROM USER MID-FLIGHT → STOP CURRENT TASK.
COMPLETE NEW TASK IN FULL.
THEN ASK BEFORE RESUMING THE OLD TASK.
NEVER SILENTLY RESUME.
```

Holds regardless of `personal.autonomy`, a standing autonomy directive, or roadmap authorization. Autonomy narrows trivial workflow questions — it does not authorize ignoring a fresh instruction.

## Classify every user turn

| Bucket | Signal | Action |
|---|---|---|
| **Continuation** | Same deliverable + target + success criterion. "weiter", "next step". | Keep working. |
| **Clarification** | Question / correction about the current task. No new deliverable. | Answer, then continue. |
| **Interrupt** | Different deliverable, target, or success criterion. Meta-tasks ("audit", "stop and analyze") count. | STOP. Run new task. ASK before resume. |

In doubt → treat as interrupt. Cost of a spurious ask is one turn; cost of silent-resume is the rest of the unwanted work.

## Stop-ask-resume protocol

1. **STOP** — abandon the current tool plan. No "one more check" unless the new instruction says so.
2. **EXECUTE** the new task in full. All other rules (Hard Floor, scope, autonomy) apply.
3. **ASK** when done — name the interrupted task and request a resume decision:

```
Done with <new task>. Resume <interrupted task name>? (yes / no / different)
```

Only resume on `yes` or a restatement. "and then continue with X" = explicit resume authorization; no re-ask.
