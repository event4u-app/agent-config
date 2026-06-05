---
stability: beta
keep-beta-until: 2026-08-18
---

# Settings GUI — REST API Contract (v1)

> Local-only HTTP API exposed by `agent-config ui:serve` and reused by
> `agent-config settings` / `agent-config setup`. Listens on `127.0.0.1`
> only; no auth, no cross-origin. The browser SPA is the sole client —
> the legacy `/onboard` chat skill has been retired.
>
> Server-side validators live in `src/server/schemas/`; the JSON-Schema
> emitted at `GET /api/v1/schema` is derived from those Zod modules via
> `zod-to-json-schema` so client and server cannot drift.

## Conventions

- Base path: `/api/v1`. Any breaking change bumps the version segment.
- Content type: `application/json; charset=utf-8` on every request and
  response unless noted.
- Errors: HTTP status carries the verdict; bodies are
  `{ error: { code, message, fields?: Array<{ path, message }> } }`.
- Time format: ISO-8601 UTC (`2026-05-20T14:23:11.842Z`).
- File mtime: integer milliseconds since epoch (`fs.statSync(...).mtimeMs`
  truncated to integer) — wire-stable across JSON parsers.
- Optimistic locking: every endpoint that mutates an on-disk file
  echoes `lastModified` on read and requires `If-Unmodified-Since` on
  write. Drift returns **409 Conflict** with the current file body so
  the client can render a 3-way merge.

## Endpoints

### `GET /api/v1/schema`

Returns the JSON-Schema rendition of `settingsSchema` and `userMdSchema`
so the SPA can build forms without bundling Zod.

Response (200):

```json
{
    "settings": { "$schema": "...", "type": "object", "properties": { ... } },
    "userMd":   { "$schema": "...", "type": "object", "properties": { ... } },
    "generatedAt": "2026-05-20T14:23:11.842Z"
}
```

### `GET /api/v1/settings`

Returns the **three-layer merged** settings tree plus the freshness
token for optimistic locking. Merge order (per **ADR-020** + roadmap
`road-to-global-only-install` § Phase 2.2):

```text
defaults (src/config/agent-settings.template.yml)
  < global (~/.event4u/agent-config/settings/.agent-settings.yml)
    < project (<projectRoot>/settings/.agent-settings.yml, optional)
```

Defaults come from the package template with `__RULE_LOADING_TIER__` /
`__USER_TYPE__` placeholders substituted for their permissive defaults
(`balanced` / `""`). Global and project layers are read with the typed
subdir preferred over the legacy flat path. The route mirrors
`scripts/install.py::read_layered_settings` 1:1 so the Python installer
and the Fastify GUI cannot drift.

Response (200):

```json
{
    "values":       { "rule_loading_tier": "balanced", "...": "..." },
    "lastModified": 1747749791842,
    "path":         "settings/.agent-settings.yml",
    "legacyHints":  { "user_name": "Matze" }
}
```

`legacyHints` is an out-of-band sidecar carrying values that have moved
out of `settingsSchema` but still live in a pre-v2 file on disk. Keys
are omitted when empty, never `null`. Current hints:

| Key         | Source (legacy)        | New home                                |
| ----------- | ---------------------- | --------------------------------------- |
| `user_name` | `personal.user_name`   | `.agent-user.md` &rarr; `identity.name` |

The wizard consumes hints on first run only — when `.agent-user.md`
does not yet exist — to pre-fill the merged identity field. Subsequent
PUTs strip the legacy keys (Zod-unknown), so the next read returns no
hints.

Errors: **404** when **neither** the global nor the project file
exists (defaults alone are not an "installed" state — the SPA should
redirect to `/#/wizard/Welcome`); **500** with `code=YAML_PARSE` when
either layer is on disk but unparseable (body includes the line/column).

### `POST /api/v1/settings/diff`

Computes the merged delta without writing. Used by the **Preview
changes** modal. Request:

```json
{
    "values":             { "...": "..." },
    "ifUnmodifiedSince":  1747749791842
}
```

Response (200): `{ "changes": [{ "path": "rule_loading_tier", "from": "minimal", "to": "balanced" }, ...] }`.

Errors: **409** on mtime drift; **422** on validation failure (`fields`
populated).

### `PUT /api/v1/settings`

Validates, merges with disk, writes atomically.

Request: same shape as `/diff`. Required header:
`If-Unmodified-Since: <ms-epoch>`.

Response (200): `{ "lastModified": <new-ms-epoch>, "writtenPaths": [".agent-settings.yml"] }`.

Errors: **412 Precondition Required** when the header is absent;
**409 Conflict** when the on-disk mtime is newer than the header value;
**422 Unprocessable Entity** with per-field errors on validation
failure; **500** with `code=ATOMIC_WRITE` if the temp-rename loop fails.

### `GET /api/v1/user-md`

Reads `<projectRoot>/.agent-user.md`. Returns `{ body: '', exists: false, lastModified: null }`
when the file is missing (wizard pre-fill case).

### `GET /api/v1/user-md/template`

Returns the package-shipped template (`src/templates/agent-user.md`) when
present, else 204 No Content. Wizard uses this to pre-fill the textarea
on first run.

### `PUT /api/v1/user-md`

Validates the body through `userMdSchema` (`gray-matter` parse must
succeed; ≤ 8 000 chars). Atomic-writes with mode 0600.

Required header: `If-Unmodified-Since: <ms-epoch>` (omitted only when
`exists=false` on the prior GET — server treats absence as "create new").

### `GET /api/v1/wizard/state`

Returns the persisted partial wizard state, or
`{ step: 0, totalSteps: <N>, partial: {}, startedAt: null }` when no
state file exists.

### `POST /api/v1/wizard/state`

Persists partial state between step transitions. Body:
`{ step: number, partial: Record<string, unknown> }`.

### `POST /api/v1/wizard/finish`

Two-Phase-Commit (council HIGH 2026-05-18): assigns a `txnId`, writes
`settings.yml.tmp-{txnId}` + `user-md.tmp-{txnId}` + an empty
`wizard.commit-intent-{txnId}` marker, renames both target files, then
deletes the marker. Server boot replays orphaned markers idempotently.

Response (200): `{ writtenPaths: string[], txnId: string }`.

Errors: **500** with `code=TXN_PARTIAL` when the marker survives a crash
(client should redirect the user to a "your last save is being
recovered" screen and refetch state).

## CLI: `agent-config settings migrate`

Companion to the layered reader (ADR-020). Lifts an existing
project-local `.agent-user.yml` / `.agent-settings.yml` into
`~/.event4u/agent-config/`. Idempotent — refuses to overwrite a
non-empty global file without `--force`. Order matches Phase 5
amendment A2 (`copy → verify`; the destructive `move` step is owned by
the unified `agent-config migrate` command, not this subcommand — see
`docs/contracts/migrate-command.md`).

Flags:

- `--from <path>` — project root to read from (default: `cwd`).
- `--force` — overwrite a non-empty global file.
- `--dry-run` — list intended copies; zero writes; exit 0.

Exit codes: `0` on success or no-op; `1` on validation failure or a
non-empty global file without `--force`.

## Status codes summary

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| 200  | Success                                              |
| 204  | No content (template-not-shipped case)               |
| 404  | Target file missing                                  |
| 409  | `If-Unmodified-Since` drift                          |
| 412  | `If-Unmodified-Since` header missing on write        |
| 422  | Validation failure (`error.fields` populated)        |
| 500  | YAML parse / atomic-write / 2PC partial recovery     |

## Test fixtures

Round-trip fixtures live in `tests/server/fixtures/`. Every endpoint
above has a happy-path test in `tests/server/<endpoint>.test.ts` and at
least one error-path test (409 or 422). The schema↔template parity
test (`tests/server/schemas/parity.test.ts`) is the gate that keeps
`settingsSchema` and `src/config/agent-settings.template.yml` in lockstep.
