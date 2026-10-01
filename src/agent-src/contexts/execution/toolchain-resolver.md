# Toolchain Resolver Contract

Loaded by every engineering command that runs tests or quality tools
(`/tests execute`, `/tests create`, `/fix quality`, `/review changes`,
`/work`). Holds the single source of truth for **stack-adaptive
toolchain resolution**: detect the consumer's test runner / quality
tools and run the right one — instead of a per-stack command explosion.

> **Why this exists (6.1.0 Step 6, AI-council-converged 2026-06-05,
> claude-sonnet-4-5 + gpt-4o):** the contract PR (Step 1) shipped the
> non-interactive layer; this is the next unblocked step — one set of
> commands that adapt to phpunit / pest / vitest / jest / playwright /
> pytest / go / cargo, not N per-stack variants. "Only genuine PHP-space
> commands stay PHP-locked."

**Size budget:** ≤ 7,000 chars — raised from 6,000 on 2026-10-01, when the
resolver went from 9 runners on one axis to 12 across two. Shrink-only from
here; the enforced ceiling is `check_depth_budget`'s 16,000.

## 1. The resolver

`work_engine/stack/runner.ts` (TypeScript, run via tsx) is the engine.
A command resolves the toolchain once and runs the returned commands:

```ts
import { resolve_toolchain, write_config } from './work_engine/stack/runner.js';
const result = resolve_toolchain(projectRoot, { include_slow: false, include_e2e: false, php_only: false });
write_config(projectRoot, result); // caches agents/runtime/state/toolchain.json
for (const r of result.selected) {
    run(r.command);                // e.g. "vendor/bin/pest", "npx vitest run"
}
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
| Ruby | `rspec` in Gemfile / `.rspec` | rspec | `bundle exec rspec` |
| JVM | `pom.xml` / `build.gradle[.kts]` | junit | `./mvnw test` · `./gradlew test` |
| .NET | `*.csproj` / `*.sln` / `global.json` | dotnet-test | `dotnet test` |

Ruby has **no MEDIUM default**: minitest ships in the stdlib, so a Gemfile
with no rspec signal emits no row rather than a guess.

**Task-runner wrappers win.** When the project root has a `Makefile`
`test:` target, a `Taskfile.yml` `test:` task, or a `package.json`
`test` script, the resolver prefers that wrapper (`make test`,
`pnpm test`, or the `Taskfile.yml` test target) — wrappers handle
container access, env, and parallelism (the architecture rule's
"Build / Task Runner Detection").
The package manager is read from the lockfile (`pnpm-lock.yaml` → pnpm,
`yarn.lock` → yarn, else npm).

## 2b. Behaviour-runner axis — per scope, detection only

`result.behavior_runners` is a **separate list** from `runners`: it reports
which behaviour runner (behat / cucumber-js / cucumber-ruby / cucumber-jvm /
behave / pytest-bdd / reqnroll / specflow) each scope already owns.

- **Per scope, never repository-wide.** Each row carries `scope_root` (the
  root plus every declared workspace package). A monorepo with a behaviour
  runner in one package returns a row for that package and none for the
  others; a single answer would erase which package owns it.
- **Two in one scope is a refusal, not a pick** — `runner: "unknown"` plus
  `conflict: [both names]`, the same refusal the frontend detector makes
  between two mutually exclusive workspaces.
- **Detection, never adoption.** No row recommends installing anything, and
  the axis is unreachable from `selected`: a behaviour suite the repository
  owns is reported, never scheduled to run. Choosing one is an owner call.

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
