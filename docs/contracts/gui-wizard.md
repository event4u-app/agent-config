---
stability: beta
keep-beta-until: 2026-08-19
---

# GUI wizard — local browser installer

> Companion to the agent-mode protocol
> ([`installer-agent-mode.md`](installer-agent-mode.md)) and the
> trust-and-safety layer ([`trust-and-safety.md`](trust-and-safety.md)).
> The wizard is a thin HTTP wrapper around the same install plan, the
> same lockfile, and the same atomic-write semantics as the CLI/TUI
> paths. It is **optional by design** — the CLI is the canonical entry
> point; the wizard exists for non-technical users who want a visual
> picker.

## Source of truth

- Server: [`packages/core/installer/src/gui/server.ts`](../../packages/core/installer/src/gui/server.ts)
- Handlers: [`packages/core/installer/src/gui/handlers.ts`](../../packages/core/installer/src/gui/handlers.ts)
- Security primitives: [`packages/core/installer/src/gui/security.ts`](../../packages/core/installer/src/gui/security.ts)
- Inlined SPA: [`packages/core/installer/src/gui/static-assets.ts`](../../packages/core/installer/src/gui/static-assets.ts)
- Transaction log: [`packages/core/installer/src/gui/transaction-log.ts`](../../packages/core/installer/src/gui/transaction-log.ts)
- Tests: [`packages/core/installer/tests/gui-*.test.ts`](../../packages/core/installer/tests/)

## Local-only invariant

The server **must** bind to `127.0.0.1` and reject any request whose
`Host` header is not in `{ "127.0.0.1:<port>", "localhost:<port>" }`.
`Origin` is additionally checked on every POST. No CDN, no analytics,
no cross-origin asset, no remote endpoint — CSP
`default-src 'self'` is set on every response.

## Boot sequence

```
npx @event4u/agent-config init --gui [--gui-port=<n>] [--no-open] [--gui-idle=<s>]
  │
  ├─► inspect agents/runtime/gui/server.pid → abort if live
  ├─► load dist/discovery/discovery-manifest.json (walks up from CWD)
  ├─► generate per-server CSRF token (64-hex)
  ├─► http.createServer + listen({ host: '127.0.0.1', port: 0 })
  ├─► write agents/runtime/gui/server.pid (POSIX pid, single line)
  ├─► default-spawn the OS browser opener (skipped with --no-open)
  └─► return GuiServerHandle { url, port, csrfToken, pidFile, close }
```

Idle timeout (default 600 s, configurable via `--gui-idle`) is keyed on
the **last HTTP request timestamp**, not on SSE event activity.

## Endpoints

| Method | Path             | Purpose                                              |
|--------|------------------|------------------------------------------------------|
| GET    | `/`              | SPA shell with CSRF token injected via `<meta>`      |
| GET    | `/app.css`       | Static stylesheet                                    |
| GET    | `/app.js`        | Inlined SPA logic                                    |
| GET    | `/api/manifest`  | `{ manifest, sha256 }` — bytes-identical to disk     |
| GET    | `/api/auto-detect` | `{ signals: { composer, package, pyproject } }`    |
| POST   | `/api/preview`   | `{ plan, lockfileSha256 }` for current selection     |
| POST   | `/api/apply`     | SSE: `plan-file`, `progress`, `done`, `error`        |
| POST   | `/api/cancel`    | Flush in-flight transaction log, close SSE stream    |

All POSTs require:

1. `Origin` header matching `http://127.0.0.1:<port>` or
   `http://localhost:<port>`.
2. Body field `csrf` matching the per-server token (timing-safe
   compare in `security.ts`).

A bad CSRF returns `403` with no body. A bad Origin or Host returns
`403` with a short plaintext reason.

## Transaction log + rollback

Every `POST /api/apply` writes append-only JSONL entries to
`<projectRoot>/agents/runtime/gui/install-<ts>.log`. Shapes are
declared in
[`types.ts § TransactionLogEntry`](../../packages/core/installer/src/gui/types.ts):

- `start` — workspaces + packs selected
- `plan` — one entry per planned write (`path`, `pack`)
- `commit` — `filesWritten`, `lockfileSha256`
- `cancel` — explicit `POST /api/cancel`
- `error` — terminating failure with `message`

The next `--gui` boot inspects the most recent log and offers to roll
back if it ended on `start`/`plan`/`error` without a matching
`commit`/`cancel`. The CLI path consumes the same log, so a mid-install
crash can be undone from either entry point.

## SSE event framing

Every `POST /api/apply` event is `data: <json>\n\n`. The terminal event
is one of:

```jsonc
{ "type": "done", "filesWritten": 12, "lockfileSha256": "<64-hex>" }
{ "type": "error", "message": "<reason>" }
```

The browser closes the EventSource on either; the server flushes the
transaction log and unblocks the idle timer.

## Tarball budget

GUI assets under `packages/core/installer/src/gui/` (inlined HTML +
CSS + JS in `static-assets.ts`) must stay **≤ 200 KB compiled**. The
constraint is enforced by reviewer judgment for now; a CI check is
tracked under the Phase 6 follow-ups.

## Security failure modes covered

- **Remote exploitation** — loopback bind, Host allowlist, Origin
  allowlist, CSRF token, CSP `default-src 'self'`.
- **DNS rebinding** — Host header check covers POSTs that omit
  `Origin` (form posts).
- **Zombie servers** — ephemeral port + PID file + last-request idle
  timer. Stale PIDs (process gone) are silently overwritten on next
  boot; live PIDs block boot with a helpful message.
- **Mid-install crash** — transaction log + boot-time rollback prompt.
- **Hidden state** — closing the tab triggers idle timeout; no
  cross-tab session.

## Non-goals (documented contract)

- Not a hosted SaaS — no auth, no account model, no telemetry.
- Not a settings editor — read-only on the lockfile; writes go
  through the same install plan as the CLI.
- Not a CI surface — every operation is reachable via `--gui-port=0
  --no-open` is supported for headless smoke tests, but the canonical
  CI path is the flag-driven non-interactive CLI.

## Apply payload — versioning handshake (road-to-global-only-install Phase 0.4 · D12)

`/api/apply` accepts a discriminated-union body keyed on
`schema_version`. The full JSON Schema lives at
[`internal/schemas/wizard-apply-payload.schema.json`](../../internal/schemas/wizard-apply-payload.schema.json).

| `schema_version` | Variant | Shape |
|---|---|---|
| `"installer-v1"` | `InstallerPayloadV1` | `{ ai_tools[], configs{}, dry_run? }` — legacy Installer-GUI, AI tools only. |
| `"wizard-v2"` | `WizardPayloadV2` | `{ tools[], packs[], settings{}, scope_to_project_only?, dry_run? }` — unified 9-step wizard. |

**D12 (locked).** Single `/api/apply` endpoint with a `schema_version`
discriminator — **not** two endpoints with a shared Python backend.
Reasoning: one bind, one CSRF token, one transaction log; the
Python `scripts/install.py` payload-router branches on
`schema_version` before any disk write. The dual-endpoint variant was
considered and rejected for doubling the CSRF + idle-timer surface
with no observability gain.

`schema_version` is **required**. Servers MUST reject any body that
lacks it (HTTP 400, single-line error pointing at the schema). This
locks the contract before Phase 1 implementation so no implicit fork
can sneak in at Phase 1.5.

## Unified 9-step flow (road-to-global-only-install § Phase 1.6)

The maintainer-facing wizard at `src/server/routes/wizard.ts` switches
between two step layouts based on the server-side `extendedSteps`
flag (default `false` for v2.x users; flipped to `true` by the
`agent-config setup` CLI when the npm-version kill-switch is in
effect):

| `extendedSteps` | Steps | Layout |
|---|---|---|
| `false` | 7 | `editor → personality → cost → roadmap-quality → memory → user-md → review` |
| `true`  | 9 | `ai-tools → packs → editor → personality → cost → roadmap-quality → memory → user-md → review` |

The step shapes themselves are declared in
[`src/ui/wizard/steps.ts`](../../src/ui/wizard/steps.ts) — the two
prepended lead steps (`ai-tools`, `packs`) carry no `paths` and use
dedicated renderers in `WizardPage.tsx`. `getWizardSteps({ extended })`
is the single resolver; the UI consumes the active list via
`getActiveSteps()` / `activeTotalSteps()` so a server toggle takes
effect on the next reload without a code change.

### `GET /api/v1/wizard/state` payload

```jsonc
{
  "step": 0,
  "totalSteps": 9,
  "partial": {},
  "startedAt": null,
  "extendedSteps": true
}
```

`extendedSteps` is **advisory** — older server bundles MAY omit it,
and the UI treats `undefined` as `false`. `totalSteps` reflects the
flow that was active when the partial was written, which the UI uses
for resume continuity; the active step set is otherwise derived from
the current `extendedSteps` flag.

### State persistence + recovery

Per-session state is written to `<writeRoot>/state/wizard-state.json`
(under the global config root, typically
`~/.event4u/agent-config/state/wizard-state.json`). If the file
becomes malformed — partial JSON write, orphaned session from a
previous npm version, manual edit gone wrong — the recovery path is:

```
agent-config doctor --repair wizard-state
```

The repair unlinks the file (idempotent; absent files are a no-op
success). The next `agent-config setup` boots from step 1 with a
fresh `startedAt`. A matching `wizard-state` health check is part of
the standard `agent-config doctor` run and surfaces malformed JSON or
schema-shape drift before the next setup attempt.

### Extended-mode endpoints

`extendedSteps: true` activates two additional read-only endpoints:

| Method | Path                          | Purpose |
|--------|-------------------------------|---------|
| GET    | `/api/v1/wizard/auto-detect`  | Project-signal evidence (composer / package / pyproject / artisan / next.config) for the `ai-tools` step. 404 when extended-mode is off. |
| GET    | `/api/v1/wizard/manifest`     | Locked discovery-manifest (ADR-015) so the `packs` step can render supported AI IDs + every pack the manifest exposes. 404 when extended-mode is off. |

