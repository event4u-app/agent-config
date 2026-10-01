---
model_tier: medium
name: tests-execute
pack: engineering-base
visibility: internal
cluster: tests
sub: execute
skills: [quality-tools]
description: Run the project's test suite — stack-adaptive (pest / phpunit / vitest / jest / pytest / …)
argument-hint: "[file | filter] [--include-e2e] [--include-slow] [--php]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tests execute
## Instructions

### 1. Resolve the toolchain

Resolve the stack-adaptive runner via the
[`toolchain-resolver`](../../contexts/execution/toolchain-resolver.md) — do
**not** hard-code a single stack. `resolve_toolchain(project_root)`
returns the runner(s) to invoke per ecosystem:

- **PHP** → pest (`vendor/bin/pest`), Laravel (`php artisan test`), or
  phpunit (`vendor/bin/phpunit`).
- **JS/TS** → vitest (`npx vitest run`) or jest (`npx jest`).
- **Python** → pytest. **Go** → `go test ./...`. **Rust** → `cargo test`.
- **Ruby** → rspec (`bundle exec rspec`). **JVM** → junit (`./gradlew test`,
  `./mvnw test`). **.NET** → `dotnet test`.

**The resolver is the only stack authority, and `skills:` deliberately names
no single-stack skill.** The frontmatter used to bind `pest-testing` unconditionally, which
contradicted the sentence directly above it: a React-only repository was handed
PHP testing guidance before it read the instruction not to hard-code a stack.
A static list cannot express a per-repository answer, so the frontmatter keeps
only the stack-neutral `quality-tools` and the load is
**resolver-conditional**: once step 1 has named the runner, load the skill for
THAT runner if one exists — `pest-testing` for pest, `laravel` for
`php artisan test`, `playwright-testing` for playwright (selected under
`--include-e2e`). Unconditional became conditional; it did not become nothing.

**Wrappers win.** When a `Makefile`/`Taskfile.yml` `test:` target or a
`package.json` `test` script exists, the resolver returns the wrapper
(`make test`, `pnpm test`, or the project's `Taskfile.yml` test target) —
it handles container access, env, and parallelism. **Flags:** `--include-e2e` adds playwright/cypress,
`--include-slow` adds `test:slow`/`test:integration`, `--php` narrows a
polyglot repo to the PHP ecosystem. Fast unit suites run by default
(the monorepo guard).

Low confidence (no manifest, conflicting signals) → fall back per the
[`non-interactive-contract`](../../contexts/execution/non-interactive-contract.md):
ask interactively, or emit `ambiguous_routing` in CI.

### 2. Run the tests

- **Wrapper command** (`make test`, `pnpm test`, or a `Taskfile.yml`
  target) → run from the host; the wrapper handles Docker/env internally.
- **Direct PHP tool** (`vendor/bin/pest`, `php artisan test`,
  `vendor/bin/phpunit`) → run **inside the PHP Docker container**
  (`docker compose exec -T <service> ...`); detect the service from
  `docker-compose.yml` / `compose.yaml` (see `rules/docker-commands.md`).
- **Every other direct tool** — JS, Python, Go, Rust, Ruby
  (`bundle exec rspec`, or bare `rspec` with no Gemfile), JVM
  (`./gradlew test` / `./mvnw test`), .NET (`dotnet test`) → run on the host,
  or in the relevant container when the project containerises it. PHP is the
  only ecosystem with a standing container rule.
- **A behavior-axis command runs from its `scope_root`**, not the repository
  root — see `contexts/execution/toolchain-resolver.md` § 2b.
- If the user named a specific file or filter, pass it through the
  resolved runner's native flag: `--filter=…` or a path for pest/phpunit, a
  path or `-t` for vitest/jest, a node-id for pytest, `-e`/a path for rspec,
  `--tests`/`-Dtest=` for gradle/maven, `--filter` for `dotnet test`.
- No specific test requested → run the resolved fast suite.

### 3. Analyze results

- If all tests pass → report success with a short summary.
- If tests fail:
  - Show the failing test name, expected vs actual values, and the relevant code.
  - Analyze the failure — is it a bug in the code or a bug in the test?
  - **Ask the user** with numbered options:
    ```
    > 1. Fix the code — the test is correct
    > 2. Fix the test — the code is correct
    > 3. Skip — I'll handle this myself
    ```
  - If the user says fix it, apply the fix and re-run.

### 4. Re-run until green

- After any fix, re-run the failing tests to verify.
- Repeat until all tests pass.

### Rules

- **Do NOT commit or push.**
- **Always ask before changing test assertions** — the test might be correct and the code wrong.
- If tests are slow (>2 min), suggest running only the affected test file instead of the full suite.
