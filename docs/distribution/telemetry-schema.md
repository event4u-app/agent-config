# Install-Funnel Telemetry — Wire Schema

> **Status: source-only / inert.** This document specifies the install-funnel
> telemetry contract. The client SDK ships in this repository with the remote
> kill-switch defaulting to **off** and the production endpoint unset, so no
> traffic is emitted from any consumer install until the maintainer deploys
> the worker under a separate PR. See `non-destructive-by-default` — worker
> deploy is Hard-Floor and requires explicit per-turn maintainer authorization.

This is **install-funnel** telemetry. It is distinct from
`telemetry.artifact_engagement` (agent-runtime skill/rule/command usage,
stored locally per consumer project — see
[`artifact-engagement-flow`](../../packages/core/.agent-src.uncondensed/contexts/contracts/artifact-engagement-flow.md)).
The two systems do not share storage, transport, or opt-in state.

## Goals

Close the "we have no idea where consumers drop in the install funnel" blind
spot named in `feedback6.txt § 10`, while staying inside three hard
constraints:

1. **Privacy-by-default** — opt-in, off by default, anonymous beyond
   reasonable doubt, no PII, no quasi-IDs that re-identify under combination.
2. **GDPR-fit out of the box** — lawful basis is consent under
   Art. 6(1)(a); short retention; no cross-session linkability beyond a
   2-hour server-issued session.
3. **Cheap to drop** — if we kill the system we leave no orphan data.

## Funnel stages (one event per stage)

```text
started
  └→ wizard_opt_in_seen        (browser GUI only)
  └→ wizard_opt_in_accepted    (browser GUI only)
  └→ packs_selected
  └→ applied
  └→ first_command_run         (optional, ≤ 7 days after applied)
  └→ errored                   (terminal; mutually exclusive with applied)
```

## Wire shape (one POST per stage event)

`POST <worker-base-url>/install-event` with JSON body:

```jsonc
{
  "schema_version": "1",
  "event": "install_stage",
  "stage": "started" | "wizard_opt_in_seen" | "wizard_opt_in_accepted"
         | "packs_selected" | "applied" | "first_command_run" | "errored",
  "ts": "2026-05-24T10:00:00Z",
  "session_id": "<server-issued, 128-bit, 2h TTL; omit on first event>",
  "entry_path": "npx" | "curl" | "gui",
  "host_agent_family": "vscode" | "jetbrains" | "cli" | "browser" | "unknown",
  "os": "linux" | "macos" | "windows",
  "node_major": "20" | "22",
  "agent_config_version": "<semver>",
  "pack_categories": ["finance" | "founder" | "engineering" | "content"
                    | "consultant" | "meta" | "other"],
  "wizard_used": true | false,
  "duration_bucket": "<30s" | "30s-2m" | "2m-10m" | ">10m",
  "error_class": "network" | "filesystem" | "config_invalid"
              | "dependency" | "unknown"
}
```

### `session_id` is server-issued, not client-issued

Per the AI Council Round-2 verdict, the client never generates an identifier.
The first event in a session POSTs **without** `session_id`. The worker
generates a random 128-bit token, writes it to KV with a 2-hour TTL, and
returns it in the response. Subsequent stage events include the returned
`session_id` so the worker can stitch the funnel.

Sessions that exceed 2 hours appear as two unstitched events. This is
acceptable — sessions that long are statistical outliers.

### Field-by-field rationale

| Field | Rationale | Re-identification risk |
|---|---|---|
| `session_id` | Server-controlled session stitching; 2h TTL; never persisted client-side | None (auto-expires) |
| `entry_path` | Required to compare npx vs curl vs GUI funnels | None (3 buckets) |
| `host_agent_family` | Required to compare IDE vs CLI completion rates | Low (4 buckets) |
| `os` | Required to spot OS-specific install failures | Low (3 buckets) |
| `node_major` | Required to spot Node version issues | Low (2 buckets) |
| `agent_config_version` | Required to spot regression on a new release | Low |
| `pack_categories` | Actionable funnel signal (which packs convert?) | Low (small fixed enum, no pack names) |
| `wizard_used` | Wizard vs TUI completion comparison | None |
| `duration_bucket` | Coarse timing; 4 buckets; no side-channel | None (vs `duration_ms` which leaks CI vs human) |
| `error_class` | 5 buckets; never freeform; never a stack | None |

## What we NEVER send

- IP address (Cloudflare drops it before the worker reads the request body;
  the worker code does not log or persist `cf-connecting-ip`).
- Any machine identifier, MAC, hostname, username, home-directory path.
- Project name, project path, repository slug, git remote URL.
- Pack **names** (only the small fixed `pack_categories` enum is sent).
- File paths of any kind.
- Error stacks, error messages, or freeform `error_class` strings.
- Anything the user typed (prompts, ticket IDs, ad-hoc commands).
- Any timing field with sub-bucket precision (no `duration_ms`).

## Retention

| Tier | Storage | TTL | Notes |
|---|---|---|---|
| Raw stage events | Cloudflare KV | 14 days | Keyed by `event:<session_id>:<stage>` |
| Sessions | Cloudflare KV | 2 hours | Keyed by `session:<session_id>` |
| Weekly aggregates | Cloudflare KV | 24 months | Keyed by `funnel:weekly:<iso-week>`, no `session_id` |

Aggregates contain only stage counts and bucketed dimension counts. No
`session_id` is retained beyond 14 days.

## Authentication and abuse resistance

- **Per-channel HMAC signing.** Each entry path (`npx`, `curl`, `gui`) ships
  with its own pre-shared HMAC secret embedded at build time. The installer
  computes `HMAC-SHA256(secret, body)` and sends it in the `x-install-sig`
  header. The worker validates the signature before parsing the body.
  Rotation is handled by shipping a new installer release.
- **Rate-limit per `session_id`.** The worker caps each session at 20 events
  total. Excess events return `429`.
- **Body size cap.** Bodies > 4 KB are rejected with `413`.
- **Schema strictness.** Unknown fields cause `400`. Validators run before
  KV writes.

## Remote kill-switch

The installer reads a Cloudflare-hosted feature-flag JSON
(`https://<flag-host>/install-telemetry-flags.json`, cached for 1 hour,
default `enabled=false` if unreachable) before each session. If the flag
returns `enabled: false`, the SDK is a no-op for the entire session — no
session is opened, no `started` event is sent, no opt-in prompt is shown.

This gives the maintainer a one-line config change to disable telemetry
across all consumers within 1 hour, independent of installer releases.

## Worker contract

`POST /install-event` — see fields above. Returns:

- `200 { session_id }` on the first event of a session.
- `204 No Content` on subsequent stage events.
- `400 { error }` on schema mismatch or unknown fields.
- `401` on missing or invalid HMAC.
- `413` on body > 4 KB.
- `429` on per-session rate limit.
- `5xx` on worker error — the SDK fails open (no retry, no log).

`GET /install-telemetry-flags.json` — see kill-switch above. Returns
`{ enabled: bool, schema_version: "1" }`.

## Versioning

`schema_version: "1"` is the contract above. A breaking change ships
`schema_version: "2"` alongside `/install-event/v2`. The worker maintains v1
for ≥ 90 days after v2 ships. The installer always reports the version it
was built with — no client-side migration.

## Open questions for a follow-up PR

- Should `pack_categories` include `other` or omit unknown? Currently `other`
  is included to avoid silent loss.
- Should `errored` events be retained longer (30 days) for incident
  investigation? Decision deferred to first operational quarter.

## See also

- [`telemetry-privacy.md`](telemetry-privacy.md) — reader-facing privacy doc.
- [AI Council Round-2 transcript](../../agents/runtime/council/responses/install-telemetry.json) — verdict + revisions.
- `agents/roadmaps/road-to-product-adoption.md § Phase 4`.
- `non-destructive-by-default` — worker deploy is Hard-Floor.
