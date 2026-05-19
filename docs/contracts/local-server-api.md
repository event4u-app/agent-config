---
stability: beta
keep-beta-until: 2026-08-17
---

# Local server API — `agent-config ui:serve`

> **Status:** active · **Stability:** beta · **Owner:** ADR-012 (TypeScript CLI shell)
> · **Surface:** `src/server/**` · **Tests:** `tests/server/**`

Locks the wire shape, security stance, and lifecycle of the embedded
HTTP server that `agent-config ui:serve` boots. Phase 5 of
`typescript-cli-and-local-gui-foundation` ships this contract behind
the flipped TS binary; downstream Roadmap-2 (in-browser wizard) builds
against it.

## § 1 — Bind and port

- **Bind address.** `127.0.0.1` only. The server **never** binds to
  `0.0.0.0` or a routable interface. Enforced in
  `src/cli/commands/uiServe.ts`.
- **Port range.** First free TCP port in `[41000, 41999]`, scanned
  ascending. Picker: `src/server/port.ts#pickFreePort`. If the entire
  range is occupied, the command exits non-zero with a guidance line
  pointing at the range.
- **No remote access.** No published TLS, no reverse-proxy story.
  Operators who need remote access tunnel via `ssh -L` or equivalent;
  the package does not ship that path.

## § 2 — Authentication — per-process bearer token

- Minted at boot by `src/server/token.ts#mintToken` (URL-safe,
  256 bits of entropy from `crypto.randomBytes`).
- Required on **every** `/api/*` route via either:
  - `Authorization: Bearer <token>`, **or**
  - `?token=<token>` query parameter (the UI uses this so the
    browser can bootstrap from the URL).
- Token comparison runs through `tokensMatch` — constant-time over
  equal-length inputs.
- The token is printed to **stderr** by `ui:serve` once, prefixed
  with `agent-config: token=` so log scrapers can redact it. Never
  written to disk by the package.
- Static UI files under `/` are **not** gated — the browser must be
  able to fetch the HTML before it can present the token.

## § 3 — Defence-in-depth headers

- **Host-header guard.** `Host` MUST be `127.0.0.1:<port>` or
  `localhost:<port>`. Other values → `421 Misdirected Request`.
  Blocks DNS-rebinding from a malicious page that resolves an
  attacker-controlled hostname to `127.0.0.1`.
- **Origin allow-list.** When `Origin` is present, it MUST equal
  `http://127.0.0.1:<port>` or `http://localhost:<port>`. Other
  values → `403 Forbidden`. Absent header is allowed (server-to-server
  callers, `curl` without `-H`).
- **CORS.** No `Access-Control-Allow-Origin` header. The server is
  same-origin to the bundled UI by construction; browsers from any
  other origin are blocked by the same-origin policy before
  `Origin` is even checked.

## § 4 — Routes

### `GET /api/v1/ping`

Liveness probe. Used by:
- The bundled UI to confirm it reached the right process.
- `agent-config doctor-shell` (future — Phase 6).
- CI smoke tests (`tests/cli/cli-e2e.test.ts`).

**Request:** no body. Token via header or query.

**Response — `200 OK`:**

```json
{
  "ok": true,
  "version": "2.26.0",
  "projectRoot": "/abs/path/to/project"
}
```

- `ok` — literal `true`.
- `version` — value of `package.json#version` at boot time.
- `projectRoot` — absolute path the CLI resolved (see
  `src/cli/paths.ts`).

Schema source of truth: `src/server/routes/ping.ts#PingResponseSchema`
(zod). Test gate: `tests/server/app.test.ts`.

### Future routes (Phase 6+)

Reserved namespace under `/api/v1/`. Adding a new route requires:
- A zod schema export co-located with the handler.
- A `tests/server/` integration test that exercises the auth gate
  alongside the happy path.
- A CHANGELOG entry under the active Unreleased block.

## § 5 — Failure modes

| Condition | HTTP | Body shape |
|---|---|---|
| Missing/invalid token on `/api/*` | `401` | `{ "error": "Unauthorized: …" }` |
| Disallowed `Host` | `421` | `{ "error": "Misdirected Request: …" }` |
| Disallowed `Origin` | `403` | `{ "error": "Forbidden: …" }` |
| Port range exhausted | (no HTTP — CLI exit non-zero) | — |

## § 6 — Lifecycle

- **Boot.** `ui:serve` picks a free port, mints the token, builds
  the Fastify app via `createApp`, and prints the URL + token to
  stderr. By default it also opens the OS browser at `/` with the
  token in the query string; `--no-open` suppresses that step.
- **Headless detection.** When `process.stdout.isTTY === false` AND
  `--open` was not explicitly passed, the server boots but does not
  attempt to spawn a browser. Useful for CI and SSH sessions.
- **Shutdown.** SIGINT / SIGTERM stops the server cleanly; the
  per-process token is dropped from memory.

## § 7 — Stability commitments

- Wire shape (route paths, response keys, status codes) — covered
  by the contract above. Breaking change requires SemVer-major.
- Security stance (§ 1–3) — strengthening is non-breaking;
  weakening (e.g. removing the Host guard) is a breaking change.
- Port range — narrowing is breaking, widening is non-breaking.
- The token is **never** exfiltrated to logs, telemetry, or
  observability backends by the package itself.

## Related contracts

- `docs/decisions/ADR-012-typescript-cli-shell.md` — the parent
  decision (shell choice, source layout, dependency surface).
- `docs/contracts/STABILITY.md` — what `stability: beta` means and
  the promotion path.
