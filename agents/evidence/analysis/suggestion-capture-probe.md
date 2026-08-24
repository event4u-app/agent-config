<!-- evidence-type: analysis -->

# Can a `user_prompt_submit` hook see the previous assistant turn?

**Yes — two ways, and the cheaper one is not the one the roadmap assumed.**

Probed live 2026-08-24 on Claude Code `2.1.241 (Claude Code)`. Discharges Phase 1.1 of
`road-to-suggestion-block-capture`, whose Risk 1 was *"host payload may not
expose the transcript tail; the whole design rests on it"*.

## Method — a clean throwaway project, not this repository

A probe hook was bound to `UserPromptSubmit` and `Stop` in a **fresh temp
project** with its own `.claude/settings.json`, then two turns were driven
through `claude -p` / `claude -p --continue`. The probe dumps the payload's
**key set and value types only** — never a value — which is the same
counts-only discipline the instrument itself has to follow.

The clean project matters and is not ceremony: probing inside this repository
would have run the whole suite's own hook dispatcher and its rules, so the
observation would have been about this tree's configuration rather than about the
host's payload.

## What the host actually sends

| | `UserPromptSubmit` | `Stop` |
|---|---|---|
| `transcript_path` | **present** | present |
| — file exists, turn 1 | **NO** | yes |
| — file exists, turn ≥ 2 | **yes** | yes |
| `prompt` (the user's text) | **present** | absent |
| `last_assistant_message` | absent | **present** |
| `session_id`, `cwd`, `permission_mode`, `prompt_id`, `hook_event_name` | present | present |
| `stop_hook_active`, `effort`, `background_tasks`, `session_crons` | absent | present |

Full key sets, verbatim from the probe:

- `UserPromptSubmit` — `cwd, hook_event_name, permission_mode, prompt, prompt_id, session_id, transcript_path`
- `Stop` — `background_tasks, cwd, effort, hook_event_name, last_assistant_message, permission_mode, prompt_id, session_crons, session_id, stop_hook_active, transcript_path`

## The finding that changes the design

The roadmap planned a **single-slot** instrument: a `user_prompt_submit` hook
that reads the transcript tail to decide whether the previous assistant turn
carried a suggestion block. That works — `transcript_path` is there and the file
exists from turn 2 — and it is the more expensive of the two available shapes.

**`Stop` carries `last_assistant_message` directly in the payload.** So the
"was a block emitted" half needs **no file read at all**: it is decidable from a
string the host already hands over, at the moment the message is produced. The
"what did the user answer" half is decidable from `prompt` on the next
`user_prompt_submit`.

A two-slot latch is therefore strictly better than the planned single-slot read:

| | planned (1 slot) | two-slot latch |
|---|---|---|
| Transcript file read | every turn | **never** |
| Turn-1 blind spot | yes (file absent) | **no** |
| Latency on the per-turn slot | parse a JSONL tail | one string match against a latch file |
| Risk 1 (payload cannot reach the tail) | the design rests on it | **does not arise** |

**One thing the two-slot shape must get right**, and it is the same guard the
roadmap's Risk 2 already names: the latch has to be **consumed** by the next
`user_prompt_submit` and then cleared, or a bare "1" three turns later reads as
a pick. The latch carries the `prompt_id` it was written under, and a
classification is only a pick when the *immediately following* prompt is the one
that consumes it. Everything else is `stale_block`.

## What this probe does NOT establish

- **Nothing about other hosts.** Cursor, Cline, Windsurf, Gemini and Copilot were
  not probed. The hook manifest binds the `user_prompt_submit` slot on six
  platforms; this observation covers Claude Code only, so the instrument reports
  a host-scoped figure rather than a suite-wide one.
- **Nothing about `last_assistant_message` under compaction or interruption.**
  Both turns here were ordinary. A compacted or interrupted turn may carry a
  different string, and the instrument must treat an unparseable latch as
  `stale_block` rather than guessing.
- **Nothing about the capture RATE**, which is Phase 3's soak window and is the
  thing this probe exists to make measurable, not to answer.
