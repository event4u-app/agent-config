---
name: dependency-upgrade
description: "Use when upgrading dependencies — "update Laravel", "bump PHP version", or "upgrade packages". Covers changelog review, breaking change detection, and verification."
---

# dependency-upgrade

## When to use

Upgrading Composer/npm packages. NOT for: new installs, unrelated changes.

## Workflow

1. **Assess** — changelog, breaking changes, deprecations, upgrade guides, runtime requirements
2. **Plan** — no breaking → direct. Deprecations → fix after. Breaking small → fix first. Breaking large → roadmap.
3. **Execute** — Composer: `composer update vendor/pkg` (use `--dry-run` first). npm: `npm update pkg`.
4. **Verify** — PHPStan + Rector + tests (PHP). Build + test + lint (JS).
5. **Document** — commit: `chore: upgrade vendor/pkg from 2.x to 3.x`. PR body for breaking changes.

## Multi-package: one at a time. Exception: tightly coupled (e.g., laravel/* together). Test after each.

## Constraints: `^2.0` (default, minor+patch), `~2.1` (patch only), `dev-main` (never production).

## Security: fast-track patches, `composer audit`/`npm audit`, still test.

## New packages: audit, check maintenance, dependency tree, license, bundle size. Conflicts: read error → `composer why` → `--dry-run`.

## Gotcha: one major version per cycle, read CHANGELOG (breaking in minor too), full test suite, lock conflicts → re-run update.

## Do NOT: edit lock files manually, `dev-*` in production, ignore failing tests.
