---
type: "auto"
tier: "2a"
description: "New user instruction mid-flight — STOP the current task, run the new one in full, ASK before resuming"
alwaysApply: false
triggers:
  - intent: "new instruction while a task is running"
  - keyword: "weiter"
  - keyword: "resume"
  - keyword: "continue"
  - phrase: "stop that"
  - phrase: "mach stattdessen"
  - command: "work"
  - command: "roadmap:process-full"
  - command: "roadmap:process-phase"
  - command: "implement-ticket"
load_context:
  - ../contexts/execution/interrupt-examples.md
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
---

# User-Interrupt Priority

A new instruction mid-flight is **not** a continuation. Examples + failure modes: [`interrupt-examples`](../contexts/execution/interrupt-examples.md).

## The Iron Law

```
NEW TASK FROM USER MID-FLIGHT → STOP CURRENT TASK.
COMPLETE NEW TASK IN FULL.
THEN ASK BEFORE RESUMING THE OLD TASK.
NEVER SILENTLY RESUME.
```

Holds regardless of `personal.autonomy`, standing autonomy directives, or roadmap authorization. Autonomy narrows trivial workflow questions — never authorizes ignoring a fresh instruction.

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
