# Deliberation mode — offer, auto, off

`deliberation.mode` decides what happens when the user's question carries a
real decision with trade-offs — a design choice, a contested claim, several
viable solutions. The mode in force reaches the agent as one
`<deliberation mode="…" session="…">` line per prompt (the `deliberation-mode`
hook concern). On a host without that hook, read it with
`agent-config deliberation:get --json`: session override > user-global
setting > `off`.

## Which tool fits

| The decision | Tool |
|---|---|
| A design, plan or decision checked by other model families | `/council` |
| Several competing solutions to the same task, compared pairwise | `/arena` (= `/judge bracket`) |
| Independent judges voting on a decision, or verifying findings | `/panel decide` · `/panel review` |

A lookup, an obvious fix, or a step inside an already-chosen plan is trivial:
answer it and offer nothing.

## The three modes

- **`off`** (default) — never offered, never started unasked. A tool the user
  names still runs. Nothing is switched on until the user asks.
- **`offer`** — one numbered-options block: the fitting tool(s),
  each with what it would decide, then "just answer it" as the last option and
  one recommendation line under the block.
- **`auto`** — an automatic mode the user switched on, globally or for one
  chat. Two things follow:
  1. The agent answers its **own implementation questions** inside the task —
     how to do it, which approach, design or library — itself, directly or via
     the fitting tool when that is worth it, and names each decision with a
     one-line reason instead of asking. This is the user's standing autonomy
     directive for that scope, in the sense of `autonomous-execution`: a
     content-free "should I continue?" or "which way?" is not asked.
  2. A fitting tool runs without a confirmation round; the reply opens with
     one line naming it and why. Its own spend and seat rules still apply.

## What `auto` never decides

`auto` widens nothing behind the Hard Floor (`non-destructive-by-default`).
These still stop and ask on this turn, in every mode: **merge, deploy, push,
release or tag, production data or infra, bulk deletion, and any irreversible
external action** (send, publish, post, purchase). Neither does it decide an
owner-reserved transition (`decision-revisit-gate`), the `high_impact` and
`user_required` classes `ask-when-uncertain` sends to the user, or a fact only
the user holds — a preference, a deadline, a business constraint.

## Changing the mode

The agent switches the mode only when the user asks — "stell
council/arena/panel auf auto", "turn deliberation on", "/deliberation offer".
The scope is **this session** unless the user says globally or everywhere:
`agent-config deliberation:set <off|offer|auto> --session <id>`, the id from the
`<deliberation>` line (`inherit` removes the override); globally,
`agent-config deliberation:set <off|offer|auto> --source jit-answer`. Full
procedure: `/deliberation`.
