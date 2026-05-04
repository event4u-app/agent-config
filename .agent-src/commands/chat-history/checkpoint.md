---
name: chat-history:checkpoint
cluster: chat-history
sub: checkpoint
description: Append a phase-boundary entry to .agent-chat-history — CHECKPOINT fallback for platforms without a native hook (Augment IDE, Cursor pre-1.7, Cline non-Mac/Linux). ~1s.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "User wants to flush a chat-history phase boundary on a CHECKPOINT-class platform (Augment IDE, Cursor < 1.7, Cline on Windows) — phrases like 'checkpoint chat history', 'log a phase boundary', 'manual chat-history append'."
  trigger_context: "chat_history.path == checkpoint AND a phase-shaped boundary just completed (decision recorded, multi-tool sequence finished, task-list item closed)."
---
<!-- cloud_safe: noop -->

# /chat-history checkpoint
Force-append a `phase`-typed entry to `.agent-chat-history`. CHECKPOINT
fallback for platforms without native hooks — see
[`agents/contexts/chat-history-platform-hooks.md`](../../../agents/contexts/chat-history-platform-hooks.md)
for the per-platform classification.

Use this at decision points, end of phase, or after a meaningful tool
sequence on a CHECKPOINT/MANUAL platform. On HOOK platforms (Claude
Code, Augment CLI, Cursor 1.7+, Cline non-Windows, Windsurf, Gemini
CLI), the platform fires hooks automatically — manual use is allowed
but rarely needed.

## When to use

- IDE plugin without hooks (Augment Code IDE plugin as of 2026-04-30).
- Long-running tool sequence on any platform that did not flush.
- Explicit phase-boundary marker after a multi-tool refactor.
- Crash-recovery rehearsal — verifies the append path works before a
  real outage.

## When NOT to use

- HOOK platform mid-session — the platform already records turn-level
  cadence; an extra checkpoint just adds noise.
- After every line of agent output — that's `per_turn` cadence and is
  configured in `.agent-settings.yml`, not via this command.
- To inspect the log → [`/chat-history`](chat-history.md).
- To wipe the log → [`/chat-history-clear`](chat-history-clear.md).
- To reload the log into context → [`/chat-history-resume`](chat-history-resume.md).

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false` or
the section is missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Nothing to checkpoint. Enable in .agent-settings.yml first.
```

### 2. Determine the phase label

Pick a short label (2–6 words) that names what just happened:

- "phase-1-done", "refactor-extracted", "tests-green",
  "review-comments-fixed", "merge-ready".

If the user invoked the command without context, ask once with
numbered options per [`user-interaction`](../rules/user-interaction.md):

```
> 1. Use a free-text label — type 2–6 words for the checkpoint
> 2. Use a generic "manual-checkpoint" label
> 3. Skip — close without writing
```

### 3. Append the checkpoint

Invoke the master CLI:

```
./agent-config chat-history:checkpoint \
  --first-user-msg "<the conversation's first user message>" \
  --payload '{"phase": "<label>"}'
```

The wrapper delegates to `scripts/chat_history.py hook-append --event phase`,
which performs cadence filtering and ownership checks. Cadence is read
from `chat_history.frequency` in `.agent-settings.yml` — `per_turn` /
`per_phase` / `per_tool`. `per_tool` cadence drops the `phase` event;
say so explicitly if that is the active mode.

### 4. Confirm

Render a one-line confirmation, mirroring the user's language:

```
> 📒 Checkpoint logged: <label>  (entries: N → N+1)
```

If the helper returned `skipped_cadence`, surface it:

```
> 📒 Checkpoint skipped — current cadence is per_tool, phase events are dropped.
> Switch chat_history.frequency to per_phase or per_turn to capture phase boundaries.
```

## Gotchas

- The command writes through the same ownership-state machine as
  hooks — a `foreign` log triggers the
  [`chat-history`](../rules/chat-history-ownership.md) Foreign-Prompt before any
  append. This is intentional; the checkpoint must not silently
  hijack another session's log.
- The `phase` payload key is required. Other keys are accepted but
  ignored by the JSONL schema (forward-compat — they may be promoted
  to first-class fields later).
- On HOOK platforms, hook entries and checkpoint entries coexist
  cleanly. The schema does not deduplicate; if you checkpoint
  immediately after a hook fires, expect two adjacent entries with
  different `source` values.

## See also

- [`chat-history`](../rules/chat-history-ownership.md) — the rule defining the
  conditional Iron Law (HOOK platforms vs CHECKPOINT/MANUAL platforms)
- [`/chat-history`](chat-history.md) — read-only status display
- [`/chat-history-resume`](chat-history-resume.md) — adopt + load
- [`/chat-history-clear`](chat-history-clear.md) — wipe
- [`agents/contexts/chat-history-platform-hooks.md`](../../../agents/contexts/chat-history-platform-hooks.md) — per-platform strategy table
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — `hook-append` API
