---
type: "auto"
description: "Appending to .agent-chat-history — cadence boundaries (per_turn/per_phase/per_tool), turn-check ownership refusal handling, never writing the file directly; cadence is the trigger, not reply length"
alwaysApply: false
source: package
---

<!-- cloud_safe: noop -->

# Chat History — Cadence

Owns gate 2 of the chat-history Iron Law: WHEN to call `append`.
Ownership (gate 1) lives in [`chat-history-ownership`](chat-history-ownership.md);
visibility (gate 3) lives in [`chat-history-visibility`](chat-history-visibility.md).
File I/O is owned by [`scripts/chat_history.py`](../../../scripts/chat_history.py)
— this rule decides the trigger boundaries, not the file format.

## Iron Law — gate 2 (append at every cadence boundary)

```
EVERY CADENCE BOUNDARY GETS ONE append CALL — WITH --first-user-msg.
SKIPPING IS A RULE VIOLATION. NEVER WRITE .agent-chat-history DIRECTLY.
ON HOOK / ENGINE PATHS, THE PLATFORM / ENGINE PERFORMS append STRUCTURALLY
— THE AGENT MUST NOT DUPLICATE.
```

Cadence is **gated by ownership**: gate 1 (turn-check from
[`chat-history-ownership`](chat-history-ownership.md)) must have cleared
this turn before any append fires. Skip turn-check → append refuses with
exit `3` (`OWNERSHIP_REFUSED`).

## Append cadence — boundaries

Cadence comes from `chat_history.frequency` in `.agent-settings.yml`:

- `per_turn` → one entry at the end of every agent turn.
- `per_phase` → at phase boundaries (user question answered, decision
  taken, task-list item completed, significant tool sequence finished).
  Pure clarification turns may skip.
- `per_tool` → after each tool-call sequence.

Every append goes through

```bash
scripts/chat_history.py append --first-user-msg "<msg>" \
  --type <user|agent|tool|decision|phase> --json '<obj>'
```

Never write the file directly. Prefer `phase` over `agent` for boundaries.
**Cadence is the trigger, not reply length** — a one-line reply that
crosses a boundary still appends; a 200-line reply that doesn't cross
one still doesn't. **Do not batch missed turns** — crashes happen
between turns, and a batched append loses the timeline that crash
recovery depends on.

## Ownership refusal — exit `3`

`append` exits `3` when the file's ownership header doesn't match the
current session (`turn-check` was skipped or the file was hijacked
between turns). Surface the failure to the user, **do not swallow it**:

1. Stop the current append.
2. Render the Foreign-Prompt from [`chat-history-ownership`](chat-history-ownership.md)
   so the user re-handshakes.
3. Resume cadence only after gate 1 clears again.

This is the structural enforcement layer that catches the case where
an agent technically called `turn-check` but on the wrong platform path
(e.g. HOOK platform also tried CHECKPOINT cooperative gates and the
file got into a mixed state).

## Path-specific behavior

**CHECKPOINT path** — gates 1 + 2 are cooperative. The agent runs
`turn-check` first, then runs `append` at every cadence boundary.
`/chat-history-checkpoint` is the recommended boundary-trigger; it
captures phase entries with the right metadata.

**HOOK path** — `work_engine` and platform `SessionStart` /
`PreToolUse` hooks fire `turn-check` and `append` structurally. The
agent must **not** call either — double-write produces interleaved
entries and breaks the JSONL schema. Hooks emit the same exit codes,
so refusal handling stays identical.

**ENGINE path** — `work_engine` fires `append --type phase` per
successful step and `append --type decision` on halt. Free-form prose
around the engine output falls back to whatever path the platform
supplies (HOOK or CHECKPOINT). Engine-driven turns inherit the
structural guarantee for the duration of the dispatch cycle only.

## What this rule does NOT do

Manage ownership decisions (handshake, foreign/returning) — those
live in [`chat-history-ownership`](chat-history-ownership.md).
Manage the heartbeat marker — that lives in [`chat-history-visibility`](chat-history-visibility.md).
Decide cadence dynamically based on reply content — cadence is
the configured frequency, period.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) cadence is **inert** —
no append calls, no `scripts/`, no JSONL file. Treat
`chat_history.enabled` as `false`.

## Interactions & references

- Sibling rules: [`chat-history-ownership`](chat-history-ownership.md) (gate 1 — turn-check) · [`chat-history-visibility`](chat-history-visibility.md) (gate 3 — heartbeat marker).
- `token-efficiency` — never load the full log; cadence keeps appends small and bounded.
- API: [`scripts/chat_history.py`](../../../scripts/chat_history.py) `append` subcommand. Settings: [`agent-settings`](../templates/agent-settings.md) `chat_history.frequency`. Engine hooks: [`agents/contexts/work-engine-hooks.md`](../../../agents/contexts/work-engine-hooks.md).
