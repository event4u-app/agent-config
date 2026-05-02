---
type: "always"
description: "Detect file ownership of .agent-chat-history on first turn — match/returning/foreign/missing handshake, two-paths classification (HOOK/ENGINE/CHECKPOINT/MANUAL), Foreign/Returning numbered-options prompt"
alwaysApply: true
source: package
---

<!-- cloud_safe: noop -->

# Chat History — Ownership

Owns gate 1 of the chat-history Iron Law: the first-turn handshake
that decides whose `.agent-chat-history` file the current session is
talking to. Cadence (gate 2) lives in [`chat-history-cadence`](chat-history-cadence.md);
visibility (gate 3) lives in [`chat-history-visibility`](chat-history-visibility.md).
File I/O is owned by [`scripts/chat_history.py`](../../../scripts/chat_history.py)
— this rule says **when** to handshake, not how the file is structured.

## Two paths — platform decides which Iron Law applies

Population of `.agent-chat-history` is **structural** (platform-driven)
on platforms with native lifecycle hooks, and **cooperative**
(agent-driven) on platforms without. Both paths converge on the same
JSONL schema; only the trigger differs. Per-platform classification
lives in
[`agents/contexts/chat-history-platform-hooks.md`](../../../agents/contexts/chat-history-platform-hooks.md).

| Path | Platforms / Surfaces | Trigger | Agent's role |
|---|---|---|---|
| **HOOK** | Claude Code, Augment CLI, Cursor 1.7+, Cline non-Windows, Windsurf, Gemini CLI | Platform fires native lifecycle hooks → `./agent-config chat-history:hook --platform <name>` | Read-only — observe, do not duplicate appends |
| **ENGINE** | `/implement-ticket`, `/work`, any flow driven by `scripts/work_engine/cli.py` | `work_engine` fires `turn-check` (before-dispatch), `append --type phase` (per successful step), `--type decision` (on-halt), `heartbeat` (after-dispatch) via the hook layer | Read-only during engine-driven turns — do not duplicate appends. See [`agents/contexts/work-engine-hooks.md`](../../../agents/contexts/work-engine-hooks.md) |
| **CHECKPOINT** | Augment IDE plugin, Cursor < 1.7, Cline on Windows | Agent invokes `/chat-history-checkpoint` at phase boundaries | Cooperative — gates 1 + 2 + 3 are mandatory |
| **MANUAL** | Cloud surfaces (Claude.ai Web, Skills API) | Rule is inert — see Cloud Behavior | None |

Detect the path on first turn: read `chat_history.platform` from
`.agent-settings.yml` if set, else fall back to `chat_history.path`
(`hook` / `checkpoint` / `manual`). Missing both → assume CHECKPOINT
(safest cooperative default; HOOK platforms install the platform
config explicitly via `scripts/install.py`).

## Iron Law — gate 1 (turn-check is the first tool call)

```
ON CHECKPOINT, turn-check IS THE FIRST TOOL CALL OF EVERY SESSION.
ON HOOK, THE PLATFORM FIRES turn-check STRUCTURALLY — DO NOT DUPLICATE.
ON ENGINE, work_engine FIRES turn-check BEFORE DISPATCH — DO NOT DUPLICATE.
```

CHECKPOINT path — run silently before any other tool call:

```bash
scripts/chat_history.py turn-check --first-user-msg "<first-user-msg>"
```

Exit codes: `0` = `ok`/`disabled` (proceed), `10` = `missing`
(run `init --first-user-msg "..." --freq <freq>`), `11` = `foreign`
(render Foreign-Prompt + stop), `12` = `returning` (render
Returning-Prompt + stop). The script writes a one-line
`ACTION REQUIRED:` hint to stderr on non-zero exits.

## Activation & handshake

Read `chat_history.*` from `.agent-settings.yml` **once per conversation**
(first turn) and cache. `enabled: false` or section missing → all three
chat-history rules are a **no-op** (do not read, write, or mention the
file). Otherwise cache `frequency`, `max_size_kb`, `on_overflow`, and
the **path** (HOOK / CHECKPOINT / MANUAL — see the table above).

**HOOK path** — skip `turn-check` entirely. The platform's
`SessionStart` hook already initialized the file; the agent's job is to
read `status` once for context awareness (header preview, entry count)
and otherwise leave I/O to the hook dispatcher. Foreign / Returning
prompts still apply because hooks call into the same ownership state
machine — when the dispatcher reports `foreign` or `returning` via
exit code or stderr, render the corresponding prompt.

**CHECKPOINT path** — run `turn-check` as the first tool call. State
token branches to one of: `missing` → `init`, `ok` → continue,
`foreign` → Foreign-Prompt, `returning` → Returning-Prompt.
`/chat-history-checkpoint` is the recommended way to satisfy gate 2
at phase boundaries (see [`chat-history-cadence`](chat-history-cadence.md)).

In `foreign` and `returning`, **always read the file's current contents
into the agent's working context before any write** — the user chose to
log history for a reason; losing it silently is never acceptable. The
legacy `state` subcommand still works for shell scripts; agents prefer
`turn-check` (folds in `enabled` + distinct exit codes).

## Foreign / Returning prompts — full mechanics

When `turn-check` exits `11` (foreign) or `12` (returning), render the
matching numbered-options block from
[`agents/contexts/chat-history-handshake.md`](../../../agents/contexts/chat-history-handshake.md).
That doc holds the prompt bodies, the option → script-call mapping
(`adopt` / `init` / `prepend` / `reset`), the in-memory entries-list
shape, free-text fallbacks, and the overflow handling per
`on_overflow` (`rotate` / `compress`). Read it once on first foreign
or returning event; cache the chosen option for the rest of the
conversation.

## What this rule does NOT do

Display/reload/clear (`/chat-history*` commands). Auto-flip `enabled` or
`on_overflow`. Run when `enabled: false`. Decide ownership
heuristically — only `turn-check` / `state` does that. Double-write on
HOOK platforms — when hooks fire structurally, the agent does **not**
also call `turn-check`. Cadence (gate 2) and heartbeat (gate 3) are
covered in their sibling rules.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the rule is **fully inert** —
no `.agent-chat-history`, no `scripts/`, no Iron Law gates, no foreign/returning
prompts. Treat `chat_history.enabled` as `false`; persistence is a
local-agent concern.

## Interactions & references

- Sibling rules: [`chat-history-cadence`](chat-history-cadence.md) (gate 2 — append timing) · [`chat-history-visibility`](chat-history-visibility.md) (gate 3 — heartbeat marker).
- `ask-when-uncertain` + `user-interaction` — foreign/returning prompts use numbered options, one question per turn.
- `language-and-tone` — prompt translated at runtime; `.md` stays English.
- `onboarding-gate` — runs first; this rule activates only after it clears.
- API: [`scripts/chat_history.py`](../../../scripts/chat_history.py). Commands: [`/chat-history`](../commands/chat-history.md), [`/chat-history-resume`](../commands/chat-history-resume.md), [`/chat-history-clear`](../commands/chat-history-clear.md), [`/chat-history-checkpoint`](../commands/chat-history-checkpoint.md). Settings: [`agent-settings`](../templates/agent-settings.md). Platform classification: [`agents/contexts/chat-history-platform-hooks.md`](../../../agents/contexts/chat-history-platform-hooks.md). Types: [`rule-type-governance`](rule-type-governance.md).
