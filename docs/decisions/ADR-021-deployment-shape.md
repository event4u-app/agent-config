---
adr: 021
status: accepted
date: 2026-05-24
decision: deployment-shape
supersedes: —
superseded_by: —
phase: v3.x · internal-AI-OS deployment Phase 1
type: forward-looking
---

# ADR-021 — Deployment shape (internal AI OS, Phase 1)

## Status

**Accepted** · 2026-05-24. Phase 1 of
[`road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md)
ships the container image + Compose topology + host binding +
healthcheck. Phases 2–5 (identity, central policy, team context,
connectors) are tracked but **not yet implemented**; their ADRs
(022–025) are reserved but unwritten.

Companion artefacts:

- Roadmap: [`agents/roadmaps/road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md)
- Artefacts: [`packages/core/deploy/`](../../packages/core/deploy/)
- Env contract: [`docs/deploy/env-vars.md`](../deploy/env-vars.md)
- Council question (drafted, not invoked — no keys): [`agents/tmp/council-question-deployment-shape.md`](../../agents/tmp/council-question-deployment-shape.md)
- Predecessor ADR: [`ADR-016`](ADR-016-installer-architecture.md) — installer architecture (agent-mode protocol the GUI server wraps).

## Context

For the first two years `@event4u/agent-config` shipped as a
developer-local tool: `npx @event4u/agent-config init` writes files
into the consumer repo, the wizard runs on `127.0.0.1`, no state
persists beyond the lockfile. Field signal (multiple companies asking
"can we host this for the team?") motivates a second shape: a
**single deployed instance per organization**, hosting wizard +
Council + memory for 5–50 engineers behind their SSO.

Three structural questions had to settle before code:

1. **Topology** — bare Compose vs Helm vs both.
2. **Process shape** — single Node container vs Node + Python sidecar.
3. **Boot-time safety** — what happens when the operator inevitably
   flips `127.0.0.1:8787` to `0.0.0.0:8787` before authentication
   lands in Phase 2.

## Decision

### 1. Topology — Compose-first, Helm deferred

A single `docker-compose.yml` under `packages/core/deploy/` is the
shipped artefact. Three services: `agent-config` (the Node image),
`redis`, `postgres`. Three named volumes for runtime state, Postgres
data, and the per-user `~/.event4u/agent-config/` mount.

Helm / k8s manifests are **deferred** to a future v2 deployment
roadmap. Compose covers the 5–50-person band; larger teams author
their own chart using this Compose as the reference until v2 ships.

### 2. Process shape — single-process Node

The GUI server (`packages/core/installer/src/gui/server.ts`) is the
only long-running process. The Python install supervisor is spawned
per-install, not a sidecar. The Compose image stays Node-only to keep
the budget under 600 MB compressed and the surface area minimal.

If Phase 2+ needs a separate identity-broker process, it lands in a
separate service in the same Compose; the agent-config container stays
single-process.

### 3. Host binding — `127.0.0.1` default, `0.0.0.0` opt-in with safety gate

`startGuiServer` accepts `host` + `allowedHosts` options. CLI
exposes `--host` and `--allowed-hosts`; container defaults
`BIND_HOST=0.0.0.0` + `ALLOWED_HOSTS=localhost:8787,127.0.0.1:8787`.

**Hard rule**: non-loopback bind without `allowedHosts` refuses to
boot. Enforced at the CLI surface (`commands/gui.ts`) and at the
server entry (`gui/server.ts`). This is the structural mitigation
against operators flipping the host port mapping before Phase 2 SSO
ships.

### 4. Health endpoint — `/api/v1/health`, read-only, rate-limited

CSRF-exempt, GET-only. Returns `status`, `version`, `pack_version`,
`uptime_seconds`, `storage_mode`, `session_backend`, and
`manifest_sha256`. No secrets, no auth state, no PII.

Rate-limited to 1 request per second per remote IP via an in-memory
token bucket. Wide margin over the docker-default 10 s healthcheck
cadence; resilient to spoofed probes (the bucket map is bounded at
1024 entries and self-prunes).

### 5. Redis + Postgres in compose but unwired in Phase 1

Both services ship in the Compose topology with healthchecks and named
volumes, but the agent-config code does **not** read them in Phase 1:

- `STORAGE_MODE=postgres` is documented but the implementation still
  uses filesystem.
- `SESSION_BACKEND=redis` is documented but the implementation still
  uses in-memory state.

Surfacing both connection strings in `/api/v1/health` lets operators
verify connectivity *before* Phase 2 wires Postgres and Phase 3 wires
Redis.

### 6. No TLS in the container

The reverse-proxy (nginx / Caddy / Traefik / ALB) owns TLS
termination. The container speaks plain HTTP on the bound interface.
Out-of-scope for this ADR; documented in `packages/core/deploy/README.md`.

## Consequences

**Positive**

- Operators can `docker compose up` and reach a working wizard
  without writing infrastructure.
- The shape locks before Phases 2–5 add auth / policy / connectors —
  those phases extend the topology without rewriting it.
- `ALLOWED_HOSTS` gate eliminates the DNS-rebinding class of
  vulnerability at the boot layer.

**Negative**

- Teams already on k8s need to translate Compose to their own
  charts. Mitigated by the README pointing at the Compose as the
  reference.
- Postgres + Redis run unused in Phase 1, adding 60–80 MB RAM idle
  to the deployment footprint. Mitigated by being able to remove
  both services from the Compose if Phase 1 is the only phase the
  operator wants.

**Reversal cost** — low. Compose → Helm migration is mechanical once
the v2 deployment roadmap kicks off; the agent-config image itself is
orchestrator-agnostic.

## Open questions (council-deferred)

The accompanying council question file
[`agents/tmp/council-question-deployment-shape.md`](../../agents/tmp/council-question-deployment-shape.md)
has not yet been run (no provider keys configured). A maintainer with
keys should run it and either ratify or supersede this ADR.

## Cross-references

- Phase 1 artefacts: [`packages/core/deploy/`](../../packages/core/deploy/)
- Env contract: [`docs/deploy/env-vars.md`](../deploy/env-vars.md)
- Installer architecture: [`ADR-016`](ADR-016-installer-architecture.md)
- Global-only consumer scope: [`ADR-020`](ADR-020-global-only-consumer-scope.md) (orthogonal — local install model)
