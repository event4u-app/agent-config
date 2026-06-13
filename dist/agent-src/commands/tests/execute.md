---
model_tier: medium
name: tests-execute
pack: engineering-base
tier: 2
visibility: internal
cluster: tests
sub: execute
skills: [pest-testing, quality-tools]
description: Run the project's test suite — stack-adaptive (pest / phpunit / vitest / jest / pytest / …)
suggestion:
  eligible: true
  trigger_description: "run the tests, execute the test suite"
  trigger_context: "code changes pending verification"
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
- **Direct JS/Python/Go/Rust tool** → run on the host (or the relevant
  container when the project containerises it).
- If the user named a specific file or filter, pass it through the
  resolved runner's native flag (`--filter=…` / a path for pest/phpunit,
  a path/`-t` for vitest/jest, a node-id for pytest).
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
