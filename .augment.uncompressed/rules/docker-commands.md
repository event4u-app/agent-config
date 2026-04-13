---
type: "auto"
description: "Running PHP commands inside Docker containers — artisan, composer, phpstan, rector, ecs, phpunit, tests, migrations, and any CLI tool execution"
---

# Docker Container Commands

All PHP commands (PHPStan, Rector, Composer, PHPUnit, Artisan) must be executed **inside the Docker container**, not on the host.

## Container Detection

Detect the correct PHP container service name from `docker-compose.yml` / `compose.yaml`.
Read the compose file to find the PHP service name — it varies per project.

Use `docker compose exec -T <service> ...` for non-interactive commands (scripts, CI).
Use `make console` to enter the container interactively (if available).

## Tooling Detection

Check if `artisan` exists in the project root:

- **Laravel** (`artisan` exists): `php artisan quality:phpstan`, `php artisan quality:rector --fix`, `php artisan test`
- **Composer** (no `artisan`): `composer quality:phpstan`, `composer quality:refactor -- --fix`, `vendor/bin/phpunit`

## Examples (Laravel project)

```bash
docker compose exec -T <php-service> php artisan quality:phpstan
docker compose exec -T <php-service> php artisan quality:rector --fix
docker compose exec -T <php-service> php artisan test
```

## Examples (Composer project)

```bash
docker compose exec -T php bash -c "composer quality:phpstan"
docker compose exec -T php bash -c "composer quality:refactor -- --fix"
docker compose exec -T php bash -c "vendor/bin/phpunit"
```

## Build / Task Runner

Before using raw `docker compose exec` commands, check if a `Makefile` or `Taskfile.yml` exists.
These often provide convenient shortcuts for common operations:

- `Makefile` → `make console`, `make test`, `make phpstan`, etc.
- `Taskfile.yml` → `task console`, `task test`, `task phpstan`, etc.

**Always read the Makefile/Taskfile first** to discover available targets.

Frontend commands (npm, webpack) run on the host or in the node container.
