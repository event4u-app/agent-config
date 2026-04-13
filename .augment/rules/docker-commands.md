---
type: "auto"
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
- **Laravel**: `php artisan quality:phpstan`, `php artisan test`
- **Composer**: `composer quality:phpstan`, `vendor/bin/phpunit`

## Examples (Laravel)

```bash
docker compose exec -T <php-service> php artisan quality:phpstan
docker compose exec -T <php-service> php artisan quality:rector --fix
docker compose exec -T <php-service> php artisan test
```

## Examples (Composer)

```bash
docker compose exec -T php bash -c "composer quality:phpstan"
docker compose exec -T php bash -c "composer quality:refactor -- --fix"
docker compose exec -T php bash -c "vendor/bin/phpunit"
```

## Build / Task Runner

Check `Makefile` / `Taskfile.yml` first for shortcuts:
- `Makefile` → `make console`, `make test`, `make phpstan`
- `Taskfile.yml` → `task console`, `task test`, `task phpstan`

Frontend commands run on host or node container.
