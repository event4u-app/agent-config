# Environment variable contract — `agent-config` deployment

Phase 1 of [`road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md).
Decision shape: [`ADR-021`](../decisions/ADR-021-deployment-shape.md).

This file is the **single source of truth** for environment variables
read by the deployed container. Every knob below is consumed by either
the GUI server (TypeScript) or the embedded Python install supervisor.

| Variable | Required | Default | Phase | Meaning |
|---|---|---|---|---|
| `BIND_HOST` | no | `127.0.0.1` | 1 | Bind address. Set to `0.0.0.0` for container deployments; non-loopback REQUIRES `ALLOWED_HOSTS`. |
| `GUI_PORT` | no | `8787` | 1 | TCP port the wizard listens on. CLI override: `--port`. |
| `ALLOWED_HOSTS` | when host ≠ loopback | derived | 1 | Comma-separated `host:port` allowlist for the Host-header gate. Reverse-proxy hostnames go here. |
| `STORAGE_MODE` | no | `filesystem` | 1+ | `filesystem` (Phase 1) or `postgres` (Phase 2+). Audit log + memory backend. |
| `SESSION_BACKEND` | no | `memory` | 1+ | `memory` (Phase 1) or `redis` (Phase 3+). Wizard session + per-user state. |
| `AGENT_CONFIG_PROJECT_ROOT` | no | `/var/lib/agent-config/runtime` | 1 | Mountpoint the container treats as the consumer "project root". |
| `AGENT_CONFIG_GUI_NO_OPEN` | no | `1` (in image) | 1 | Set to suppress the browser-launch attempt — required in headless containers. |
| `AUTH_MODE` | no | `none` | 2 | `none` \| `oidc` \| `saml`. **Not yet read by the server** — placeholder for Phase 2. |
| `OIDC_ISSUER_URL` | yes when `AUTH_MODE=oidc` | — | 2 | OIDC discovery URL. Not yet consumed. |
| `OIDC_CLIENT_ID` | yes when `AUTH_MODE=oidc` | — | 2 | Not yet consumed. |
| `OIDC_CLIENT_SECRET` | yes when `AUTH_MODE=oidc` | — | 2 | Not yet consumed. Read from secret manager only. |
| `POLICY_PATH` | no | `/etc/event4u/policy.yaml` | 3 | Central org-policy YAML mount path. **Not yet read by the server** — placeholder for Phase 3. |
| `DATABASE_URL` | yes when `STORAGE_MODE=postgres` | — | 2+ | Postgres connection string. Compose-default points at the bundled service. |
| `REDIS_URL` | yes when `SESSION_BACKEND=redis` | — | 3+ | Redis connection string. Compose-default points at the bundled service. |

## What ships honoring these vs not

**Honored today (Phase 1):**

- `BIND_HOST` — server respects `--host` flag and `BIND_HOST` env.
- `GUI_PORT` / `--port` — server listens on this port.
- `ALLOWED_HOSTS` — `Host:`-header allowlist for the GUI gate.
- `STORAGE_MODE` / `SESSION_BACKEND` — surfaced in `/api/v1/health`
  responses but **storage and session implementations still default
  to filesystem and memory**. Setting them to `postgres` / `redis`
  in Phase 1 has no effect on storage behavior (and the health
  response will tell you so).
- `AGENT_CONFIG_PROJECT_ROOT` — the container's runtime mount.
- `AGENT_CONFIG_GUI_NO_OPEN` — auto-set to `1` in the shipped image
  so the wizard does not try to `xdg-open` a browser from inside a
  container.

**Documented now, wired later:**

- `AUTH_MODE` and its OIDC dependents — Phase 2.
- `POLICY_PATH` — Phase 3.
- `DATABASE_URL` / `REDIS_URL` — Phase 2 / Phase 3 respectively.

## Security posture

- **Secrets stay in env or a mounted secret manager.** Never bake
  `OIDC_CLIENT_SECRET`, `DATABASE_URL` with a password, or
  `POSTGRES_PASSWORD` into the image. Compose uses host-env or
  `.env` files; production uses your secrets manager of choice.
- **`BIND_HOST=0.0.0.0` without `ALLOWED_HOSTS`** — server refuses
  to start. This is intentional: a non-loopback bind without a
  Host-header allowlist is an open invitation for DNS rebinding.
  See [`ADR-021`](../decisions/ADR-021-deployment-shape.md) § Security.
- **`/api/v1/health`** is the only endpoint exempt from CSRF, but it
  is rate-limited to 1 request per second per remote IP and exposes
  no secrets.

## Cross-references

- Image + compose: [`packages/core/deploy/`](../../packages/core/deploy/)
- ADR: [`ADR-021-deployment-shape.md`](../decisions/ADR-021-deployment-shape.md)
- Operator quickstart: [`quickstart.md`](quickstart.md)
- Policy cookbook (Phase 3 preview): [`policy-cookbook.md`](policy-cookbook.md)
- Connector setup (Phase 5 preview): [`connector-setup.md`](connector-setup.md)
