---
name: docker
description: "Use when working with Docker — Dockerfile changes, docker-compose services, container management, or the dual-container architecture (fast + Xdebug)."
---

# docker

## When to use

Docker config, containers, Dockerfile, docker-compose. NOT for: production deploy (`aws-infrastructure`), Codespaces (`devcontainer`).

## Before: read Docker docs in `agents/`, check Makefile/Taskfile, read docker-compose.

## Project architecture

### Dockerfile (`.docker/Dockerfile`)

Multi-stage build with these targets:

| Stage | Purpose |
|---|---|
| `base` | Alpine + PHP-FPM + system packages + extensions |
| `dev` | Development: Xdebug, dev tools, Composer dev deps |
| `pro` | Production: optimized, no dev deps, New Relic agent |

Key build args:
- `PHP_VERSION` — extracted from Dockerfile, used by CI
- `COMPOSER_AUTH` — private registry access (passed as secret)
- `CACHEBUST` — weekly cache invalidation (`date +%Y-%U`)
- `COMPOSER_NO_DEV` — `1` for production, `0` for dev

### Dual-container architecture (PHP projects)

Some projects run two PHP-FPM containers simultaneously (fast + Xdebug):

| Container | Purpose | PHP-FPM mode |
|---|---|---|
| `{project}-php` | Fast execution, no debugger | `pm = dynamic` |
| `{project}-php-xdebug` | Xdebug enabled, debugging | `pm = ondemand` |

NGINX routes requests based on HTTP headers:
- No header → fast container
- `X-Xdebug-Enable: 1` or `X-Debug-Session: PHPSTORM` → Xdebug container

### docker-compose services

Read `docker-compose.yml` / `compose.yaml` to discover the actual service names. Common patterns:

| Service type | Description |
|---|---|
| PHP-FPM | Main application server |
| PHP-FPM + Xdebug | Debugging container |
| NGINX | Reverse proxy |
| Queue worker | Background job processing (e.g., Horizon) |
| Scheduler | Cron/task scheduler |
| Database | MariaDB / MySQL / PostgreSQL |
| Cache | Redis / Memcached |

## Conventions

## Conventions

PHP commands always inside container. `exec -T` for non-interactive. `make console` for interactive. Production: `target: pro`. Extensions via `mlocati/php-extension-installer` in `base` stage. `.env` NOT baked — prod from AWS Secrets Manager, dev mounted.

## Makefile: `make start/stop/console/console-xdebug/composer-install/migrate/migrate-and-seed/test`

## Sync issues

| Symptom | Fix |
|---|---|
| Connection refused | `make start` |
| Table not found | `make migrate-and-seed` |
| Class not found | `make composer-install` |
| Old PHP | `docker compose build <service>` |
| Extension missing | Rebuild `--no-cache` |

Multi-project: check port conflicts, use Traefik for domain routing.

## Security: non-root user, no secrets in layers (`--mount=type=secret`), minimal packages, pin image versions (no `latest`), scan with Trivy.

## Health checks: `HEALTHCHECK` in Dockerfile, `condition: service_healthy` in compose.

## Image optimization: multi-stage builds, Alpine, `.dockerignore`, combine `RUN` layers, copy only artifacts.

## Cache: BuildKit cache mounts for Composer/npm. Layer order: system packages → dependency files → install → source code.

## Gotcha: PHP commands INSIDE container only, fast≠xdebug container (different configs), `down -v` destroys volumes, use `-T` in scripts/CI.

## Do NOT: change Alpine/PHP version without CI check, dev tools in `pro` stage, hardcode secrets, change platform without checking AWS.

## Related: `traefik`, `devcontainer`, `php-debugging`, `docker-commands` rule.
