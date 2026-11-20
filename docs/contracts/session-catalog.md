---
stability: experimental
---

# Session Catalog Contract

One machine-wide list of every Claude Code and Codex session on this machine,
newest activity first: which host and profile it runs under, which model, where
it was started, which repositories and branches it touched, how many tokens it
used (with its subagents' usage reported separately), which subagents it ran
and where, the size of its latest prompt, whether it is live, and how to resume it. It
exists so a user — or an account manager such as agent-switch — can see what
is active and pick a session up without browsing every profile directory and
transcript.

## How it is built

`agent-config sessions:catalog` builds the catalog on every call and writes:

| Path (under `~/.event4u/agent-config/`) | Role |
|---|---|
| `sessions.json` | Machine form (schema below). |
| `SESSIONS.md` | Human view of the same snapshot. Never parsed back. |
| `runtime/session-catalog-cache.v2.json` | Parse cache; internal, safe to delete. Its version is independent of the output schema; a cache of an older version is removed. |

No hook writes any of these. The hosts already keep every session as a
transcript, so the command reads those directly:

- **Claude Code** — `<config>/projects/<project>/<session>.jsonl`, plus its
  subagents' `<config>/projects/<project>/<session>/subagents/agent-*.jsonl`
- **Codex** — `<config>/sessions/YYYY/MM/DD/rollout-…-<session>.jsonl`

for every profile directory it finds: each agent-switch profile
(`~/.agent-switch/{claude,codex}/<name>/config`, or `$AGENT_SWITCH_HOME`),
`$CLAUDE_CONFIG_DIR`, `$CODEX_HOME`, `~/.claude` and `~/.codex`, each once.
Liveness comes from the live session register (`runtime/sessions/`) that the
`session-register` hook already maintains. That hook writes under
`EVENT4U_CONFIG_HOME`. A profile manager may set that per profile (agent-switch
does not today, and plans to); such roots cannot be discovered from here, so
they are listed in `AGENT_CONFIG_SESSION_REGISTER_DIRS` (`path.delimiter`-
separated). The command reads the machine root, its own root and that list.
A record matches a session by host and id, and — when both the record and the
transcript's profile come from agent-switch — by profile name too.

Transcripts are parsed incrementally from the cache (keyed by file inode and
offset), most recently written first, up to 256 MB of new transcript per call.
A transcript the budget did not reach is read only at its head and tail —
title, model, context and paths are shown, its token count carries
`usage_complete: false` (a `+` in `SESSIONS.md`), and the next call continues.
Transcripts not written in the last 14 days are not listed, and their cache
entries are dropped; the transcripts themselves are the host's and are never
deleted.

The root deliberately ignores `EVENT4U_CONFIG_HOME`: a profile manager may set
that per profile, and a per-profile catalog would split the one list across
profiles.
`AGENT_CONFIG_SESSION_CATALOG_HOME` overrides the root (tests use it). Output
files are written owner-only (`0600`) by atomic rename; a directory the
command creates is `0700`, and an existing one keeps its mode.

## `sessions.json` — schema version 1

```json
{
  "schema_version": 1,
  "generated_at": "2026-11-20T10:00:00+00:00",
  "active_window_seconds": 900,
  "retention_days": 14,
  "counts": { "active": 2, "idle": 1, "inactive": 40, "live": 3, "total": 43 },
  "sessions": [
    {
      "session_id": "4d11cee1-…",
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
      "started_at": "2026-11-20T08:00:00.000Z",
      "last_activity": "2026-11-20T09:59:30+00:00",
      "status": "active",
      "live": true,
      "idle_seconds": 30,
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
          "last_used_at": "2026-11-20T09:59:30+00:00"
        }
      ],
      "usage": {
        "input_tokens": 0, "output_tokens": 0,
        "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
        "total_tokens": 0, "assistant_messages": 0
      },
      "usage_complete": true,
      "subagent_usage": null,
      "subagents": 1,
      "subagent_list": [
        {
          "id": "ad833e7605eb77157",
          "agent_type": "general-purpose",
          "description": "H3X-216 Gruppe löschen behält Pfeile",
          "background": true,
          "finished": null,
          "last_activity": "2026-11-20T09:59:12+00:00",
          "status": "active",
          "idle_seconds": 48,
          "model": "claude-opus-5-5",
          "repos": [{ "root": "/Users/me/worktrees/inst-a/app", "last_used_at": "2026-11-20T09:59:12+00:00", "…": "…" }],
          "usage": { "…": "…" },
          "usage_complete": true,
          "transcript_path": "…/4d11cee1-…/subagents/agent-ad833e7605eb77157.jsonl"
        }
      ],
      "subagent_usage_complete": true,
      "context_tokens": 105000,
      "context_window": null,
      "transcript_path": "/Users/me/.agent-switch/claude/work/config/projects/…/4d11cee1-….jsonl",
      "resume": {
        "cwd": "/Users/me/projects/app",
        "argv": ["claude", "--resume", "4d11cee1-…"],
        "command": "claude --resume 4d11cee1-…",
        "env": { "CLAUDE_CONFIG_DIR": "/Users/me/.agent-switch/claude/work/config" }
      }
    }
  ]
}
```

Field notes:

- **`status`** — an activity indicator, not a process state: `active` (a
  transcript or register write within `active_window_seconds`), `idle` (not
  active, but the live register still holds the session), `inactive`
  (neither). A session closed two minutes ago still reads `active`. For
  "is it running", read `live` — the register's own view, which a crashed
  session keeps until its TTL; a missing record does not prove the process is
  gone either.
- **`profile.via`** — `agent-switch` (a profile directory of that tool),
  `env` (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`), or `default` (`~/.claude`,
  `~/.codex`).
- **`surface`** — `cli`, `desktop`, `ide`, `headless` (`claude -p`,
  `codex exec`, SDK), `cloud`, or the host's raw entrypoint.
- **`repos`** — checkouts the session worked in (transcript working
  directories), wrote to through `Edit`, `Write`, `MultiEdit` and
  `NotebookEdit`, or entered from a `Bash` command with `cd` / `pushd` or
  `git -C` — a heuristic, not a shell: the first 8 KB of a command are split
  into simple commands outside quotes, relative `cd`s are chained, options
  such as `--` / `-P` are skipped, quoted text and heredoc bodies never count,
  and only literal paths are taken (no variables, `~` or globs); reads do not
  count. A linked worktree is its
  own entry. Ordered by **`last_used_at`**, newest first: the timestamp of the
  latest transcript line that used the checkout (including the session's
  subagents), in the same format as `last_activity`, or `null` when no such line carried a timestamp — those follow
  the dated ones. A checkout used last week and one used a minute ago are told
  apart by this field, not by their position alone. The
  branch list holds what the host reported while the session was in its start
  directory, plus each checkout's current branch at build time; the host's
  branch field is not trusted for other directories, because it keeps
  reporting the start branch after a session moves into a worktree.
- **`usage`** — the main thread. Claude: summed per assistant message,
  de-duplicated by message id. Codex: the latest cumulative `token_count`;
  `assistant_messages` counts those usage reports. `usage_complete` is true
  when the whole transcript was parsed, or — Codex only — when the latest
  cumulative snapshot was read from the end of the file (only complete lines
  are read; a trailing partial line is ignored). Measured on 1,355 real Codex
  transcripts on 2026-11-20: in all 1,317 whose end held a snapshot, it equalled
  the full parse; the other 38 are reported incomplete. Otherwise the totals
  are a lower bound and the next call continues.
- **`subagent_usage`** — Claude: the summed usage of the session's subagent
  transcripts, kept apart from `usage` (add the two for a session total);
  `subagents` counts them and `subagent_usage_complete` says whether all were
  parsed. Main threads are parsed before any subagent under the shared budget.
  Repos a subagent worked in or wrote to count for the session's `repos`.
- **`subagent_list`** — Claude: one entry per subagent transcript
  (`<session>/subagents/agent-<id>.jsonl`), newest activity first, at most 50
  (`subagents` still counts all). `description`, `agent_type`, `background`
  (`requestShape` `background` / `foreground`) and `finished` come from the
  host's `agent-<id>.meta.json`, each `null` when the file or field is missing;
  `description` is capped and token-masked like `title`. `last_activity` is the
  transcript's mtime and `status` is `active` within `active_window_seconds`,
  otherwise `inactive` (there is no register record per subagent, so never
  `idle`). For "running now", read `finished !== true && status === "active"`
  — an estimate with two known gaps: a subagent blocked on one long command
  writes nothing and reads `inactive` while it runs, and a killed one never
  gets `finished` and reads `active` until the window passes. `usage` is that
  subagent's own. `repos` is where it acted: checkouts its tools wrote to or
  entered (`cd` / `git -C`), and its own worktree (`worktreePath` in the meta
  file). A subagent without its own worktree carries the parent's cwd on every
  line, so that cwd counts only when nothing else is known.
- **`context_tokens`** — the prompt size of the latest main-thread message.
  `context_window` is reported by Codex only; for Claude it is `null`, because
  the effective window depends on model and host settings the transcript does
  not record, so the catalog does not guess how full the context is.
- **`resume`** — `argv` is what a program should spawn, `command` the same
  shell-quoted, run in `cwd` (the session's start directory, where the host
  keys its history). `env` carries only the profile directory variable, and
  only when the profile is not the host's default. `null` for an id that is not
  a plain identifier.

## Coverage

Claude Code and Codex, every surface that writes the host's transcript. Hosts
without a local transcript in these layouts (Augment, Cursor, Windsurf, Cline,
Gemini) are not listed. There is no "ended" state: a transcript records no
end, so a closed session reads `inactive` once its register record is gone.

## Privacy and safety

No prompt or reply text is stored. `title` is the host's generated title, or
one the user set, and a subagent's `description` is the short task label it was
launched with; both are capped at 120 characters with token-shaped runs masked;
ordinary words in a title are not masked, so a title can name what the
conversation was about. Remote URLs lose userinfo, query and fragment.
Transcripts are listed by `lstat` (symlinks and non-files skipped) and opened
without following a final symlink, without blocking, and only when the opened
descriptor is the listed file. Git metadata is read non-blocking, size-capped,
regular files only, never through a symlink; a `.git` pointer is followed only
into a real linked-worktree entry that points back at the checkout. In
`SESSIONS.md` every value is escaped or code-quoted, so no stored text can
change the document's structure.

## Stability for external readers

Within `schema_version: 1` fields are only added, never renamed or removed, and
a field's meaning does not change. Readers must ignore unknown fields. A
breaking change bumps `schema_version`; readers should refuse a version they do
not know rather than guess. Run the command before reading the file — the file
is as fresh as the last call.

## CLI

```bash
agent-config sessions:catalog                   # newest 20, human form; refreshes both files
agent-config sessions:catalog --all --json      # full catalog as JSON
agent-config sessions:catalog --status active   # filter: active|idle|inactive
agent-config sessions:catalog --live            # only sessions the register holds
```

With `--json`, `counts` always cover every listed session, while `sessions` is
the filtered and limited list.
