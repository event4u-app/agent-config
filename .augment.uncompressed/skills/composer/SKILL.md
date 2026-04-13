---
name: composer
description: "Use when managing Composer packages, autoloading, scripts, or resolving dependency conflicts in PHP applications or library packages."
---

# composer

## When to use

Use this skill when:
- Installing, updating, or removing Composer packages
- Troubleshooting dependency conflicts
- Configuring autoloading (PSR-4, classmap, files)
- Working with Composer scripts
- Publishing or developing Composer packages
- Debugging version constraints or lock file issues

## Core rules

- **Always use Composer commands** — never manually edit `composer.json` for dependencies.
- Run commands **inside the Docker container** (see `rules/docker-commands.md`).
- Check `Makefile` / `Taskfile.yml` for convenience targets (e.g. `make composer-install`).

## Common operations

### Adding dependencies

```bash
composer require vendor/package              # Production dependency
composer require --dev vendor/package        # Dev dependency (tests, quality tools)
```

### Removing dependencies

```bash
composer remove vendor/package
```

### Updating

```bash
composer update vendor/package               # Update specific package
composer update --lock                       # Only update lock file (no code changes)
composer update                              # Update all (use carefully)
```

### Autoloading

```bash
composer dump-autoload                       # Regenerate autoloader
composer dump-autoload --optimize            # Optimized for production
```

## Version constraints

| Constraint | Meaning | Example |
|---|---|---|
| `^1.2` | `>=1.2.0 <2.0.0` | Safe for semver |
| `~1.2` | `>=1.2.0 <1.3.0` | Tighter range |
| `1.2.*` | `>=1.2.0 <1.3.0` | Wildcard |
| `>=1.2` | Any version `>=1.2.0` | Open-ended (risky) |

**Prefer `^` (caret)** for most dependencies — it allows minor/patch updates within semver.

## PSR-4 autoloading

Standard structure in `composer.json`:

```json
{
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "App\\Modules\\": "app/Modules/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    }
}
```

**Rule:** Namespace must match directory structure exactly. After changing autoload config,
run `composer dump-autoload`.

## Composer scripts

Projects often define scripts in `composer.json`:

```json
{
    "scripts": {
        "test": "vendor/bin/phpunit",
        "quality:phpstan": "vendor/bin/phpstan analyse",
        "quality:refactor": "vendor/bin/rector process"
    }
}
```

Check which scripts exist before running raw commands — they may include extra flags or setup.

## Package development

When working on a Composer package:

- The package has its own `composer.json` with `require`, `autoload`, etc.
- Use `composer.json` → `minimum-stability` and `prefer-stable` for dev versions.
- For local development, the consuming project may use `path` repositories:
  ```json
  "repositories": [
      { "type": "path", "url": "../packages/my-package" }
  ]
  ```
- Always run `composer validate` before publishing.

## Troubleshooting

| Problem | Solution |
|---|---|
| Dependency conflict | `composer why vendor/package` to see who requires it |
| Version not found | `composer show vendor/package --all` to see available versions |
| Autoload not working | `composer dump-autoload` after namespace/directory changes |
| Lock file out of sync | `composer update --lock` to sync without changing code |
| Memory issues | `COMPOSER_MEMORY_LIMIT=-1 composer ...` |

## Rules

- **Never manually edit `composer.json`** for adding/removing dependencies.
- **Always commit `composer.lock`** — it ensures reproducible installs.
- **Run `composer validate`** when modifying `composer.json` structure.
- **Check `composer.json` scripts** before running raw vendor/bin commands.
- Dev dependencies (`--dev`) are for: tests, static analysis, code style, debugging tools.

## Gotcha

- Never manually edit `composer.json` for adding/removing packages — use `composer require/remove`.
- `composer update` without a package name updates EVERYTHING — always specify the package.
- The model forgets to run commands inside the Docker container — all composer commands run in the PHP container.

## Do NOT

- Do NOT use dev-* versions in production branches.
- Do NOT add dependencies without checking version constraints.

## Auto-trigger keywords

- Composer
- dependency management
- autoloading
- composer scripts
