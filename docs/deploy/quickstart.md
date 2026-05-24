# Quickstart — internal AI OS

> **Status**: skeleton. Phase 6 of
> [`road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md).
> The artefacts referenced (Compose, env contract, healthcheck) land in
> Phase 1; **Phases 2–5 (auth, policy, team context, connectors) are
> not yet implemented**. Sections flagged `🚧` describe surfaces that
> only become real after those phases ship.

## Audience

A platform / DevOps engineer at a 5–50-person company who wants to
host `@event4u/agent-config` once for the team behind their existing
reverse proxy.

## Prerequisites

- Docker Engine ≥ 24 with Compose v2.
- Reverse proxy (nginx / Caddy / Traefik / ALB) terminating TLS at
  a hostname you control.
- One free TCP port to forward to the container (default 8787).
- 🚧 **Phase 2+** — your company's SSO / OIDC discovery URL + client
  credentials.

## Five-minute path

```bash
# 1. Clone the deployment artefacts.
git clone https://github.com/event4u-app/agent-config.git
cd agent-config/packages/core/deploy

# 2. Copy and edit the environment file.
cp .env.example .env
${EDITOR:-vi} .env
# Required: ALLOWED_HOSTS=your.host:443
# Required: POSTGRES_PASSWORD=<long random>

# 3. Boot.
docker compose up -d

# 4. Verify.
curl -fsS http://127.0.0.1:8787/api/v1/health | jq
# {
#   "status": "ok",
#   "version": "x.y.z",
#   "uptime_seconds": 12,
#   "storage_mode": "filesystem",
#   "session_backend": "memory",
#   ...
# }
```

## Environment contract

The full table of variables, their defaults, and validation rules
lives in [`env-vars.md`](env-vars.md). The minimum a production
deployment must override:

- `ALLOWED_HOSTS` — comma-separated host\:port allowlist for the
  `Host` header. Non-loopback bind without this **refuses to boot**.
- `POSTGRES_PASSWORD` — `agent-config` user's password.
- `SESSION_SECRET` — 32-byte random; rotates user sessions when
  changed.
- 🚧 **Phase 2+** — `AUTH_MODE=oidc` + `OIDC_*` block.

## Reverse-proxy template (Caddy)

```caddyfile
your.host {
    reverse_proxy 127.0.0.1:8787
}
```

The container ships plain HTTP; TLS is the proxy's job. See ADR-021
for the rationale.

## Healthcheck

Every 10 s the Compose `agent-config` service hits
`/api/v1/health` (1-rps rate limit means this lands inside the
budget). A non-200 response for two consecutive cycles flips the
service to `unhealthy` and the orchestrator restarts it.

## What's not yet here

| Capability | Phase | Status |
|---|---|---|
| SSO / OIDC login | 2 | 🚧 deferred (security-sensitive) |
| Central org policy | 3 | 🚧 deferred |
| Team context (shared rules / skills) | 4 | 🚧 deferred |
| Linear / GitHub / Slack connectors | 5 | 🚧 deferred |

Until those land, the deployed instance is a **single-tenant** AI OS
shared via the reverse proxy. Lock the proxy down with HTTP basic
auth or an IP allowlist for v1.

## Troubleshooting

- **Container exits with `BIND_HOST=0.0.0.0 requires ALLOWED_HOSTS`** —
  add `ALLOWED_HOSTS` to `.env` and `docker compose up -d` again.
- **`/api/v1/health` returns 503 with `storage_unavailable`** —
  Postgres has not finished its first-boot init. Wait 15 s and retry.
- **Wizard 404s on every route** — reverse proxy is stripping the
  `Host` header; either preserve it (`proxy_set_header Host $host`)
  or add the proxy hostname to `ALLOWED_HOSTS`.

## Cross-references

- ADR-021 — [deployment shape](../decisions/ADR-021-deployment-shape.md).
- Env contract — [env-vars.md](env-vars.md).
- 🚧 Policy guide — [policy-cookbook.md](policy-cookbook.md) (Phase 3).
- 🚧 Connector setup — [connector-setup.md](connector-setup.md) (Phase 5).
