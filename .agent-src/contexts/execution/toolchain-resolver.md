# Toolchain Resolver Contract

Loaded by every engineering command that runs tests or quality tools
(`/tests execute`, `/tests create`, `/quality-fix`, `/review-changes`,
`/work`). Holds the single source of truth for **stack-adaptive
toolchain resolution**: detect the consumer's test runner / quality
tools and run the right one — instead of a per-stack command explosion.

> **Why this exists (6.1.0 Step 6, AI-council-converged 2026-06-05,
> claude-sonnet-4-5 + gpt-4o):** the contract PR (Step 1) shipped the
> non-interactive layer; this is the next unblocked step — one set of
> commands that adapt to phpunit / pest / vitest / jest / playwright /
> pytest / go / cargo, not N per-stack variants. "Only genuine PHP-space
> commands stay PHP-locked."

**Size budget:** ≤ 6,000 chars.

## 1. The resolver

`work_engine/stack/runner.py` is the engine. A command resolves the
toolchain once and runs the returned commands:

```python
from work_engine.stack.runner import resolve_toolchain, write_config
result = resolve_toolchain(project_root, include_slow=False, include_e2e=False, php_only=False)
write_config(project_root, result)   # caches agents/runtime/state/toolchain.json
for r in result.selected:
    run(r.command)                   # e.g. "vendor/bin/pest", "npx vitest run"
```

Resolution is filesystem-cheap (a handful of small manifest reads) and
**never raises** — a malformed manifest or unknown stack degrades to a
`LOW`-confidence empty result so the command can ask, never crash. This
mirrors the recoverable-error contract of the frontend `detect_stack`.

## 2. Detection order — per ecosystem, first match wins

| Ecosystem | Signal (basis) | Runner | Command |
|---|---|---|---|
| PHP | `pestphp/pest` / `vendor/bin/pest` | pest | `vendor/bin/pest` |
| PHP | `artisan` present (Laravel) | phpunit | `php artisan test` |
| PHP | `phpunit/phpunit` / `vendor/bin/phpunit` | phpunit | `vendor/bin/phpunit` |
| JS/TS | `vitest` in deps | vitest | `npx vitest run` |
| JS/TS | `jest` in deps | jest | `npx jest` |
| JS/TS | `@playwright/test` / `cypress` | playwright / cypress | `npx playwright test` (e2e) |
| Python | `pytest` in pyproject / `pytest.ini` | pytest | `pytest` |
| Go | `go.mod` present | go-test | `go test ./...` |
| Rust | `Cargo.toml` present | cargo-test | `cargo test` |

**Task-runner wrappers win.** When the project root has a `Makefile`
`test:` target, a `Taskfile.yml` `test:` task, or a `package.json`
`test` script, the resolver prefers the wrapper (`make test`,
`task test`, `pnpm test`) — wrappers handle container access, env, and
parallelism (the architecture rule's "Build / Task Runner Detection").
The package manager is read from the lockfile (`pnpm-lock.yaml` → pnpm,
`yarn.lock` → yarn, else npm).

## 3. Confidence tiers — declarative, shared with the non-interactive contract

Each runner carries a `confidence` (`HIGH` / `MEDIUM` / `LOW`) and a
`basis` (the concrete signal that matched), exactly like the
[`non-interactive-contract`](non-interactive-contract.md) detection
tables:

- **HIGH** — a dependency or binary deterministically names the runner.
- **MEDIUM** — a manifest exists but no explicit runner (safe default:
  phpunit for PHP, pytest for Python).
- **LOW** — no manifest at all → empty result; the command falls back to
  asking (interactive) or `ambiguous_routing` (CI, per the
  non-interactive contract).

## 4. Monorepo guard — fast by default, opt-in for the rest

`resolve_toolchain` returns the full `runners` inventory **and** a
`selected` tuple already filtered by the guard:

- **Fast unit suites run by default.** One fast runner per detected
  ecosystem.
- **`--include-e2e`** adds the e2e bucket (playwright / cypress).
- **`--include-slow`** adds a `test:slow` / `test:integration` script.
- **`--php`** (`php_only`) keeps only the PHP ecosystem in `selected`
  — the narrowing the roadmap calls for. The inventory is unchanged; the
  flag affects selection only.

A polyglot repo (e.g. PHP + JS) selects one fast runner per ecosystem;
e2e and slow stay out until their flag is passed.

## 5. Auto-generated project config

`write_config(root, result)` persists the resolved per-stack commands to
`agents/runtime/state/toolchain.json` (best-effort; never raises). The
config is keyed on the manifest `mtime`, so it is re-read cheaply and
re-resolved only when a manifest changes — the same cache-invalidation
hook the frontend detector uses.

## 6. What stays stack-locked

Genuinely PHP-space commands (Artisan generators, Eloquent helpers,
Composer release flows) stay PHP-locked — the resolver only governs the
**generic** verbs (`test`, `quality`, `review`, `work`). A command that
is intrinsically single-stack does not route through the resolver.

## See also

- [`non-interactive-contract`](non-interactive-contract.md) — surface
  detection + confidence tiers the resolver's tiers mirror.
- [`quality-tools`](../../skills/quality-tools/SKILL.md) — the per-tool
  quality commands the resolver's `quality` list points at.
- [`architecture`](../../rules/architecture.md) — "Build / Task Runner
  Detection", the wrapper-first rule this resolver implements.
- [`framework-neutrality-in-generic-skills`](../../rules/framework-neutrality-in-generic-skills.md)
  — why the generic verbs must not mandate one stack.
