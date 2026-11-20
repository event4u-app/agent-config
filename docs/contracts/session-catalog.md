---
stability: experimental
---

# Session Catalog Contract

One machine-wide list of every agent session started on this machine, newest
activity first: which host and profile it runs under, which model, where it
was started, which repositories and branches it touched, how many tokens it
used, how full its context is, and how to resume it. It exists so a user — or
an account manager such as agent-switch — can see what is active and pick a
session up without browsing every profile directory and transcript.

## Files

| Path (under `~/.event4u/agent-config/`) | Role |
|---|---|
| `sessions.json` | **Canonical index.** The contract external readers consume. |
| `SESSIONS.md` | Human view of the same snapshot. Derived, never parsed back. |
| `runtime/session-catalog/<host>--<session>.json` | One record per host and session id; internal. |

All files are written owner-only (`0600`, directory `0700`) by atomic rename.
Nothing here is tracked by git or sent anywhere.

The root deliberately ignores `EVENT4U_CONFIG_HOME`: agent-switch sets that per
profile, and a per-profile catalog would split the one list across profiles.
`AGENT_CONFIG_SESSION_CATALOG_HOME` overrides the root (tests use it).

## Who writes it

The `session-register` hook concern, on every slot it is already bound to:
`session_start`, `user_prompt_submit`, `stop` and `session_end`. Each event
updates that session's own record under a per-session lock (a heartbeat that
finds it held is skipped; `session_end` waits up to 2 s), after the register's
own work. Locks are files holding the owner's pid and a token; a lock is taken
over only when its owner process is gone, and released only by its owner.
Session ids must be plain identifiers; the catalog relies on hosts issuing
unique ids (UUIDs) per host. Then the index is republished: always on start, `stop` and end, at
most once per 15 s on the prompt-time heartbeat. Publication is serialised by a
lock plus a dirty marker, so concurrent sessions do not interleave scans; a
deferred update lands with the next publish by any session. The index is
therefore eventually consistent, not a live view — the CLI rebuilds from the
records on every call, and `agent-config sessions:catalog --render` republishes.

Unlike the live register (`runtime/sessions/`, deleted at session end), a
catalog record **survives** `session_end` with `ended_at` set, and is pruned
only when its last activity is older than 30 days.

## `sessions.json` — schema version 1

```json
{
  "schema_version": 1,
  "generated_at": "2026-11-20T10:00:00+00:00",
  "catalog_dir": "/Users/me/.event4u/agent-config/runtime/session-catalog",
  "active_window_seconds": 900,
  "retention_days": 30,
  "counts": { "active": 1, "idle": 0, "stale": 0, "ended": 3, "total": 4 },
  "sessions": [
    {
      "session_id": "4d11cee1-…",
      "status": "active",
      "idle_seconds": 42,
      "host": "claude",
      "provider": "anthropic",
      "surface": "cli",
      "entrypoint": "cli",
      "host_version": "2.1.316",
      "profile": { "provider": "claude", "name": "work", "via": "agent-switch" },
      "config_dir": "/Users/me/.agent-switch/claude/work/config",
      "model": "claude-opus-5-5",
      "models": ["claude-opus-5-5"],
      "start_cwd": "/Users/me/projects/app",
      "cwd": "/Users/me/projects/app/.claude/worktrees/feat-x",
      "started_at": "…", "last_seen": "…", "ended_at": null,
      "title": "Fix login redirect",
      "roadmap_slug": null,
      "repos": [
        {
          "root": "/Users/me/projects/app",
          "name": "app",
          "remote": "https://github.com/acme/app.git",
          "linked_worktree": false,
          "branches": ["main", "feat/x"],
          "last_branch": "feat/x",
          "first_seen": "…", "last_seen": "…"
        }
      ],
      "usage": {
        "input_tokens": 0, "output_tokens": 0,
        "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
        "total_tokens": 0, "assistant_messages": 0
      },
      "context_tokens": 105000,
      "transcript_path": "/Users/me/.agent-switch/claude/work/config/projects/…/4d11cee1-….jsonl",
      "resume": {
        "cwd": "/Users/me/projects/app",
        "argv": ["claude", "--resume", "4d11cee1-…"],
        "command": "claude --resume 4d11cee1-…",
        "env": { "CLAUDE_CONFIG_DIR": "/Users/me/.agent-switch/claude/work/config" }
      },
      "schema_version": 1
    }
  ]
}
```

Field notes:

- **`status`** — `active` (heard from within `active_window_seconds`), `idle`
  (within the host's register TTL), `stale` (no event within that TTL and no
  `session_end`: crashed, closed without the hook firing, or simply left open
  and idle — a stale session can still be resumed), `ended`. It is computed at
  `generated_at`; a reader that needs freshness recomputes it from `last_seen`,
  `ended_at` and the same thresholds.
- **`surface`** — `cli`, `desktop`, `ide`, `sdk`, `cloud` or `unknown`; taken
  from the host's own entrypoint when it reports one.
- **`repos`** — every checkout the session worked in: hook working directories,
  transcript working directories, and files written through `Edit`, `Write`,
  `MultiEdit` and `NotebookEdit`. Reads do not count. A linked worktree is its
  own entry (`linked_worktree: true`). The branch is read from the checkout's
  HEAD when the event is processed, so branches a session passed through
  between two events can be missing. Shell commands that touch other
  repositories are not observed.
- **`usage`** — cumulative, de-duplicated per assistant message. `context_tokens`
  is the prompt size of the latest main-thread assistant message.
- **`transcript_path`** — read only when, with every symlink resolved, it is a
  regular `.jsonl` file named `<session>.jsonl` or `…-<session>.jsonl` inside
  the session's profile root (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`, else
  `~/.claude` / `~/.codex`; other hosts are not read), and the opened
  descriptor is the same inode as the validated file. A different path for the
  same session restarts the totals.
- **`ended_at`** — set by `session_end`; only a later `session_start` or prompt
  (a resume under the same id) clears it, never a late `stop`. If the record
  stays locked through the end, an end marker records it and the next writer
  or publisher applies it.
- **`resume`** — `null` on hosts whose CLI cannot resume by id, and for a
  session id that is not a plain identifier. `argv` is what a program should
  spawn; `command` is the same, shell-quoted. `env` only ever carries the
  profile directory variable.

## Coverage by host

| Host | Lifecycle fields | Model, tokens, context, title, surface | Resume |
|---|---|---|---|
| Claude Code | yes | yes (transcript) | `claude --resume <id>` |
| Codex | yes, where its hooks fire | model only if the host sends it | `codex resume <id>` |
| Augment, Cline, Windsurf, Gemini | yes | no | `null` |
| Cursor, Copilot, Cowork | only if a lifecycle event reaches the hook | no | `null` |

Lifecycle reach per host follows `HEARTBEAT_REACHABLE_PLATFORMS` in
`src/scripts/_lib/session_register.ts`. A host the hook never reaches is simply
absent.

## Privacy

No prompt or reply text is stored. `title` is the host's generated title, or
one the user set, capped at 120 characters with token-shaped runs masked.
Remote URLs have their userinfo, query and fragment removed. Paths are local and
the files never leave the machine.

## Stability for external readers

Within `schema_version: 1` fields are only added, never renamed or removed, and
a field's meaning does not change. Readers must ignore unknown fields. A
breaking change bumps `schema_version`; readers should refuse a version they do
not know rather than guess. Fields whose name starts with `_` in the per-session
records are internal and never appear in `sessions.json`.

## CLI

```bash
agent-config sessions:catalog                 # newest 20, human form
agent-config sessions:catalog --all --json    # full index as JSON
agent-config sessions:catalog --status active # filter: active|idle|stale|ended
agent-config sessions:catalog --render        # force-republish both files
```

With `--json`, `counts` always cover every retained session, while `sessions`
is the filtered and limited list.
