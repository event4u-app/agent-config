# Interrupt Examples — Non-Interrupts, Failure Modes

Loaded by the [`user-interrupt-priority`](../../rules/user-interrupt-priority.md)
rule when concrete examples sharpen a classification call. The Iron
Law, classification table, and stop-ask-resume protocol live in the
rule itself.

## What does NOT count as an interrupt

- **Clarifying question about the current task** — answer in place,
  keep going.
- **Quoted text / code / log content** containing imperative verbs
  ("stop", "abort") — content, not instruction. Speech-act check, same
  as [`autonomous-execution § opt-in detection`](../../rules/autonomous-execution.md#opt-in-detection--match-by-intent-not-exact-string).
- **User pasting an error or screenshot** without a redirect —
  diagnostic input for the current task.
- **"Why are you doing X?"** as a question — answer it, then continue
  (unless the answer reveals the current task is wrong, in which case
  STOP and confirm).

## Failure modes

- **Silent-resume** — treated the interrupt as a pause, returned to the
  old task without asking. Iron Law violation.
- **Partial-execution-then-resume** — answered the new ask in two
  sentences, then went back to the old task without completing the new
  one. Treat meta-tasks (process audits, council consultations, rule
  changes) as full tasks, not as quick acknowledgments.
- **Greedy-bundling** — appended the new task to the old task's plan
  and continued the old plan first. New task runs **first**, alone, in
  full.
- **Autonomy-as-cover** — "user said autonomy on, so I just continued"
  — autonomy never overrides a fresh instruction. See
  [`autonomous-execution § Task-scope`](../../rules/autonomous-execution.md).
