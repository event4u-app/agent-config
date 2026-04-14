---
type: "auto"
alwaysApply: false
description: "Running PHP commands inside Docker containers — artisan, composer, phpstan, rector, ecs, phpunit, tests, migrations, and any CLI tool execution"
---

# Docker Container Commands

All PHP commands run **inside Docker container**, not host.

## Container Detection

Read `docker-compose.yml` / `compose.yaml` for PHP service name (varies per project).
- Non-interactive: `docker compose exec -T <service> ...`
- Interactive: `make console` (if available)

## Tooling Detection

Check `artisan` in project root:
- **Laravel**: `php artisan test`, `vendor/bin/phpstan analyse`, `vendor/bin/rector process`
- **Composer**: `vendor/bin/phpunit`, `vendor/bin/phpstan analyse`, `vendor/bin/rector process`

## Examples (Laravel)

```bash
docker compose exec -T <php-service> vendor/bin/phpstan analyse
docker compose exec -T <php-service> vendor/bin/rector process
docker compose exec -T <php-service> vendor/bin/ecs check --fix
docker compose exec -T <php-service> php artisan test
```

## Examples (Composer)

```bash
docker compose exec -T php vendor/bin/phpstan analyse
docker compose exec -T php vendor/bin/rector process
docker compose exec -T php vendor/bin/ecs check --fix
docker compose exec -T php bash -c "vendor/bin/phpunit"
```

## Build / Task Runner

Check `Makefile` / `Taskfile.yml` first for shortcuts:
- `Makefile` → `make console`, `make test`, `make phpstan`
- `Taskfile.yml` → `task console`, `task test`, `task phpstan`

Frontend commands run on host or node container.
