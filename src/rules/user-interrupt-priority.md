---
type: "auto"
tier: "2a"
consequence_class: "authority-bypass"
description: "New user instruction mid-flight — STOP the current task, run the new one in full, ASK before resuming"
alwaysApply: false
triggers:
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
  - contexts/execution/interrupt-examples.md
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
obligation_frequency: "per-turn"
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

Holds regardless of `personal.autonomy`, standing directives or roadmaps — autonomy never overrides a fresh instruction.

## Classify every user turn

| Bucket | Signal | Action |
|---|---|---|
| **Continuation** | Same deliverable, target, success criterion. "weiter", "next step". | Continue. |
| **Clarification** | Question / correction, no new deliverable. | Answer, continue. |
| **Amendment** | Same mission; a stage added, dropped or moved. | Re-plan (`invocation-plan`), state `Order`, continue. |
| **Interrupt** | Different deliverable, target or success criterion. Meta-tasks ("audit", "stop and analyze") count. | STOP. Run new task. ASK before resume. |

In doubt → interrupt: a spurious ask costs one turn, a silent resume the rest of the unwanted work.

## Stop-ask-resume protocol

1. **STOP** — abandon the current tool plan. No "one more check" unless the new instruction says so.
2. **EXECUTE** the new task in full. All other rules (Hard Floor, scope, autonomy) apply.
3. **ASK** when done — name the interrupted task, request a resume decision:

```
Done with <new task>. Resume <interrupted task name>? (yes / no / different)
```

Only resume on `yes` or a restatement. "and then continue with X" = resume authorized; no re-ask.

## Startup contract

- **When:** mid-task turn → classify: Continuation (same deliverable/target/criterion) → continue · Clarification (question/correction, no new deliverable) → answer, continue · Amendment (same mission, stage added/dropped/moved) → re-plan (`invocation-plan`), state `Order`, continue · Interrupt (different deliverable/target/criterion; meta-tasks "audit", "stop and analyze" count); in doubt → interrupt.
- **Must:** interrupt → STOP current task, drop its tool plan; COMPLETE NEW TASK IN FULL (Hard Floor/scope/autonomy still apply); THEN ASK: "Resume <interrupted task name>? (yes / no / different)"; holds regardless of `personal.autonomy`/directives/roadmaps.
- **Never:** silently resume or "one more check" on old task unless new task says so; resume w/o `yes`/restatement ("and then continue with X" = resume authorized, no re-ask).
