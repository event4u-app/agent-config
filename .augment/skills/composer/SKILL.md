---
name: composer
description: "Use when managing Composer packages, autoloading, scripts, or resolving dependency conflicts in PHP applications or library packages."
source: package
---

# composer

## When to use

Composer packages, autoloading, scripts, dependency conflicts, package development. Commands inside Docker. Check Makefile targets.

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

## PSR-4: namespace = directory. Run `composer dump-autoload` after changes. Check scripts before raw vendor/bin.

## Package dev: own composer.json, `path` repositories for local dev, `composer validate` before publishing.

## Troubleshooting

| Problem | Solution |
|---|---|
| Dependency conflict | `composer why vendor/package` to see who requires it |
| Version not found | `composer show vendor/package --all` to see available versions |
| Autoload not working | `composer dump-autoload` after namespace/directory changes |
| Lock file out of sync | `composer update --lock` to sync without changing code |
| Memory issues | `COMPOSER_MEMORY_LIMIT=-1 composer ...` |

## Gotcha: never manual edit for deps, `composer update` without package = updates ALL, Docker container only.

## Do NOT: dev-* in production, add without checking constraints.
