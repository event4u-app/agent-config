---
name: dependency-upgrade
description: "Use when upgrading dependencies — "update Laravel", "bump PHP version", or "upgrade packages". Covers changelog review, breaking change detection, and verification."
source: package
---

# dependency-upgrade

## When to use

Use this skill when upgrading Composer packages, npm packages, or any project dependency.

Do NOT use when:
- Installing new dependencies for the first time
- Routine code changes unrelated to package versions

## Procedure: Upgrade a dependency

### 1. Assess

Before upgrading:

- **Read the changelog** for every version between current and target.
- **Identify breaking changes** — look for "BREAKING", "BC break", major version bumps.
- **Check deprecation notices** — code using deprecated APIs needs updating.
- **Review upgrade guides** — many packages provide migration docs.
- **Check PHP/Node version requirements** — does the new version need a newer runtime?

### 2. Plan

Categorize changes needed:

| Category | Action |
|---|---|
| No breaking changes | Upgrade directly |
| Deprecation warnings | Upgrade, then fix deprecations |
| Breaking changes (small) | Fix code, then upgrade |
| Breaking changes (large) | Create a roadmap, upgrade in steps |
| Peer dependency conflicts | Resolve conflicts before upgrading |

### 3. Execute

#### Composer (PHP)

```bash
# Check outdated packages
composer outdated

# Upgrade a specific package
composer update vendor/package

# Upgrade with version constraint change
composer require vendor/package:^3.0

# Dry-run to see what would change
composer update vendor/package --dry-run
```

#### npm (JavaScript/TypeScript)

```bash
# Check outdated packages
npm outdated

# Upgrade a specific package
npm update package-name

# Upgrade to a new major version
npm install package-name@latest

# Check for vulnerabilities
npm audit
```

### 4. Verify

After upgrading, run the full verification pipeline:

```bash
# PHP/Laravel
vendor/bin/phpstan analyse           # Check for type errors
vendor/bin/rector process            # Auto-fix refactoring
vendor/bin/ecs check --fix           # Auto-fix code style
php artisan test                     # Run all tests

# JavaScript
npm run build     # Check build succeeds
npm test          # Run all tests
npm run lint      # Check code style
```

### 5. Document

- Note the upgrade in the commit message: `chore: upgrade vendor/package from 2.x to 3.x`
- If breaking changes required code modifications, describe them in the PR body.

## Multi-package upgrades

When upgrading multiple packages:

- **Upgrade one at a time** — easier to identify which upgrade broke something.
- **Exception:** Tightly coupled packages (e.g., `laravel/framework` + `laravel/*`) can be upgraded together.
- **Run tests after each upgrade** — don't batch upgrades and test once at the end.

## Common pitfalls

| Pitfall | Prevention |
|---|---|
| Upgrading without reading changelog | Always read the changelog first |
| Upgrading all packages at once | One package at a time (or tightly coupled groups) |
| Trusting `composer update` blindly | Use `--dry-run` first, review changes |
| Ignoring deprecation warnings | Fix deprecations before they become errors |
| Skipping tests after upgrade | Full test suite + PHPStan after every upgrade |
| Lock file conflicts | Coordinate upgrades with the team |

## Version constraint guidelines

| Constraint | Meaning | When to use |
|---|---|---|
| `^2.0` | `>=2.0.0 <3.0.0` | Default — allows minor + patch updates |
| `~2.1` | `>=2.1.0 <2.2.0` | Strict — allows only patch updates |
| `2.1.*` | `>=2.1.0 <2.2.0` | Same as `~2.1` |
| `>=2.0 <2.5` | Explicit range | When you know specific versions work |
| `dev-main` | Latest commit | **Never in production** — only for development |

## Security upgrades

For security patches:

- **Prioritize** — security upgrades should be fast-tracked.
- **Check `composer audit`** / `npm audit` regularly.
- **Patch versions** (e.g., 2.1.3 → 2.1.4) are usually safe to apply immediately.
- **Still run tests** — even security patches can break things.

## Vulnerability scanning when adding packages

Before adding a **new** dependency (not just upgrading), run a security audit:

### Composer (PHP)

```bash
# Check for known vulnerabilities in current dependencies
composer audit

# After adding a new package, re-check
composer require vendor/new-package
composer audit
```

### npm (JavaScript)

```bash
# Check before install
npm audit

# After adding, re-check
npm install new-package
npm audit
```

### What to check for new packages

| Check | How | Why |
|---|---|---|
| **Known CVEs** | `composer audit` / `npm audit` | Direct vulnerabilities |
| **Maintenance status** | GitHub: last commit, open issues | Abandoned packages are a risk |
| **Dependency tree** | `composer show -t vendor/pkg` / `npm ls new-package` | Transitive dependencies may conflict |
| **License compatibility** | `composer licenses` / check `package.json` | Legal compliance |
| **Bundle size** (npm) | `npx bundlephobia new-package` | Impact on frontend bundle |

### Conflict detection

When `composer require` or `npm install` fails with conflicts:

1. **Read the error** — which versions conflict?
2. **Check if other packages need updating** — `composer why vendor/conflicting-pkg`.
3. **Use `--dry-run`** first — `composer require vendor/pkg --dry-run`.
4. **Never use `--ignore-platform-reqs`** in production — only for investigation.

## Auto-trigger keywords

- dependency upgrade
- package update
- breaking changes
- changelog review

## Output format

1. Updated dependency with version constraint change
2. Breaking changes addressed with code modifications
3. Test results confirming compatibility

## Gotcha

- Don't upgrade multiple major versions at once — one major version per upgrade cycle.
- The model tends to skip reading the CHANGELOG — breaking changes hide in minor releases too.
- Always run the full test suite after upgrading, not just the affected tests.
- Lock file conflicts after upgrade are expected — resolve by re-running `composer update`.

## Do NOT

- Do NOT manually edit `composer.lock` or `package-lock.json`.
- Do NOT upgrade to `dev-*` versions in production branches.
- Do NOT ignore failing tests after an upgrade — fix or revert.
