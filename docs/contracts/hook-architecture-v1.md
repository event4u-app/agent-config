---
stability: beta
---

# Hook architecture v1

**Purpose.** Pin the contract that the universal hook dispatcher
implements, so concern scripts and per-platform trampolines can be
written, tested, and refactored against a stable surface.

**Scope.** Defines the dispatcher's stdin/stdout shape, exit-code
semantics, the `hook_manifest.yaml` schema, the concurrency contract
for `agents/state/` writes, and the Copilot fallback pattern. Does
**not** specify per-platform install paths — those live in
[`chat-history-platform-hooks.md`](../../agents/contexts/chat-history-platform-hooks.md).

Last refreshed: 2026-05-04.

## Vocabulary

| Term | Meaning |
|---|---|
| **Platform** | Host agent surface — one of `augment`, `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`, `copilot`. The `claude` value covers both Claude Code (CLI) and Claude.ai Web; `cowork` covers the Claude desktop app's local-agent-mode runtime separately so chat-history entries can attribute events to Cowork vs CLI Claude Code via the `agent` field. Cowork shares Claude Code's lifecycle vocabulary and payload shape but is upstream-blocked from reading any settings source as of writing (anthropics/claude-code#40495, #27398). The canonical platform identifier is `claude` for the CLI/IDE surface and `cowork` for the desktop sandbox (both match `chat_history.PLATFORM_EVENT_MAP`). |
| **Concern** | A single agent-config behaviour wired to one or more lifecycle events — e.g. `chat-history`, `roadmap-progress`, `verify-before-complete`. Lives as a Python script under `scripts/hooks/concerns/<name>.py`. |
| **Event** | The agent-config-internal event vocabulary the dispatcher exposes — `session_start`, `session_end`, `user_prompt_submit`, `pre_tool_use`, `post_tool_use`, `stop`, `pre_compact`, `agent_error`. Per-platform native names map to these. `agent_error` is synthetic — fired by the agent (or wrapper) when the host crashes outside a concern, so chat-history can checkpoint partial sessions on abnormal exit. (Added in Round 2 — 2026-05-04.) |
| **Trampoline** | A 5–10 line per-platform shell script that reads the platform's native payload, calls the dispatcher with `--platform <name>`, and forwards the platform's exit-code semantics. |
| **Dispatcher** | `scripts/hooks/dispatch_hook.py` — single Python entrypoint that reads the manifest, resolves which concerns fire on `(platform, event)`, runs each one with the contract envelope below, and reduces their exit codes. |

## Dispatcher invocation

```
python3 scripts/hooks/dispatch_hook.py \
    --platform <name> \
    --event <agent-config-event> \
    [--native-event <platform-event>] \
    < platform-payload.json
```

`--native-event` is informational; the dispatcher does not branch on
it. The trampoline is responsible for translating the platform's
native event name to the agent-config vocabulary before invocation.

## Stdin contract — concern envelope

The dispatcher writes a single JSON object to each concern's stdin:

```json
{
  "schema_version": 1,
  "platform": "augment",
  "event": "stop",
  "native_event": "Stop",
  "session_id": "…",
  "workspace_root": "/abs/path",
  "payload": { /* opaque, platform-native */ },
  "settings": { /* materialized .agent-settings.yml subset */ }
}
```

Concerns MUST treat unknown top-level keys as forward-compat extensions
and MUST NOT raise on them. `payload` is passed through verbatim from
the platform — concerns extract what they need via their own helpers
(see `scripts/chat_history.py` `_extract_*` for the pattern).

## Stdout contract — concern reply

A concern MAY write a single JSON object to stdout. The dispatcher
reads it; non-JSON or empty stdout is treated as no-op (decision
inferred from exit code only).

```json
{
  "decision": "allow" | "block" | "warn",
  "reason": "human-readable, ≤ 200 chars",
  "additional_context": "optional — surfaces back to the model on platforms that support it",
  "state_writes": ["agents/state/chat-history.json", "…"]
}
```

`state_writes` is advisory; concerns still write the files themselves
under the concurrency rules below.

## Exit-code semantics

| Code | Meaning | Dispatcher action |
|---|---|---|
| `0` | allow | no-op; pass through |
| `1` | block | dispatcher exits 1, surfaces `reason` to platform's deny channel |
| `2` | warn | dispatcher exits 0, logs `reason` to stderr, sets `additionalContext` if platform supports it |
| `≥ 3` | error | dispatcher logs full traceback, exits 0 (fail-open) unless `concerns.<name>.fail_closed: true` in settings |

## Reduction across multiple concerns

When a `(platform, event)` tuple maps to ≥ 2 concerns, the dispatcher
runs them **sequentially** in manifest order and reduces:

- Any `block` → final decision is `block` (most-restrictive merge).
- Else any `warn` → final decision is `warn`.
- Else `allow`.

`additional_context` strings are concatenated with `\n\n` separators,
in manifest order. Concerns are never run in parallel — concurrency
guarantees rely on serial state writes.

## Feedback channel — `agents/state/.dispatcher/<session_id>/`

Exit-code reduction collapses the severity ladder to a single
platform-native code, which can hide a `warn` behind a `block` or
mask non-actioned reasons entirely. To preserve per-concern detail
without re-routing control flow, the dispatcher writes a feedback
directory per invocation:

```
agents/state/.dispatcher/<session_id>/
  <concern>.json     — one file per concern that ran
  summary.json       — rollup written after the last concern
```

Each `<concern>.json` carries:

```json
{
  "concern": "chat-history",
  "exit_code": 0,
  "raw_exit_code": 0,
  "severity": "allow",
  "decision": "allow",
  "reason": "appended turn 12",
  "duration_ms": 47,
  "started_at": "2026-05-04T12:34:56Z",
  "completed_at": "2026-05-04T12:34:56Z",
  "fail_closed": false
}
```

`summary.json` carries the platform / event tuple, the reduced
`final_exit_code` + `final_severity`, and a trimmed list of all
concern entries. `session_id` falls back to
`dispatch-<unix_ts>-<pid>` when the envelope omits one. Path
traversal in `session_id` is collapsed (`/`, `\`, `..` → `_`).

Feedback writes are non-fatal — IO errors log to stderr but never
change the dispatcher's exit code. The directory is gitignored and
consumed by `task hooks-status` (Phase 7.11). Added in Round 2
(2026-05-04) per Q1 of `tmp/council_round2/q1_feedback_channel.md`.

## Manifest schema — `scripts/hook_manifest.yaml`

```yaml
schema_version: 1
concerns:
  chat-history:
    script: scripts/hooks/concerns/chat_history.py
    fail_closed: false
roadmap-progress:
    script: scripts/hooks/concerns/roadmap_progress.py
    fail_closed: false

platforms:
  augment:
    session_start: [chat-history]
    stop:          [chat-history, roadmap-progress]
    post_tool_use: [chat-history]
  claude:
    session_start: [chat-history]
    user_prompt_submit: [chat-history]
    stop:          [chat-history, roadmap-progress]
  copilot:
    # No dispatcher — see "Copilot fallback" below.
```

Validated by `scripts/lint_hook_manifest.py` (Phase 7.10): every
concern script must exist on disk, every platform key must be a known
platform, every event key must be in the agent-config event vocabulary.

## Concurrency — atomic state writes

Concerns that write under `agents/state/` MUST use the pattern:

1. Acquire `fcntl.flock(LOCK_EX)` on `agents/state/.dispatcher.lock`.
2. Write to a sibling `<dest>.tmp.<pid>` file in the same directory.
3. `os.replace(tmp, dest)` — POSIX-atomic on the same filesystem.
4. Release the lock.

The single `.dispatcher.lock` is intentional: serialising state
writes across concerns is cheaper than per-file locks, and concerns
already run sequentially within one dispatcher invocation. The lock
file is gitignored.

Phase 7.4 ships a regression test that spawns two concurrent
dispatcher invocations against the same event and asserts no torn
writes (file ends with valid JSON, last-writer-wins).

## Copilot fallback pattern

Copilot has no hook surface. Concerns whose source rule cites
`agents/state/<concern>.json` MUST gain a "Copilot fallback" section
that:

- Names the state file the concern would have written.
- Names a manual command or task that reproduces the side effect
  (e.g. `task chat-history:append`).
- Includes no Iron-Law-changing prose.

The dispatcher silently no-ops when called with `--platform copilot`;
the fallback is consumed by reading the rule, not by hook invocation.

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Concerns MUST gate on `schema_version` and refuse unknown
majors.

## See also

- [`docs/hook-payload-capture.md`](../hook-payload-capture.md) —
  operational how-to for capturing redacted live payloads to upgrade
  a platform's chat-history extractor from `docs-verified` to
  `payload-verified`.
