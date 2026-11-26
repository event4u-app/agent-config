---
model_tier: lite
name: deliberation
pack: meta
intent: "Choose whether the agent offers, auto-runs or never offers /council, /arena or /panel on a real decision"
routes_to: [ai-council]
replaces: []
visibility: internal
cluster: council
description: Set deliberation.mode — off (default), offer or auto — for council/arena/panel, for this chat or globally
argument-hint: "[off|offer|auto|inherit] [--session]"
suggestion:
  eligible: false
  rationale: "A settings toggle the user asks for by name; never suggested."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /deliberation

Sets `deliberation.mode`, which decides what happens when a question carries a
real decision with trade-offs. When each tool fits and what each mode obliges:
[`ai-council` § deliberation mode](../../skills/ai-council/references/deliberation-mode.md).

- `off` (default) — never offered, never started unasked. It is switched on
  only when the user asks.
- `offer` — the fitting `/council`, `/arena` or `/panel` as numbered
  options, the plain answer last.
- `auto` — an automatic mode the user switches on: the agent runs the fitting
  tool itself and answers its own implementation questions (approach, design,
  library) instead of asking, naming each decision with a one-line reason.

**Never automatic, in any mode:** merge, deploy, push, release or tag,
production data or infra, bulk deletion, and any irreversible external action
(send, publish, post, purchase) — the `non-destructive-by-default` Hard Floor
still asks on this turn. So do owner-reserved transitions and facts only the
user holds.

## Steps

### 1. No argument — show the mode

```bash
agent-config deliberation:get --session <id>
```

`<id>` is the `session="…"` value of the `<deliberation>` line, when one is in
context; without it, drop `--session`. Print the mode and its source
(`session`, `global` or `default`) in one line. Stop.

### 2. A mode — set it

Validate the argument against `off`, `offer`, `auto`, `inherit`. Anything else:
list the four and stop.

Only when the user asks for it — never on the agent's own initiative.

- **This chat** (the default scope):
  `agent-config deliberation:set <mode> --session <id>`. No session id in
  context → say the override needs one, and offer the global change instead.
- **Globally** — only when the user says so ("global", "everywhere", "überall",
  "immer"): `agent-config deliberation:set <mode> --source jit-answer`.
- `inherit` is session-only: it removes the override, so the chat follows the
  global setting again.

A plain instruction such as "stell council/arena/panel auf auto" or "turn
deliberation off" runs the same step. Confirm the new effective mode in one
line, with its source.

## Notes

- Agent Switch reads and writes the same state:
  `agent-config deliberation:get --session <id> --json`.
- The override file lives at
  `~/.event4u/agent-config/state/deliberation/<session-id>.json`.
