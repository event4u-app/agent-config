# `packages/core/deploy/` — internal AI OS container artefacts

Phase 1 of [`road-to-internal-ai-os-deployment.md`](../../../agents/roadmaps/road-to-internal-ai-os-deployment.md).
Decision shape: [`ADR-021`](../../../docs/decisions/ADR-021-deployment-shape.md).

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage Node 20 + TypeScript build → slim runtime image (~ 500 MB target). Non-root `agentcfg` user. Entrypoint: `agent-config-installer gui --host 0.0.0.0 --port 8787`. |
| `docker-compose.yml` | Single-host deployment. Services: `agent-config`, `redis`, `postgres`. Three named volumes. Host-side only `127.0.0.1:8787` is exposed; redis + postgres are container-internal. |

## Quickstart

```bash
# From the repo root:
docker compose -f packages/core/deploy/docker-compose.yml up --build
# wizard reachable at http://localhost:8787/  (after ~60s start-period)
docker compose -f packages/core/deploy/docker-compose.yml down
```

See [`docs/deploy/quickstart.md`](../../../docs/deploy/quickstart.md)
for the full operator walkthrough and
[`docs/deploy/env-vars.md`](../../../docs/deploy/env-vars.md) for the
environment-variable contract.

## What ships in Phase 1 vs later

| Concern | Phase 1 (this commit) | Later |
|---|---|---|
| Container image | ✅ runtime image, non-root user, healthcheck | — |
| Compose topology | ✅ agent-config + redis + postgres + volumes | — |
| `BIND_HOST` / `GUI_PORT` | ✅ env contract, server honors `--host` | — |
| `/api/v1/health` | ✅ CSRF-exempt, rate-limited | Cost-meter fields (Phase 3) |
| SSO / OIDC | ❌ defaults `AUTH_MODE=none` | Phase 2 — [`ADR-022`](../../../docs/decisions/ADR-022-identity-model.md) (deferred) |
| Central policy | ❌ defaults `POLICY_PATH` set but not read | Phase 3 — [`ADR-023`](../../../docs/decisions/ADR-023-central-policy.md) (deferred) |
| Team context | ❌ env unwired | Phase 4 |
| Connectors | ❌ env unwired | Phase 5 |

## Security posture (Phase 1)

- **Loopback-only port mapping** — `127.0.0.1:8787:8787` on the
  Compose host. Operators flip to `0.0.0.0:8787:8787` (or front
  with a reverse proxy) at their own discretion once Phase 2 SSO
  ships. Without auth, exposing the wizard to a non-loopback
  interface lets anyone on the network run install plans against
  the mounted volume — **do not do this in Phase 1**.
- **`ALLOWED_HOSTS` env** gates the server's Host-header check.
  Default `localhost:8787,127.0.0.1:8787`. Operators behind a
  reverse proxy must append their public hostname here.
- **Non-root container** — UID/GID 10001, no shell login.
- **Healthcheck** runs in-container against `127.0.0.1`, so the
  rate-limit (1 rps per IP) does not collide with operator probes
  on the host.

## Not in this directory

- **Kubernetes manifests / Helm chart** — deferred to v2 deployment
  roadmap. Compose covers the 5-50-person band that the roadmap
  targets; teams larger than that author their own chart from this
  Compose as the reference.
- **Reverse-proxy config (nginx, Caddy, Traefik)** — out of scope.
  Operators bring their own; `ALLOWED_HOSTS` is the only knob the
  server needs to know about.
- **TLS termination** — operator's reverse proxy owns it. The
  container speaks plain HTTP on the loopback.
