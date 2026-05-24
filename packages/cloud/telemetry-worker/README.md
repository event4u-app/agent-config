# `@event4u/telemetry-worker`

Cloudflare Worker that receives **install-funnel telemetry** from the
`@event4u/agent-config` installer. Source-only — deploying this worker
is a Hard-Floor maintainer action (see
[`non-destructive-by-default`](../../../.augment/rules/non-destructive-by-default.md)).

> **No traffic leaves any consumer install** until the maintainer
> deploys this worker AND flips the remote kill-switch flag to
> `enabled: true` AND a consumer explicitly opts in during interactive
> install. See [`telemetry-schema.md`](../../../docs/distribution/telemetry-schema.md)
> for the wire contract and
> [`telemetry-privacy.md`](../../../docs/distribution/telemetry-privacy.md)
> for the consumer-facing policy.

## What it does

- Accepts `POST /install-event` from the installer SDK.
- Validates HMAC-SHA256 signature per channel (`npx`, `curl`, `gui`).
- Issues a server-side `session_id` on the first event of a session
  (128-bit random, 2-hour KV TTL).
- Persists stage events with 14-day KV TTL.
- Caps each session at 20 events (`429` over).
- Rejects bodies > 4 KB (`413`).
- Rejects unknown fields or invalid stages (`400`).
- Drops `cf-connecting-ip` — never logs, never persists.

## What it explicitly does NOT do

- No IP logging. No `cf-connecting-ip` reads.
- No machine identifiers, project paths, pack names, error stacks.
- No client-controlled identifiers.
- No cross-session linkability beyond the 2-hour session window.
- No retry — the SDK is fire-and-forget and the worker fails open on
  any 5xx.

## Bindings (required at deploy time)

| Binding | Kind | Purpose |
|---|---|---|
| `TELEMETRY_KV` | KV namespace | Sessions + raw events + weekly aggregates |
| `HMAC_NPX` | Secret | Per-channel HMAC for npx entry |
| `HMAC_CURL` | Secret | Per-channel HMAC for curl entry |
| `HMAC_GUI` | Secret | Per-channel HMAC for GUI entry |

## Layout

```
src/
  index.ts          — fetch handler + routing
  hmac.ts           — HMAC-SHA256 validation
  session.ts        — session_id generation + KV layout
  validate.ts       — JSON schema check
  aggregate.ts      — weekly aggregate increment
  kv-keys.ts        — KV key naming
  types.ts          — wire-format types (mirrors installer SDK)
```

## Deploy gating

`wrangler deploy` runs only when:

1. The maintainer authorizes the deploy on the current turn (Hard-Floor).
2. All three HMAC secrets are set via `wrangler secret put`.
3. The KV namespace ID is bound in `wrangler.toml`.
4. The weekly-aggregate cron is configured.

See `docs/distribution/telemetry-schema.md § Worker contract` for the
HTTP contract this worker implements.
