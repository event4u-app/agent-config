---
name: composer-packages
description: "Use when developing or maintaining a Composer library package — versioning, Laravel integration, autoloading, and publishing to private registries."
source: package
---

# composer-packages

## When to use

Use this skill when creating, maintaining, or publishing Composer library packages — including Laravel packages with service providers, Artisan commands, and config publishing.

## Before making changes

1. Read the package's `composer.json` for structure and dependencies.
2. Check if it's a Laravel package (look for `extra.laravel.providers`).
3. Read the package's `README.md` and `CHANGELOG.md`.
4. Check the `agents/` directory in the package for package-specific docs.

## Known packages

Check the project's `composer.json` for organization-specific packages.
Check `agents/overrides/skills/composer-packages.md` for the package registry and known packages list.

## Package structure

```
my-package/
├── src/                    # Source code
│   ├── App/
│   │   └── Providers/      # Laravel service providers
│   └── ...
├── config/                 # Publishable config files
├── tests/                  # Package tests
├── composer.json           # Package manifest
├── README.md               # Documentation
├── CHANGELOG.md            # Version history
└── agents/                 # Package-specific agent docs
```

## composer.json essentials

### Required fields

```json
{
    "name": "vendor/my-package",
    "type": "library",
    "description": "Clear, concise description",
    "require": {
        "php": "^8.2"
    },
    "autoload": {
        "psr-4": {
            "Vendor\\MyPackage\\": "src/"
        }
    }
}
```

### Laravel package auto-discovery

```json
{
    "extra": {
        "laravel": {
            "providers": [
                "Vendor\\MyPackage\\App\\Providers\\PackageServiceProvider"
            ]
        }
    }
}
```

### Composer scripts / plugins

Packages can hook into Composer lifecycle events:

```json
{
    "scripts": {
        "post-install-cmd": [
            "MyNamespace\\ComposerScripts::onInstall"
        ]
    }
}
```

## Version constraints

Use **wide version ranges** for library packages to maximize compatibility:

```json
{
    "require": {
        "php": "^8.1 || ^8.2 || ^8.3 || ^8.4",
        "illuminate/support": "^10.0 || ^11.0 || ^12.0"
    }
}
```

**Libraries** should use `||` ranges. **Applications** should use `^` (caret).

## Local development

### Path repositories

In the consuming project's `composer.json`:

```json
{
    "repositories": [
        { "type": "path", "url": "../packages/my-package" }
    ]
}
```

Then: `composer require vendor/my-package:@dev`

### Development project

If the organization has a dedicated development sandbox for testing packages, use it for local testing.

## Publishing

### Private registry (GitHub Packages / Satis)

Packages are published to a private Composer registry. Check the organization's Satis or GitHub Packages setup.

### Pre-publish checklist

1. `composer validate` — verify `composer.json` is valid.
2. `composer dump-autoload` — verify autoloading works.
3. Run tests: `vendor/bin/phpunit` or `vendor/bin/pest`.
4. Run quality tools: PHPStan, ECS, Rector.
5. Update `CHANGELOG.md` with the new version.
6. Tag the release: `git tag v1.2.3`.

## Conventions

- Follow the organization's namespace convention (check existing packages).
- Use `declare(strict_types=1)` in all PHP files.
- Use typed properties, parameters, and return types.
- Follow the same coding standards as the main projects (see `coder` skill).
- Include `agents/` directory for package-specific documentation.


## Auto-trigger keywords

- Composer package
- library development
- package versioning

## Gotcha

- Don't add `composer.lock` to library packages — it should be in `.gitignore` for libraries (not apps).
- Minimum stability must be explicit — don't assume `stable`.
- The model tends to set overly restrictive version constraints — use `^` (caret) not `=` (exact).

## Do NOT

- Do NOT use `*` version constraints in library packages.
- Do NOT require specific patch versions — use `^` or `||` ranges.
- Do NOT include dev dependencies in `require` — use `require-dev`.
- Do NOT forget to run `composer validate` before publishing.
- Do NOT publish without updating the changelog and tagging.
