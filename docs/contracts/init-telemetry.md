---
stability: beta
keep-beta-until: 2026-08-13
---

# Init Telemetry v1

> **Status:** beta · **Depends on:** install-time `user_type` axis telemetry wire-up · **Stability:** additive only

## Purpose

Define the wire-shape, redaction floor, opt-in semantics, and producer/consumer split for anonymous telemetry emitted by `agent-config init --interactive`. Used to validate the **Universal-OS reframe hypothesis**: that real `init` runs distribute across non-developer `user_type` values, not only `developer`.

This contract ships **ahead of execution**. The producer (`scripts/install.py`) and consumer (aggregation endpoint) are gated on `step-9` user-type filtering — until that ships, this document is the binding shape for the deferred implementation.

## Scope

Defines:

- The single event emitted (`init.user_type.selected`).
- Field allowlist (no PII, no free-form text, no host fingerprints).
- Opt-out default (no event without explicit `--telemetry=on` or `.agent-config.local.json` opt-in).
- Endpoint contract (HTTPS POST, JSON, retention).

Does **not** define:

- Aggregation queries or dashboards (consumer concern).
- Other agent-config events — this contract is `init`-scoped.

## Iron Law — opt-out by default

```
NO TELEMETRY UNLESS THE USER OPTED IN THIS RUN OR IN .agent-config.local.json.
NO IP, NO HOSTNAME, NO PATH, NO USERNAME, NO FREE-FORM TEXT.
```

The `--interactive` flag MUST surface the telemetry choice on first run with a clear default (`off`). The choice is persisted to `.agent-config.local.json` under `telemetry.init: true|false`. Re-runs read the persisted value; `--telemetry=on|off` overrides for that run only.

## Event shape

One JSON object per emitted event. UTF-8, no trailing newline:

```json
{
  "event": "init.user_type.selected",
  "schema_version": 1,
  "ts": "2026-05-15T00:00:00Z",
  "user_type": "creator",
  "stack": "none",
  "verbosity": "normal",
  "interactive": true,
  "agent_config_version": "1.4.2",
  "install_id": "anon-7f3a2b1c"
}
```

**Field rules:**

| Field | Type | Required | Allowed values |
|---|---|---|---|
| `event` | string | yes | `init.user_type.selected` (only event in v1) |
| `schema_version` | int | yes | `1` |
| `ts` | string | yes | ISO-8601 UTC, second precision |
| `user_type` | string | yes | `creator` · `founder` · `consultant` · `gtm` · `finance` · `ops` · `developer` |
| `stack` | string | yes | `none` · `laravel` · `nextjs` · `python` · `symfony` · `generic` |
| `verbosity` | string | yes | `quiet` · `normal` · `verbose` |
| `interactive` | bool | yes | `true` if `--interactive`, `false` if env-var path |
| `agent_config_version` | string | yes | semver from `package.json` |
| `install_id` | string | yes | random 8-char hex, generated on first opt-in, persisted to `.agent-config.local.json` under `telemetry.install_id` |

**Forbidden fields:** IP, hostname, OS user, working-directory path, project name, git remote, env vars beyond the version stamp, any free-form text.

## Install-id semantics

- Generated **only** when the user opts in.
- Random 8 hex chars (`secrets.token_hex(4)`) — collision space is sufficient for "is this the same install retrying?" without identifying the install.
- Persisted to `.agent-config.local.json` under `telemetry.install_id`.
- Deleting the file regenerates the id on next opt-in — by design.
- Never sent if opt-out is active.

## Endpoint contract

- **URL:** `https://telemetry.event4u.app/v1/agent-config/init` (placeholder; final URL pinned when consumer ships).
- **Method:** POST, `Content-Type: application/json`, body is one event object.
- **Auth:** none — anonymous by design.
- **Timeout:** 2 s connect, 3 s total. Failure is silent — `init` MUST NOT block or error on telemetry failure.
- **Retention:** events aggregated to user-type counts per day; raw events purged after 30 d. Aggregate retention 24 months.
- **Region:** EU-hosted (GDPR Art. 3 footprint; no Standard Contractual Clauses needed for EU installs).

## Opt-out mechanics

`.agent-config.local.json`:

```json
{
  "telemetry": {
    "init": false
  }
}
```

When `telemetry.init: false`, the producer:

1. Skips event construction entirely.
2. Does NOT generate or persist `install_id`.
3. Logs nothing to stderr.
4. `--telemetry=on` for the run overrides only that invocation (does not persist).

## GDPR fit

- **Lawful basis:** consent (Art. 6(1)(a)). The `--interactive` prompt is the consent surface.
- **Data minimization:** Art. 5(1)(c) — only the seven fields above; the field allowlist is the redaction floor.
- **Storage limitation:** Art. 5(1)(e) — 30 d raw, 24 mo aggregate.
- **Right to withdraw:** Art. 7(3) — `telemetry.init: false` revokes consent; no further events emitted. Already-collected events remain in the aggregate counts (anonymous, no link to person).
- **Right of access / erasure:** Arts. 15 / 17 — `install_id` is the only handle; the user can rotate it by deleting `.agent-config.local.json`, breaking the link from current to future events.

## Producer / consumer split

| Side | Responsibility | Where |
|---|---|---|
| **Producer** | Construct + POST the event when opt-in is active. Silent failure. | `scripts/install.py::_emit_init_telemetry()` (deferred to `step-9` wire-up). |
| **Consumer** | Receive + validate against this schema; aggregate per UTC day; purge raw after 30 d. | Telemetry endpoint (not in this repo; pinned URL ships with `step-9`). |

## Cross-references

- [`universal-skills.md`](universal-skills.md) — sibling contract for the allowlist this telemetry validates against.
- [`router-blending.md`](router-blending.md) — the user-type → skill blend that telemetry confirms is being used.
- [`STABILITY.md`](STABILITY.md) — schema_version bump rules.

## Versioning

`schema_version=1` is additive-only. Field additions require an `init-telemetry.md` patch and producer support. Field removals or type changes require a new `schema_version` and a producer that emits both shapes for ≥ 1 minor release.
