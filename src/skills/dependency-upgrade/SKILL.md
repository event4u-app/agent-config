---
model_tier: medium
name: dependency-upgrade
description: "Use when upgrading dependencies — 'update framework X', 'bump runtime version', or 'upgrade packages'. Covers changelog review, breaking-change detection, and verification. Stack-agnostic."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
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

### 1b. Find where the version is DECLARED, before naming a file to edit

```
NEVER NAME AN EDIT SITE BEFORE ASKING WHERE THE VERSION IS DECLARED.
IN A CATALOG WORKSPACE THE MEMBER MANIFEST IS THE WRONG FILE:
THE VERSION IS ONE ROOT LINE WITH N REFERENTS.
```

A member `package.json` is the declaration site in an ordinary repository and
**not** in a workspace using a catalog. There, the member reads `catalog:` and
the range lives once in the workspace definition — editing the member either
does nothing or silently diverges from the catalog.

Ask in this order, and stop at the first that answers:

1. **A catalog entry for this dependency** — `pnpm-workspace.yaml` `catalogs:` /
   `catalog:`, or the equivalent in another manager's workspace definition. If
   the member's range starts with `catalog:`, this is the edit site. Name the
   catalog (`default` included) in the guidance, not the member.
2. **A root-level pin** — `overrides` / `resolutions` / `pnpm.overrides`. A
   member edit under one of these is overridden at install time.
3. **The member manifest** — the ordinary case, and only after 1 and 2 are
   silent.

A repository with no catalog and no root pin behaves exactly as before; this
step adds a lookup, not a change of default.

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

# Upgrade a specific package (same shape for composer require / npm install pkg@latest)
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

## Post-update malware & behavior audit

CVE scanning (above) catches *known-vulnerable* versions. It does **not** catch a **compromised update**: a trusted package with a legitimate history ships a normal-looking version bump that quietly adds data-exfiltration or other harmful behavior. This is how the biggest supply-chain attacks landed — event-stream (wallet stealer as a new transitive dep), ua-parser-js (`preinstall` miner + credential stealer), @solana/web3.js (key exfil hidden inside expected network calls), chalk/debug + 16 (browser crypto-drainer, 2B weekly downloads), the self-propagating Shai-Hulud worm (added a `.github/workflows` + secret-scanning `postinstall`), xz-utils (backdoor in the released tarball, not the git repo). Routine updates slip through because the version looks normal and install runs scripts across the whole transitive tree silently — this is the exact [`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md) egress shape.

**Run this audit during/after any add or upgrade, then surface findings to the user and hold pending confirmation** (per [`active-remediation`](../../rules/active-remediation.md) — a live supply-chain risk is surfaced, never silently accepted):

1. **Install without running scripts first** — `npm install --ignore-scripts` (npm v12 defaults to this), `composer install --no-scripts`, `pip install --only-binary :all:` (wheels only — no sdist build code) — so install-time code (the #1 RCE vector) cannot run before inspection.
2. **Diff the version delta old→new** — the `scripts` block (any newly-added `pre/post/install` hook), the dependency tree (any **new transitive dependency**), and — where feasible — the published tarball vs the git source (xz hid in the tarball).
3. **Capability / behavior diff** — did the new version add a capability its job doesn't need: network egress (`fetch`/`net`/`dns`/`http`), `child_process`/shell, env/secret/credential reads, filesystem writes, obfuscated/minified blobs, a `.github/workflows` file? Use `socket` / `guarddog <eco> scan <pkg>@<ver>` if available; else read the delta.
4. **Purpose-vs-behavior legitimacy check** — a Slack/HTTP client legitimately makes network calls; a date/string/color util does not. For each new capability ask: *does the package's stated purpose require this?* A network/secret capability with no purpose justification — or a **new outbound endpoint** even in a package that already uses the network — is high-risk.
5. **Provenance + advisory feeds** — `npm audit signatures` (flag a dep that *had* provenance and lost it — a hallmark of a token-theft publish); `osv-scanner --lockfile=…` and the GitHub Advisory / Socket / Snyk malware feeds against the newly-resolved versions.
6. **Release age and agent-config paths** — a fixing version younger than three days (a default, not a measured threshold) is `fix-fresh`: run steps 1–5 before installing it, not after. Any change to an agent, editor, git-hook or CI configuration path in the diff of a dependency update stops the update — for example `.claude/`, `.augment/`, `.cursor/`, `.gemini/`, `.windsurf/`, `.codex/`, `.vscode/`, `.husky/`, `.github/workflows/`, `.mcp.json`, an `AGENTS.md` / `CLAUDE.md` / `.cursorrules`-style instruction file — or to an install script. The list illustrates the class; an unlisted path of that class stops the update too. Own analysis: a session-start hook is a persistence point that runs with the developer's credentials, which is why the class is a stop and not a warning.

**Surface to the user** any: new install script · new transitive dep · new network endpoint / secret read · obfuscated blob · lost provenance · advisory/malware hit — with the version delta and the purpose-vs-behavior verdict, and hold the update until they decide. Never auto-accept a bump that introduced an unexplained capability.

## Security fix — one finding carried to a verified PR

Entered from `/audit deps fix <id>` or a finding the user names. The goal is a
fix the owner can merge, not a plan: smallest change, right place, proven by the
source that reported it.

1. **Plan and route** — `agent-config audit:deps fix <id>` prints the route
   (routing table below), the branch and PR title, the smallest fixing change,
   and for a runtime every pinning file with its edit plus an ops checklist. It
   claims the finding: a second session sees the open fix and joins it instead
   of starting another.

   | Situation | Route |
   |---|---|
   | the current branch introduced the dependency, or the user says "here" | this branch, its own `fix(security): …` commit |
   | an open bot PR already moves this dependency | complete that PR |
   | trunk, clean tree | a new `security/…` branch in this checkout |
   | a feature branch is in progress | a separate worktree from fresh trunk, its own branch and PR — the fix travels alone; if the feature changes the same lockfile, offer it a rebase after the merge |

   Choosing "separate worktree" in the offer **is** the explicit ask
   `using-git-worktrees` requires; register it (`agent-config worktree:cleanup
   register <path> --purpose=security-fix`) so its removal after the merge is
   not forgotten.
2. **Build the smallest fix** — inside the current constraint first
   (`npm update <pkg> --ignore-scripts`, an `overrides` entry for a
   transitive fix, `composer update vendor/pkg --no-scripts --no-plugins`); a constraint change only
   when the fixing version is outside it; a new major only with a stated
   compatibility analysis; never `npm audit fix --force`. A runtime fix changes
   every file that pins it in one commit. Run the post-update audit above,
   including step 6.
3. **Prove it** — `agent-config audit:deps verify <id>`: the source that reported
   the finding must stop reporting it on this branch. `fix-failed` means the hole
   is still open — say so; `unverifiable` means the source did not answer — say
   that too. Then the project's tests and static checks. A fix that leaves the
   advisory open or breaks a test is reported as exactly that, never as done.
4. **Open the PR** — `agent-config audit:deps pr-body <id> --tests=passed`
   prints the body; its After field is what `verify` recorded; a library adds
   `--release=<current version>` for the patch-release draft. Security fixes are
   never mixed with unrelated work. Stop before tag and publish. The entry
   command authorizes the local fix only: before the first push or PR, show the
   branch, the PR title and the body and wait for this-turn confirmation
   (`non-destructive-by-default`). On a public remote the body names the
   advisory id and the fixed version, never an exploit path, until the fix is
   merged.
5. **Hand over** — watch CI with `agent-config ci:settle <pr>`, fix what the fix
   broke, report "ready to merge". Merge is the owner's, or `/pr:merge` under the
   owner's instruction; under `worktrees.cleanup: auto` the merge removes the fix
   worktree. Afterwards `agent-config audit:deps track` follows it from
   `fixed-in-trunk` to `fixed-released` to `fixed-deployed`; "merged but not
   deployed" after 24 h stays in the session notice.
6. **No fix exists** — offer a mitigation (a configuration change, a disabled
   feature, a pinned-back version where that is safe) and record it with
   `agent-config audit:deps mitigate <id> --note="…"`; it stays open and reopens
   the moment a refresh reports a fix.

## Output format

1. Updated dependency with version constraint change
2. Breaking changes addressed with code modifications
3. Test results confirming compatibility
4. Post-update audit result: capability delta old→new, purpose-vs-behavior verdict, provenance/advisory status — and any finding surfaced to the user for confirmation
5. For a security fix: the route taken, the source's own re-check (`fixed-in-branch` / `fix-failed` / `unverifiable`), and the PR or the reason there is none

## Auto-trigger keywords

- dependency upgrade
- package update
- breaking changes
- changelog review
- malicious package
- supply chain
- compromised update

## Gotcha

- **A trusted package is not a safe version.** Every major supply-chain attack (event-stream, ua-parser-js, chalk/debug, xz) shipped through a *legitimate* package's normal-looking bump — maintainer-authored ≠ safe. Run the post-update behavior audit, not just `audit` for CVEs.
- **`audit` (CVE) ≠ malware scan.** `npm/composer audit` only knows *published* vulnerabilities; a fresh compromised version has no CVE yet. The capability/behavior diff + purpose-vs-behavior check is what catches zero-hour malware.
- Don't upgrade multiple major versions at once — one major version per upgrade cycle.
- The model tends to skip reading the CHANGELOG — breaking changes hide in minor releases too.
- Always run the full test suite after upgrading, not just the affected tests.
- Lock file conflicts after upgrade are expected — resolve by re-running the package manager's update (`composer update`, `npm update`, `poetry update`).

## Do NOT

- Do NOT manually edit `composer.lock` or `package-lock.json`.
- Do NOT upgrade to `dev-*` versions in production branches.
- Do NOT ignore failing tests after an upgrade — fix or revert.
