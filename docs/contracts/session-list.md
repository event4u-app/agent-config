---
stability: beta
---

# Session List

> **Status:** Active · governs the JSON output of `agent-config sessions:list`.
> Implemented in `src/scripts/sessions_cli.ts`, the record shape in
> `src/scripts/_lib/session_register.ts`. Pinned by
> `tests/scripts/sessions_list_schema.test.ts` and
> `tests/scripts/session_register.test.ts`.

## Purpose

`sessions:list` reports the live sessions registered on a repository. A
human reads the table; a script or an account tool reads the JSON. This
contract fixes the JSON forms so a consumer can rely on them across
versions.

## The three JSON forms

| Invocation | Top-level shape | Status |
|---|---|---|
| `sessions:list --json` | array of session records | pinned, unversioned |
| `sessions:list --json --branches` | `{ sessions, other_worktree_branches, unmerged_filter_applied }` | pinned, unversioned |
| `sessions:list --json --schema 1 [--branches]` | `{ schema_version: 1, sessions, … }` | versioned |

### Pinned array form

`--json` without `--schema` prints the record array as the top-level value.
A scripted screen depends on it, so it never changes shape: wrapping it in
an object would break every existing caller. New consumers should use
`--schema 1` instead.

### Schema 1

`--json --schema 1` (or `--schema=1`) always prints one object, with or
without `--branches`, so a consumer never has to tell an array from an
object:

```json
{
  "schema_version": 1,
  "sessions": [ /* session records */ ],
  "other_worktree_branches": [ { "branch": "feat/x", "worktree": "/abs/path" } ],
  "unmerged_filter_applied": true
}
```

- `schema_version` and `sessions` are always present.
- `other_worktree_branches` and `unmerged_filter_applied` are present only
  with `--branches`.
- An empty register prints `{ "schema_version": 1, "sessions": [] }` and
  exits 0 — no register is the normal pre-first-session state.
- An unknown or missing schema value (`--schema 2`, `--schema`) is refused
  on stderr with the supported versions and exit code 2; nothing is
  printed on stdout.
- `--schema` without `--json` is refused with exit code 2.

A future schema version is a new number; schema 1 never changes shape.
Support is discoverable before calling: `agent-config --version --json`
and `GET /api/v1/ping` advertise `capabilities.sessionList` — the highest
schema version this build serves. An older build omits the field.

## Session record

| Field | Type | Always present |
|---|---|---|
| `session_id` | string | yes |
| `platform` | string | yes |
| `worktree` | absolute path | yes |
| `branch` | string or `null` | yes |
| `roadmap_slug` | string or `null` | yes |
| `started_at` | ISO-8601 UTC | yes |
| `last_seen` | ISO-8601 UTC | yes |
| `turn_end_refusals` | `{ [detector]: count }` | no |
| `owned_paths` | string[] | no |
| `profile` | `{ provider, name, via }` | no |

Optional fields are **omitted**, never `null`: a record without them is
byte-identical to a record written before they existed.

### `profile`

The account profile the session runs under, derived from the session's
environment at registration time only — no file read, no token, no secret.

- `via: "agent-switch"` — a provider env var (`CLAUDE_CONFIG_DIR`, then
  `CODEX_HOME`) points into an agent-switch profile tree
  (`<root>/<provider>/<name>/…`); `provider` and `name` are its first two
  segments.
- `via: "env"` — outside an agent-switch tree, a non-empty
  `CLAUDE_CONFIG_DIR` gives `provider: "claude"`, else `CODEX_HOME` gives
  `provider: "codex"`; `name` is the directory's basename.
- Absent — no such env var is set, or the env var points into an
  agent-switch tree that does not parse to `<provider>/<name>`. No profile
  is guessed in that case.

Two sessions under two profiles on one repository therefore list with two
different `profile` values in every JSON form.
