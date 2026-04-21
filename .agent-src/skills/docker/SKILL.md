---
name: docker
description: "Use when working with Docker — Dockerfile edits, docker-compose services, containers, or the dual-container (fast + Xdebug) setup — even when the user just says 'my container won't start'."
source: package
---

# docker

## When to use

Use this skill when working with Docker configuration, container setup, Dockerfile changes, or docker-compose modifications.


Do NOT use when:
- Production deployment (use `aws-infrastructure` skill)
- Codespaces setup (use `devcontainer` skill)

## Procedure: Modify Docker setup

1. **Gather context** — read project Docker docs in `agents/` or `Docs/`, check `Makefile`/`Taskfile.yml` for targets, read `docker-compose.yml`/`compose.yaml` for service layout.
2. **Identify scope** — determine which service(s) are affected (PHP, NGINX, worker, scheduler, database).
3. **Inspect current state** — run `docker compose ps` to see running containers and their health status.
4. **Make the change** — edit the relevant file (Dockerfile, compose file, NGINX config, Makefile target). Follow the conventions in the reference sections below.
5. **Rebuild affected containers** — `docker compose build <service>` (add `--no-cache` if Dockerfile base layers changed).
6. **Verify** — `docker compose up -d`, check `docker compose ps` for healthy status, run a smoke test (e.g., `make test-quick` or `curl localhost`).

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

### Container commands

- **Always execute PHP commands inside the container**, never on the host.
- Use `docker compose exec -T <service> ...` for non-interactive (scripts, CI).
- Use `make console` for interactive shell access.
- Use `make console-xdebug` for Xdebug container access.

### Image building

- Production images use `target: pro` — no dev dependencies.
- Check the project's CI/CD config for target platform and registry.
- Docker Hub login may be needed for pulling base images (rate limits).

### PHP extensions

Extensions are installed via `mlocati/php-extension-installer`:
- Check the Dockerfile for the current list.
- Add new extensions in the `base` stage so they're available in all targets.

### Environment files

- `.env` is NOT baked into the Docker image.
- Production: `.env` is fetched from **AWS Secrets Manager** at deploy time.
- Development: `.env` is mounted via docker-compose volumes.

## Makefile targets

Always check the `Makefile` for available targets before using raw docker commands:

```
make start              # Start all containers
make stop               # Stop all containers
make console            # Enter PHP container (bash)
make console-xdebug     # Enter Xdebug PHP container
make composer-install   # Run composer install in container
make migrate            # Run migrations
make migrate-and-seed   # Run migrations + seed
make test               # Run all tests (parallel)
```


## Container orchestration

### Environment synchronization

When the development environment is out of sync (missing containers, wrong state):

1. **Check status** — `docker compose ps` to see which services are running.
2. **Start missing services** — `make start` or `docker compose up -d`.
3. **Rebuild if needed** — `docker compose build --no-cache <service>` after Dockerfile changes.
4. **Reset state** — `make migrate-and-seed` after fresh container start.

### Common sync issues

| Symptom | Cause | Fix |
|---|---|---|
| "Connection refused" | Container not running | `make start` |
| "Table not found" | Migrations not run | `make migrate-and-seed` |
| "Class not found" | Composer not installed | `make composer-install` |
| Old PHP version | Image not rebuilt | `docker compose build <php-service>` |
| Extension missing | Dockerfile changed | Rebuild with `--no-cache` |

### Multi-project orchestration

When running multiple projects simultaneously:
- Check for **port conflicts** — each project needs unique exposed ports.
- Use **Traefik** (see `traefik` skill) for routing by domain instead of port.
- Shared services (MariaDB, Redis) can be in a dedicated `docker-compose.shared.yml`.

## Security hardening checklist

When creating or reviewing Dockerfiles:

- [ ] **Non-root user** — create user with specific UID/GID, use `USER` directive before `CMD`.
- [ ] **No secrets in layers** — never `ENV` or `COPY` secrets. Use `--mount=type=secret` (BuildKit) or runtime secrets.
- [ ] **Minimal packages** — only install what's needed. Remove package manager cache in the same `RUN` layer.
- [ ] **Read-only root filesystem** — use `--read-only` flag where possible, mount writable dirs explicitly.
- [ ] **No `latest` tag** — pin base image versions (`node:18.19-alpine`, not `node:latest`).
- [ ] **Scan images** — use `docker scout quickview` or Trivy for vulnerability scanning.

```dockerfile
# Security pattern
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
COPY --chown=appuser:appgroup . .
USER 1001
```

## Health check patterns

Always add health checks to long-running services:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

In docker-compose, use `condition: service_healthy` for dependency ordering:

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy
```

## Image size optimization

| Technique | Impact | When |
|---|---|---|
| Multi-stage builds | **High** | Always — separate build from runtime |
| Alpine base images | **High** | When compatibility allows |
| Distroless images | **High** | Production, no shell needed |
| `.dockerignore` | **Medium** | Always — exclude `node_modules`, `.git`, `tests`, docs |
| Combine `RUN` layers | **Medium** | When installing packages + cleaning cache |
| Copy only artifacts | **Medium** | `COPY --from=build` only what's needed |

## Build cache optimization

Use BuildKit cache mounts for package managers:

```dockerfile
# Composer (PHP)
RUN --mount=type=cache,target=/root/.composer/cache \
    composer install --no-dev --optimize-autoloader

# npm (Node.js)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production
```

**Layer ordering for cache efficiency:**
1. System packages (changes rarely)
2. Dependency files (`composer.json`, `package.json`) — changes sometimes
3. `RUN install` — cached if dependency files unchanged
4. Source code (`COPY . .`) — changes often, last layer

## Output format

1. Modified Docker configuration files (Dockerfile, docker-compose.yml)
2. Updated Makefile targets if applicable
3. Rebuild/restart instructions for affected containers

## Auto-trigger keywords

- Docker
- docker-compose
- container
- Dockerfile
- PHP container

## Gotcha

- All PHP commands (artisan, composer, phpunit) must run INSIDE the PHP container — never on the host.
- The fast container and Xdebug container share the same codebase but have different PHP configs — don't confuse them.
- `docker compose down -v` destroys volumes including the database — use `down` without `-v` unless you mean it.
- The model forgets to use `docker compose exec -T` (no TTY) when running in scripts or CI.

## Do NOT

- Do NOT change the base Alpine or PHP version without checking CI compatibility.
- Do NOT add dev-only tools to the `pro` stage.
- Do NOT hardcode secrets in the Dockerfile — use build args or runtime secrets.
- Do NOT change `platform` without verifying AWS runner architecture.

## Related

- **Skill:** `traefik` — local reverse proxy with real domains and HTTPS
- **Skill:** `devcontainer` — DevContainer and Codespaces setup
- **Skill:** `php-debugging` — Xdebug dual-container architecture
- **Rule:** `docker-commands.md` — all PHP commands run inside Docker
