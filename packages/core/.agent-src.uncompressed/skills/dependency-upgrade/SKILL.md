---
name: dependency-upgrade
description: "Use when upgrading dependencies — 'update framework X', 'bump runtime version', or 'upgrade packages'. Covers changelog review, breaking-change detection, and verification. Stack-agnostic."
source: package
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# dependency-upgrade

## When to use

Use this skill when upgrading project dependencies on any stack — Composer (PHP), npm / pnpm / yarn (JS/TS), pip / poetry / uv (Python), go.mod (Go), Cargo (Rust), or any other language-level package manager.

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
- **Check runtime version requirements** — does the new version need a newer PHP / Node / Python / Go / Rust toolchain?

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

#### pip / poetry / uv (Python)

```bash
# Check outdated packages
pip list --outdated         # pip
poetry show --outdated       # poetry
uv pip list --outdated       # uv

# Upgrade a specific package
pip install --upgrade package-name
poetry update package-name
uv pip install --upgrade package-name

# Check for vulnerabilities
pip-audit                    # via pip-audit
safety check                 # via safety
```

#### go.mod (Go)

```bash
# List available updates
go list -u -m all

# Upgrade a specific module
go get example.com/pkg@latest
go get example.com/pkg@v1.2.3

# Tidy after upgrade
go mod tidy

# Check for known vulnerabilities
govulncheck ./...
```

#### Cargo (Rust)

```bash
# Check outdated
cargo outdated               # requires cargo-outdated

# Upgrade
cargo update -p crate-name
cargo add crate-name@1.2     # edition-aware add

# Audit
cargo audit                  # requires cargo-audit
```

### 4. Verify

After upgrading, run the project's full verification pipeline. The exact commands depend on the stack — resolve via the project's `Taskfile.yml`, `package.json scripts`, `composer.json scripts`, `Makefile`, or the `quality-tools` skill.

| Stack | Type-check | Lint / autofix | Tests |
|---|---|---|---|
| PHP / Laravel | `vendor/bin/phpstan analyse` | `vendor/bin/rector process` + `vendor/bin/ecs check --fix` | `php artisan test` (or `vendor/bin/pest`) |
| TypeScript | `tsc --noEmit` | `eslint --fix` + `prettier --write` | `pnpm test` (or `vitest run`, `jest`) |
| Python | `mypy` / `pyright` | `ruff check --fix` + `ruff format` | `pytest` |
| Go | `go vet ./...` | `golangci-lint run --fix` | `go test ./...` |
| Rust | `cargo check` | `cargo clippy --fix` + `cargo fmt` | `cargo test` |

Re-run the type-checker after any auto-fixer that can rewrite types (Rector for PHP, `eslint --fix` for TS).

### 5. Document

- Note the upgrade in the commit message: `chore: upgrade vendor/package from 2.x to 3.x`
- If breaking changes required code modifications, describe them in the PR body.

## Multi-package upgrades

When upgrading multiple packages:

- **Upgrade one at a time** — easier to identify which upgrade broke something.
- **Exception:** Tightly coupled packages can be upgraded together (e.g., `laravel/framework` + `laravel/*`; `@nestjs/core` + `@nestjs/*`; `react` + `react-dom`; `next` + `@next/*`).
- **Run tests after each upgrade** — don't batch upgrades and test once at the end.

## Common pitfalls

| Pitfall | Prevention |
|---|---|
| Upgrading without reading changelog | Always read the changelog first |
| Upgrading all packages at once | One package at a time (or tightly coupled groups) |
| Trusting `composer update` blindly | Use `--dry-run` first, review changes |
| Ignoring deprecation warnings | Fix deprecations before they become errors |
| Skipping tests after upgrade | Full test suite + project type-checker (PHPStan / tsc / mypy / `go vet` / `cargo check`) after every upgrade |
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

## Output format

1. Updated dependency with version constraint change
2. Breaking changes addressed with code modifications
3. Test results confirming compatibility

## Auto-trigger keywords

- dependency upgrade
- package update
- breaking changes
- changelog review

## Gotcha

- Don't upgrade multiple major versions at once — one major version per upgrade cycle.
- The model tends to skip reading the CHANGELOG — breaking changes hide in minor releases too.
- Always run the full test suite after upgrading, not just the affected tests.
- Lock file conflicts after upgrade are expected — resolve by re-running `composer update`.

## Do NOT

- Do NOT manually edit `composer.lock` or `package-lock.json`.
- Do NOT upgrade to `dev-*` versions in production branches.
- Do NOT ignore failing tests after an upgrade — fix or revert.
