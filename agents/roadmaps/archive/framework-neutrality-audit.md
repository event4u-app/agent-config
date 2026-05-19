---
complexity: structural
---

# Roadmap: Framework Neutrality Audit — Remove PHP/Laravel Leakage from Generic Skills, Rules & Commands

> Eliminate hardcoded PHP/Laravel assumptions from every generic artifact in `.agent-src.uncompressed/{skills,rules,commands}/`. Generic artifacts must be framework-neutral; framework-specific implementations belong in dedicated carve-out artifacts (`laravel-*`, `nextjs-*`, etc.). Future leakage is blocked by a new Tier-2 rule + linter.

## Prerequisites

- [ ] Read `AGENTS.md`, [`rules/architecture.md`](../../.agent-src.uncompressed/rules/architecture.md), [`docs/contracts/rule-router.md`](../../docs/contracts/rule-router.md)
- [ ] Read evidence file: `agents/analysis/framework-leakage-scan-2026-05-17.txt` (1008 lines, 584 hits)
- [ ] Confirm scanner is on disk: `scripts/_tmp_scan_framework_leakage.py` (temporary, replaced by permanent linter in Phase 0)
- [ ] Confirm `quality.local_auto_run: false` is still set in `.agent-settings.yml` (governs CI-step policy referenced throughout)

## Context

The `api-endpoint` skill triggered this audit (user feedback: "API endpoints don't have to be Laravel, don't have to be PHP"). A repository-wide scan with `scripts/_tmp_scan_framework_leakage.py` (regex on Laravel / PHP / Symfony / JS / Python tokens, scoped to non-carve-out artifacts) returned **584 hits across 50 skills, 7 rules, 25 commands**.

- **Scan output** — `agents/analysis/framework-leakage-scan-2026-05-17.txt`
- **Trigger** — `api-endpoint/SKILL.md` mandates Laravel FormRequest, Eloquent Resource, `php artisan` route in a skill named generically
- **Existing carve-outs** — `laravel-*`, `symfony-*`, `nextjs-*`, `react-*`, `php-debugging`, `php-service`, `php-coder`, `pest-testing`, `quality-tools`, `eloquent`, `blade-ui`, `flux`, `livewire`, `jobs-events`, `artisan-commands`, `multi-tenancy`, `composer-packages`, `project-analysis-laravel`, `project-analysis-symfony`, `project-analysis-nextjs`, `project-analysis-react`, `project-analysis-node-express`, `project-analysis-zend-laminas`. These are **out of scope** — they are correctly framework-specific.

## Violation classification

Every hit falls into one of three buckets. Phases 1–5 act on Cat-B and Cat-C only; Cat-A is documented and left intact.

| Cat | Definition | Action |
|---|---|---|
| **A** | Multi-stack detection map / parallel example (`composer.json` ↔ `package.json` ↔ `pyproject.toml` side by side) | None — legitimate cross-stack documentation |
| **B** | Generic artifact makes PHP/Laravel the default or only path (FormRequest mandate, PHPStan-only verification, Eloquent-only data layer, `php artisan` as canonical command) | Generalize procedure; demote framework names to "e.g." examples |
| **C** | Artifact is fundamentally Laravel-specific but named generically (`migration-creator`, `fix/seeder`, `update-form-request-messages`, `test-performance` with Laravel `schema:dump`) | Rename + relocate to `laravel-*` namespace OR add `framework:` frontmatter restriction |

## Acceptance criteria (whole roadmap)

- [ ] `python3 scripts/lint_framework_leakage.py` exits 0 against `.agent-src.uncompressed/{skills,rules,commands}/` excluding carve-outs
- [ ] `pytest tests/test_lint_framework_leakage.py` 100% green
- [ ] `task lint-skills` green (warnings ok, no fails)
- [ ] `task sync` + `task generate-tools` regenerate cleanly
- [ ] Router shows new rule `framework-neutrality-in-generic-skills` at Tier 2
- [ ] No generic artifact contains: `FormRequest` (as mandate), `php artisan` (as default), `PHPStan` (as only example), `composer.json` (without `package.json` / `pyproject.toml` peer)
- [ ] `scripts/_tmp_scan_framework_leakage.py` deleted
- [ ] Phase 7 council pass returns no Sev-1/Sev-2 blind spots

## Non-goals (explicitly out of scope)

- Do **NOT** touch any `laravel-*`, `symfony-*`, `nextjs-*`, `react-*`, `pest-*`, `eloquent`, `flux`, `livewire`, `blade-ui`, `jobs-events`, `artisan-commands`, `multi-tenancy`, `composer-packages`, `php-service`, `php-debugging`, `php-coder`, `quality-tools`, `project-analysis-laravel`, `project-analysis-symfony`, `project-analysis-nextjs`, `project-analysis-react`, `project-analysis-node-express`, `project-analysis-zend-laminas` artifact — they are correctly framework-specific.
- Do **NOT** touch `docs/guidelines/php/*` — framework-scoped by directory.
- Do **NOT** change the AI-Council, the memory subsystem, the work-engine, telemetry, or any unrelated subsystem.
- Do **NOT** introduce new dependencies, libraries, or external tools.
- Do **NOT** rebase, push, merge, or open a PR — branch hygiene is the user's call.


## Phase 0: Foundation — Tier-2 rule + permanent linter

> Block future leakage before fixing the backlog. Without this gate, every remediation in Phases 1–5 will drift back over time.

### Step 0.1: Create new Tier-2 rule

- [ ] **Create file** `.agent-src.uncompressed/rules/framework-neutrality-in-generic-skills.md` (NEW, ~80 lines).
- [ ] **Frontmatter** (exact):
  ```yaml
  ---
  name: framework-neutrality-in-generic-skills
  tier: 2
  always_active: false
  triggers:
    - keyword: "FormRequest"
    - keyword: "PHPStan"
    - keyword: "php artisan"
    - keyword: "composer.json"
    - keyword: "Eloquent"
    - keyword: "Pest"
    - keyword: "Blade"
    - keyword: "vendor/bin"
    - keyword: "Artisan"
    - keyword: "Rector"
    - phrase: "every controller"
    - phrase: "all controllers"
    - phrase: "generic skill"
  description: "When editing a generic skill, rule, or command in .agent-src.uncompressed/ — block PHP/Laravel/Symfony as the only path. Generic artifacts must offer language-agnostic procedures with framework-specific carve-out pointers."
  ---
  ```
- [ ] **Body sections** (in order):
  1. `# framework-neutrality-in-generic-skills`
  2. `## The Iron Law` — fenced block: `NO GENERIC ARTIFACT MAY MANDATE A SPECIFIC FRAMEWORK. SPECIFICS BELONG IN CARVE-OUT ARTIFACTS (laravel-*, symfony-*, nextjs-*, pest-*, eloquent, quality-tools).`
  3. `## Scope` — list directories: `.agent-src.uncompressed/skills/`, `.agent-src.uncompressed/rules/`, `.agent-src.uncompressed/commands/`. Exempt: file/dir matches `laravel`, `symfony`, `nextjs`, `react-*`, `^php-`, `^pest-`, `^eloquent`, `^blade`, `^livewire`, `^flux`, `^artisan-`, `^composer-`, `^docker`, `^aws-`, `^grafana`, `^openapi$`, `^quality-tools`, `^sql-writing`, `^tailwind`, `^terraform`, `^terragrunt`, `^traefik`, `^mobile-e2e`, `-routing$`, `project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)`.
  4. `## Forbidden patterns in generic artifacts` — table mirroring `LEAKAGE` dict in `scripts/lint_framework_leakage.py` (see Step 0.2). Each row: pattern · why · fix.
  5. `## Allowed: cross-stack documentation` — multi-stack tables / detection maps with **at least 2 ecosystems side-by-side** (`composer.json` AND `package.json`, etc.).
  6. `## Allowed: carve-out pointers` — `→ Laravel-specific: see [laravel-validation](../skills/laravel-validation/SKILL.md)` is the canonical handoff shape.
  7. `## Enforcement` — `scripts/lint_framework_leakage.py` runs in `task ci-fast`; failures block.
  8. `## See also` — `roadmap-ci-steps-policy`, `skill-quality`, `scope-control`.
- [ ] **Verify**: `python3 scripts/compile_router.py` then `grep -A 4 "framework-neutrality" .agent-src/router.json` shows tier-2 entry.

### Step 0.2: Create permanent linter

- [ ] **Create file** `scripts/lint_framework_leakage.py` (NEW, ~180 lines). Copy `scripts/_tmp_scan_framework_leakage.py` as starting point, then change:
  - **Module docstring**: `"""Lint generic skills/rules/commands for framework/language leakage. Exits 1 on hit; CI-blocking."""`
  - **Add** `from typing import Iterable` + argparse for `--json`, `--quiet`, `--paths PATH...`.
  - **Add allowlist file** `scripts/lint_framework_leakage_allowlist.json` (NEW, see Step 0.3). Load it in `main()`; entries skip the line entirely (file + line_number tuple).
  - **Exit code**: 0 if no hits OR all hits allowlisted, 1 otherwise.
  - **Output format** (default, non-`--json`): one block per file: `path` header, then `LNNN  category  pattern  snippet`. Trailing summary `N hits across M files (K allowlisted)`.
  - **`--json`**: emit `{"version":1, "hits":[...], "summary":{...}}` with `allowlisted` bool per hit.
  - **`--quiet`**: only summary line.
  - **Default paths** when `--paths` omitted: `.agent-src.uncompressed/skills`, `.agent-src.uncompressed/rules`, `.agent-src.uncompressed/commands`.
- [ ] **Carve-out list**: identical to `CARVE_OUT_PATTERNS` in temp scanner — keep verbatim.
- [ ] **Leakage dict**: identical to `LEAKAGE` in temp scanner — keep verbatim.
- [ ] **Header comment** at top:
  ```python
  # Enforces `.agent-src.uncompressed/rules/framework-neutrality-in-generic-skills.md`.
  # Allowlist legitimate cross-stack docs in `scripts/lint_framework_leakage_allowlist.json`.
  ```

### Step 0.3: Create allowlist for legitimate cross-stack docs

- [ ] **Create file** `scripts/lint_framework_leakage_allowlist.json` (NEW). Initial content covers Cat-A hits (multi-stack detection that is intentionally cross-ecosystem). Shape:
  ```json
  {
    "version": 1,
    "_doc": "Each entry: { file: relative path from repo root, lines: [int,...] | \"*\" for whole file, reason: short justification }. Use sparingly — first ask whether the file should be neutralized instead.",
    "entries": [
      { "file": ".agent-src.uncompressed/skills/using-git-worktrees/SKILL.md", "lines": [130, 131, 132], "reason": "Multi-stack package-manager comparison table" },
      { "file": ".agent-src.uncompressed/skills/refine-prompt/SKILL.md", "lines": [88, 90, 92, 269], "reason": "Project-detection enumeration listing all supported stacks" },
      { "file": ".agent-src.uncompressed/commands/onboard.md", "lines": [220, 221, 224], "reason": "Stack-detection enumeration in onboard flow" },
      { "file": ".agent-src.uncompressed/commands/analyze-reference-repo.md", "lines": [62], "reason": "Manifest-file enumeration across ecosystems" },
      { "file": ".agent-src.uncompressed/commands/optimize/augmentignore.md", "lines": "*", "reason": "Per-stack augmentignore rules — by definition stack-aware" },
      { "file": ".agent-src.uncompressed/commands/optimize/rtk.md", "lines": "*", "reason": "Per-tool rtk filter detection — by definition tool-aware" }
    ]
  }
  ```
- [ ] **Note**: every other Cat-A candidate must be **explicitly added** to this allowlist with a `reason` field; default is "hit fails CI".

### Step 0.4: Tests

- [ ] **Create file** `tests/test_lint_framework_leakage.py` (NEW, ~120 lines). Mirror `tests/test_lint_roadmap_ci_steps.py` shape (pytest, tmp_path fixtures). Required cases:
  1. `test_clean_file_passes` — generic skill with no patterns → exit 0.
  2. `test_formrequest_in_generic_fails` — generic skill mentioning `FormRequest` → exit 1.
  3. `test_formrequest_in_carve_out_passes` — same pattern under `skills/laravel-validation/` → exit 0.
  4. `test_phpstan_mandate_fails` — generic rule mandating PHPStan → exit 1.
  5. `test_allowlisted_line_passes` — hit listed in allowlist by `file` + `lines` → exit 0; summary reports `1 allowlisted`.
  6. `test_allowlist_whole_file_passes` — `lines: "*"` → all hits in that file allowlisted.
  7. `test_json_output_shape` — `--json` produces valid JSON with `version`, `hits[]`, `summary` keys.
  8. `test_quiet_mode_only_prints_summary` — `--quiet` stdout matches `^\d+ hits across \d+ files \(\d+ allowlisted\)$`.
  9. `test_multistack_table_with_2_ecosystems_passes` — file containing both `composer.json` and `package.json` on adjacent lines → exit 0 (heuristic: treat as Cat-A automatically — see Step 0.5).
  10. `test_unknown_path_argument_errors` — invalid `--paths` arg → exit 2.

### Step 0.5: Auto-detect cross-stack tables (heuristic)

- [ ] In `scripts/lint_framework_leakage.py`, add a post-filter: if a hit's line OR any of the ±2 surrounding lines also contains a pattern from a **different ecosystem family** (Laravel/PHP vs JS-specific vs Python-specific vs Symfony), mark it as `cross_stack=True` and skip it without consulting the allowlist. Families:
  - `php_family = {"Laravel", "PHP", "Symfony"}` — count as ONE family for cross-stack.
  - `js_family = {"JS-specific"}`
  - `python_family = {"Python-specific"}`
- [ ] Cross-stack auto-skip requires at least **two distinct families** in the ±2-line window.
- [ ] Rationale: a `composer.json` mentioned alone is leakage; `composer.json` next to `package.json` is documentation.

### Step 0.6: Wire into Taskfile

- [ ] **Edit** `Taskfile.yml` — add after `lint-roadmap-ci-steps:` block (find via `grep -n "lint-roadmap-ci-steps:" Taskfile.yml`):
  ```yaml
    lint-framework-leakage:
      desc: "Block PHP/Laravel/etc. leakage in generic skills/rules/commands"
      cmds:
        - python3 scripts/lint_framework_leakage.py --quiet
      silent: true
  ```
- [ ] **Edit** `taskfiles/ci-fast.yml` — add `- task: lint-framework-leakage` to the `ci-fast:` task's `cmds:` list, immediately after the `lint-roadmap-ci-steps` line. Find via `grep -n "lint-roadmap-ci-steps" taskfiles/ci-fast.yml`.
- [ ] **Verify**: `task lint-framework-leakage` runs; exits non-zero today (584 hits); will turn green at end of Phase 6.

### Step 0.7: Phase 0 acceptance

- [ ] `python3 scripts/lint_framework_leakage.py --quiet` prints `NNN hits across MM files (KK allowlisted)` and exits 1.
- [ ] `pytest tests/test_lint_framework_leakage.py -q` shows `10 passed`.
- [ ] `python3 scripts/compile_router.py` regenerates `.agent-src/router.json`; `jq '.tier_2 | length' .agent-src/router.json` returns previous count + 1.
- [ ] `task lint-skills` still green.
- [ ] No edits to existing skills/rules/commands — Phase 0 only adds infrastructure.


## Phase 1: Tier-1 — Iron-Law mandate leakage

> Generic rules and high-traffic skills that **mandate** a PHP/Laravel pattern as the only path. Surgical edits, exact old→new blocks.

### Step 1.1: `.agent-src.uncompressed/rules/architecture.md`

**Why**: This file is loaded on every "controller / service / module / structural decision" trigger, regardless of project language. L18–L22 mandate Laravel-only patterns (`__invoke()`, `FormRequest`, `services/` directory).

- [ ] **Edit L18–L22**. Find:
  ```
  ## General Principles

  - **Controllers are thin** — no business logic, delegate to services.
  - **Only Single Action Controllers** — every new controller MUST use `__invoke()`. No multi-action / resource controllers. See `../../docs/guidelines/php/controllers.md` for naming conventions.
  - **Every controller needs a FormRequest** — never validate inline with `$request->validate()`. Use a dedicated `FormRequest` subclass.
  - **Services contain business logic** — calculations, orchestration, validation.
  - **Models have no business logic** — only relationships, scopes, accessors/mutators.
  ```
  Replace with:
  ```
  ## General Principles

  - **HTTP handlers stay thin** — no business logic; delegate to a service / use-case / domain layer.
  - **Validate at the request boundary** — never inline-validate user input inside the handler. Use the framework's request-validation primitive (Laravel `FormRequest`, Symfony validator, Zod / class-validator in TS, Pydantic in Python).
  - **One handler, one responsibility** — prefer single-purpose handlers over multi-action controllers when the framework supports it (Laravel `__invoke`, Next.js route handlers, Express handler-per-route).
  - **Business logic lives in services / use-cases** — calculations, orchestration, cross-aggregate validation.
  - **Domain models stay behavior-rich but I/O-free** — no HTTP, no DB transactions in the model; only domain rules, relationships, derived properties.

  → Laravel-specific patterns (FormRequest, single-action `__invoke`, Eloquent scopes): see [`laravel`](../skills/laravel/SKILL.md), [`laravel-validation`](../skills/laravel-validation/SKILL.md).
  → Symfony: see [`symfony-workflow`](../skills/symfony-workflow/SKILL.md).
  → Next.js / TypeScript backends: see [`nextjs-patterns`](../skills/nextjs-patterns/SKILL.md).
  ```

- [ ] **Edit L19** — strip the `docs/guidelines/php/controllers.md` reference from the bullet (now superseded by the carve-out pointers in the new block above; already removed in the rewrite).

- [ ] **Edit L30–L31** (Project Detection bullets). Find:
  ```
  - Check `composer.json` for framework (Laravel, Symfony, standalone).
  - Check if `artisan` exists → Laravel project.
  - Check `package.json` for frontend framework (React, Vue, Next.js, etc.).
  ```
  Replace with a wider detection matrix:
  ```
  - **PHP** — `composer.json` (framework slot: Laravel via `artisan`, Symfony via `bin/console`, standalone otherwise).
  - **JS / TS** — `package.json` (framework slot: Next.js via `next` dep, Nuxt via `nuxt`, Express / Fastify / NestJS via deps; plain Node otherwise).
  - **Python** — `pyproject.toml` / `requirements.txt` (framework slot: Django via `django`, FastAPI via `fastapi`, Flask via `flask`).
  - **Go** — `go.mod` (framework slot: `gin`, `echo`, `fiber`, stdlib `net/http`).
  - **Ruby** — `Gemfile` (framework slot: Rails via `rails` gem, Sinatra otherwise).
  - **Rust** — `Cargo.toml` (framework slot: `axum`, `actix-web`, `rocket`).
  ```

- [ ] **Edit L35**. Find:
  ```
  For tooling detection (artisan vs composer), check if `artisan` exists in the project root.
  ```
  Replace with:
  ```
  Tooling lives in a runner file at the project root — detect once and reuse the result:
  `Taskfile.yml` → `task`, `Makefile` → `make`, `package.json` `scripts:` → `npm` / `pnpm` / `yarn`, `pyproject.toml` `[tool.poetry.scripts]` or `[project.scripts]` → `poetry` / `uv`, framework CLIs (`artisan`, `bin/console`, `manage.py`, `bin/rails`) when the matching manifest is present.
  ```

- [ ] **Edit L54**. Find:
  ```
  Some projects use a module system (e.g. `app/Modules/` in Laravel projects).
  ```
  Replace with:
  ```
  Some projects use a module system (e.g. `app/Modules/` in Laravel, `apps/`/`packages/` in a Turborepo, `src/modules/` in NestJS, `internal/` in Go).
  ```

### Step 1.2: `.agent-src.uncompressed/rules/verify-before-complete.md`

- [ ] **Edit L25**. Find: `1. **IDENTIFY** — What command proves this claim? (tests, PHPStan, build, etc.)`
  Replace with: `1. **IDENTIFY** — What command proves this claim? (tests, type-checker, linter, build — whichever the project actually runs)`

- [ ] **Edit L46**. Find: `- Relying on partial verification (ran tests but not PHPStan)`
  Replace with: `- Relying on partial verification (ran tests but skipped the type-checker / linter)`

### Step 1.3: `.agent-src.uncompressed/rules/downstream-changes.md`

- [ ] **Edit L74–L77**. Find:
  ```
  1. **No broken imports** — `php -l` or PHPStan catches these
  2. **No broken tests** — run the test suite
  3. **No broken types** — PHPStan Level 9 catches signature mismatches
  4. **No stale references** — grep for the old name/namespace to confirm zero results
  ```
  Replace with:
  ```
  1. **No broken imports / parse errors** — language-native syntax check (`php -l`, `tsc --noEmit`, `python -m py_compile`, `go build ./...`, `cargo check`).
  2. **No broken tests** — run the project test suite (Pest / PHPUnit, Jest / Vitest, pytest, `go test ./...`, `cargo test`).
  3. **No broken types / signatures** — project's type-checker (PHPStan / Psalm, TypeScript, mypy / pyright, `go vet`, `cargo check`).
  4. **No stale references** — grep for the old name / namespace / import path to confirm zero results.
  ```

### Step 1.4: `.agent-src.uncompressed/rules/context-hygiene.md`

- [ ] **Edit L64**. Find: `- Quality check (PHPStan, ECS) that still errors`
  Replace with: `- Quality check (type-checker, linter, formatter) that still errors`

### Step 1.5: `.agent-src.uncompressed/skills/verify-completion-evidence/SKILL.md`

- [ ] **Edit L51–L58** (claim → evidence table). Find the rows for PHPStan / Rector / ECS and broaden them:
  ```
  | "no static errors" | PHPStan / TypeScript / mypy on changed scope |
  | "style is clean" | ECS / Prettier / ESLint |
  | "no automated refactor pending" | Rector --dry-run clean |
  ```
  Replace with:
  ```
  | "no static errors" | project's type-checker on changed scope (PHPStan, `tsc --noEmit`, mypy / pyright, `go vet`, `cargo check`) |
  | "style is clean" | project's linter + formatter (ECS / Prettier / ESLint / Ruff / Black / gofmt / rustfmt) |
  | "no automated refactor pending" | project's auto-refactor dry-run if one exists (Rector for PHP — otherwise skip this row) |
  ```

- [ ] **Edit L62–L64** (Run the command fresh). Find:
  ```
  * For PHP projects inside Docker: run inside the container (see
    [`docker`](../docker/SKILL.md) and [`tests-execute`](../tests-execute/SKILL.md)).
  ```
  Replace with:
  ```
  * If the project runs commands inside a container or VM (Docker, Devcontainer, Vagrant), run them there — not on the host. See [`docker`](../docker/SKILL.md) and [`tests-execute`](../tests-execute/SKILL.md).
  ```

- [ ] **Edit L89–L104** (end-of-work sequence). Find the entire `## The end-of-work sequence (PHP projects)` section and replace with:
  ```
  ## The end-of-work sequence

  When all code changes are done and you are ready to report completion:

  1. **Targeted tests** — the test(s) covering the changed code pass.
  2. **Full test suite** — only after targeted pass is green.
  3. **Static analysis pipeline** — run the project's type-checker → auto-refactor dry-run (if any) → linter / formatter → type-checker (second pass catches issues the refactor / formatter may have introduced).
  4. Fix any output from steps 1–3 and restart the sequence.
  5. Only then: claim completion or suggest `/commit`, push, or PR.

  Do not run the full quality pipeline between intermediate edits — it burns time and tokens. Use it once, at the end.

  → For the **exact PHP commands** (PHPStan → Rector → ECS → PHPStan): see [`quality-tools`](../quality-tools/SKILL.md).
  → For TS / JS, Python, Go, Rust pipelines: the project's `Taskfile.yml` / `package.json scripts` / `Makefile` is the source of truth — read it before improvising.
  ```

- [ ] **Edit L110–L113** (minimum-evidence table). Find:
  ```
  | Code change (logic) | Targeted tests + PHPStan on changed scope |
  | New feature | Tests (new + suite) + PHPStan + smoke check (curl/UI) |
  | Bug fix | Regression test (RED → GREEN) + full suite |
  | Refactoring | Full suite + PHPStan + Rector dry-run |
  ```
  Replace with:
  ```
  | Code change (logic) | Targeted tests + project's type-checker on changed scope |
  | New feature | Tests (new + suite) + type-checker + smoke check (curl / UI / integration probe) |
  | Bug fix | Regression test (RED → GREEN) + full suite |
  | Refactoring | Full suite + type-checker + auto-refactor dry-run if available |
  ```

- [ ] **Edit L143**. Find: `* Silencing a warning with `@phpstan-ignore-next-line` or `// @ts-expect-error``
  Replace with: `* Silencing a warning with `@phpstan-ignore-next-line`, `// @ts-expect-error`, `# type: ignore`, `//nolint`` — leave the rest of the bullet intact.

### Step 1.6: `.agent-src.uncompressed/skills/code-review/SKILL.md`

**Why**: `code-review` is a top-50 entry skill triggered on every "review this", "check my code". Its checklist is a 100% Laravel-only spec (FormRequest, Eloquent, Pest, Blade) that misguides reviews on TS / Python / Go diffs.

- [ ] **Edit L40–L94** — replace the entire four-table checklist (Code quality / Architecture / Database & Performance / Security / Tests) with a language-neutral version. Find the block starting `### Code quality` through the end of `### Tests` (table ends at L94 `Flaky risks`). Replace with:
  ```
  ### Code quality

  | Check | What to look for |
  |---|---|
  | **Type discipline** | Strict types where the language supports them (`declare(strict_types=1)`, `tsc --strict`, `mypy --strict`, Go and Rust by default). Typed parameters, return types, properties. |
  | **Style** | Conforms to the project formatter / linter (see `Taskfile.yml` or `package.json scripts`). Catches: line length, trailing commas, naming, ordering. |
  | **Naming** | Descriptive, intention-revealing. Follow project conventions (`camelCase`, `snake_case`, `PascalCase`) per language. |
  | **Early returns** | Guard clauses at the top. Avoid deeply nested conditionals. |
  | **Single responsibility** | Each class / module / function does one thing. |
  | **No magic** | No reflection-based shortcuts that hide intent. No untyped `any` / `mixed` escape hatches without justification. |
  | **Docs / annotations** | Only where types are insufficient (generics, complex shapes, non-obvious invariants). No redundant docblocks. |

  → Language-specific style: see [`php-coder`](../php-coder/SKILL.md), [`nextjs-patterns`](../nextjs-patterns/SKILL.md), [`async-python-patterns`](../async-python-patterns/SKILL.md).

  ### Architecture

  | Check | What to look for |
  |---|---|
  | **Layer separation** | Business logic in services / use-cases, not in HTTP handlers. Domain models stay I/O-free. |
  | **Handler shape** | HTTP handlers are thin and follow the framework's idiomatic shape (Laravel single-action `__invoke`, Express handler-per-route, Next.js route handler, FastAPI endpoint). |
  | **Request validation** | All inbound payloads validated at the boundary via the framework's primitive (Laravel `FormRequest`, Zod / class-validator, Pydantic, etc.) — never inline ad-hoc checks inside the handler. |
  | **Response shaping** | Outbound payloads go through a transformer / serializer / DTO layer — never raw ORM entities. |
  | **DTOs** | Structured data passes between layers, not loose arrays / dicts / objects with unknown shape. |
  | **Dependency injection** | Dependencies arrive via constructor / function parameters; no service-locator lookups or globals in business logic. |

  → Laravel specifics (FormRequest, API Resources, Policy/Gate): see [`laravel`](../laravel/SKILL.md), [`laravel-validation`](../laravel-validation/SKILL.md).
  → Symfony specifics (DI, voters, Messenger): see [`symfony-workflow`](../symfony-workflow/SKILL.md).

  ### Database & Performance

  | Check | What to look for |
  |---|---|
  | **N+1 queries** | Related-data access in loops without prefetch / eager loading / `JOIN`. Same pattern across Eloquent (`with()`), Doctrine (`fetch="EAGER"` / DQL `JOIN FETCH`), Prisma (`include`), SQLAlchemy (`joinedload`), ActiveRecord (`includes`). |
  | **Missing indexes** | New columns used in WHERE / JOIN / ORDER BY without a backing index. |
  | **Unbounded queries** | `findAll` / `Model::all()` / `SELECT *` without pagination or explicit limit. |
  | **Raw SQL** | Parameterized queries only — no string concatenation with user input. Bind values, never interpolate. |
  | **Migrations** | Reversible (has `down` / `revert`). Targets the correct connection / schema / table prefix. |
  | **Money** | Decimal / fixed-point representation (PHP `decimal`, JS `bigint` / dedicated lib, Python `Decimal`, Go `shopspring/decimal`). Never `float` for monetary values. |

  ### Security

  | Check | What to look for |
  |---|---|
  | **Authorization** | Authorization check on every state-changing action (Policy / Gate / voter / middleware / route guard). No unprotected endpoints. |
  | **Input validation** | All user input validated at the boundary via the framework's validation primitive (see Architecture table). |
  | **Mass assignment / over-posting** | No blind `fill($request->all())` / `Object.assign(entity, body)` — explicit allowlist (`$fillable`, DTO mapping, validation schema). |
  | **Injection (SQL / command / template)** | No raw queries / shell calls / template strings built from unescaped user input. |
  | **XSS** | Templating engine auto-escapes by default and raw-output sinks are intentional (Blade `{!! !!}`, React `dangerouslySetInnerHTML`, Vue `v-html`, Jinja `|safe`, Twig `|raw`). |
  | **Sensitive data** | No secrets, tokens, credentials, or PII in code, logs, or error responses. |

  ### Tests

  | Check | What to look for |
  |---|---|
  | **Coverage** | New code paths have tests. Bug fixes have regression tests. |
  | **Test quality** | Verifies behavior, not implementation. No reliance on private state. |
  | **Framework idioms** | Conforms to the project's test framework conventions (Pest / PHPUnit / Jest / Vitest / pytest / Go testing / Rust `#[test]`). |
  | **Test data** | Built via factories / fixtures / seeders — not hand-rolled in each test. |
  | **Assertions** | Meaningful and specific. Not just "no exception thrown" unless that genuinely is the contract. |
  | **Flake risks** | Time-dependent tests freeze the clock (`travel()`, `jest.useFakeTimers`, `freezegun`). No reliance on execution speed or external network. |

  → Pest specifics: see [`pest-testing`](../pest-testing/SKILL.md). Playwright: see [`playwright-testing`](../playwright-testing/SKILL.md).
  ```

- [ ] **Edit L98–L99** (Before creating a PR — quality pipeline). Find:
  ```
  1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill for commands)
  2. Run tests: `make test` (or project equivalent)  <!-- carve-out: new-gate-verification -->
  ```
  Replace with:
  ```
  1. Run the project's quality pipeline — for PHP that is PHPStan → Rector → ECS → PHPStan (see [`quality-tools`](../quality-tools/SKILL.md)); for other stacks consult `Taskfile.yml` / `package.json scripts` / `Makefile`.
  2. Run tests via the project's test runner (`task test`, `make test`, `npm test`, `pytest`, `go test ./...`, `cargo test` — whichever the project uses).  <!-- carve-out: new-gate-verification -->
  ```

- [ ] **Edit L214**. Find: `- Do NOT nitpick style issues that ECS/Rector handle automatically.`
  Replace with: `- Do NOT nitpick style issues that the project's formatter / linter handles automatically.`

### Step 1.7: `.agent-src.uncompressed/skills/security/SKILL.md`

**Why**: `security` is loaded on every auth / authorization / CSRF / XSS trigger. Today it hard-mandates Laravel primitives (`tymon/jwt-auth`, `sanctum`, `app/Policies/`, `FormRequest::authorize()`, `Gate::`, `PHPStan`).

- [ ] **Edit L3** (frontmatter description). Find: `"Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding."`
  Replace with: `"Use when applying security best practices — authentication, authorization, CSRF / CORS, input sanitization, rate limiting, secret handling, or secure coding. Language- and framework-neutral; pointers to framework specifics."`

- [ ] **Edit L16** (Do NOT use when — validation route). Find: `* Validation logic only — route to [`laravel-validation`](../laravel-validation/SKILL.md)`
  Replace with: `* Validation logic only — route to the framework-specific validation skill ([`laravel-validation`](../laravel-validation/SKILL.md), Symfony validator via [`symfony-workflow`](../symfony-workflow/SKILL.md), Zod / class-validator via [`nextjs-patterns`](../nextjs-patterns/SKILL.md)).`

- [ ] **Edit L25–L46** — replace the whole `## Procedure: Implement security for a feature` section (Step 0 through Step 3). Find the entire block from `### Step 0: Inspect` through the end of `### Step 3: Review for adversarial` (ends at L46). Replace with:
  ```
  ### Step 0: Inspect

  1. Read `agents/authentication.md` (or equivalent project doc) for the auth flow.
  2. Read `agents/gates.md` (or equivalent) for the authorization-rule pattern.
  3. Inspect the project's existing authorization primitives — directory layout depends on the stack:
     - Laravel: `app/Policies/`
     - Symfony: `src/Security/Voter/`
     - NestJS: `src/**/guards/`
     - FastAPI: dependency-injected scope checkers
     - Express: route-level middleware
     - Next.js: `middleware.ts` + per-route guards

  ### Step 1: Authentication

  - Identify the auth primitive in use — read the project's auth config:
    - Laravel: `config/auth.php` + drivers (`tymon/jwt-auth`, `laravel/sanctum`, `laravel/passport`).
    - Symfony: `config/packages/security.yaml` + firewalls.
    - Express / NestJS: passport strategies / JWT middleware.
    - Next.js: NextAuth / Auth.js / Clerk / Lucia.
    - FastAPI / Django: project-defined auth backends.
  - Multi-tenant boundary lookup (customer / org / workspace) happens **after** auth — see [`multi-tenancy`](../multi-tenancy/SKILL.md) for the Laravel pattern; other stacks follow the same shape (resolve tenant from authenticated principal).

  ### Step 2: Authorization

  1. Create / extend the project's authorization primitive (Policy / voter / guard / dependency).
  2. Wire it into the request-handling boundary — never inline `if (user can do X)` checks inside the handler when a framework primitive exists.
  3. For non-resource gates (e.g. "feature is enabled for this tenant"), use the project's feature-flag or gate registry.

  ### Step 3: Review for adversarial

  For security-sensitive changes, run [`adversarial-review`](../adversarial-review/SKILL.md).
  Focus on: attack surface, trust-boundary crossings, authorization gaps, injection sinks, secret exposure.
  ```

- [ ] **Edit L50** (Conventions pointer). Find: `→ See guideline `php/security.md` for auth, SQL injection, XSS, CSRF, headers, session, mass assignment.`
  Replace with:
  ```
  → PHP / Laravel specifics: see guideline `php/security.md` and [`laravel`](../laravel/SKILL.md).
  → Symfony specifics: see [`symfony-workflow`](../symfony-workflow/SKILL.md).
  → JS / TS specifics: see [`nextjs-patterns`](../nextjs-patterns/SKILL.md) and the project's middleware layer.
  ```

- [ ] **Edit L52–L57** (Validate sub-section). Find:
  ```
  ### Validate

  - Verify all user input is validated via FormRequest before use.
  - Confirm authorization check exists (Policy or Gate) for every state-changing action.
  - Check that no raw user input reaches SQL, HTML output, or shell commands.
  - Run PHPStan — must pass (catches type-safety issues that enable injection).
  ```
  Replace with:
  ```
  ### Validate

  - Verify all user input is validated at the request boundary via the framework's validation primitive (FormRequest, Symfony validator, Zod / class-validator, Pydantic, etc.) before use.
  - Confirm an authorization check exists for every state-changing action (Policy / voter / guard / middleware / route dependency).
  - Check that no raw user input reaches SQL, HTML output, shell commands, or template rendering as raw / unescaped content.
  - Run the project's type-checker — must pass (catches type-safety issues that enable injection in dynamically-typed paths).
  ```

- [ ] **Edit L67** (Gotcha — Gate). Find: `- `Gate::authorize()` throws, `Gate::allows()` returns bool — choose based on error handling.`
  Replace with: `- Framework authorization helpers split into "throw-on-deny" and "return-bool" variants (Laravel `Gate::authorize()` vs `Gate::allows()`, Symfony `denyAccessUnlessGranted()` vs `isGranted()`) — choose based on whether the caller wants exception-driven control flow or branching logic.`

- [ ] **Edit L73–L74** (Do NOT — FormRequest mandate). Find:
  ```
  - Do NOT bypass FormRequest validation in controllers.
  - Do NOT use `$request->all()` for mass assignment — use `$request->validated()`.
  ```
  Replace with:
  ```
  - Do NOT bypass the framework's request-validation primitive inside handlers — never inline-validate user input.
  - Do NOT mass-assign from raw request payloads (`$request->all()`, `Object.assign(entity, body)`, `**request.dict()` into a model constructor) — use the validated / allowlisted payload (`$request->validated()`, parsed DTO, validated Pydantic model).
  ```


### Step 1.8: `.agent-src.uncompressed/skills/api-endpoint/SKILL.md` — extract + rewrite

**Why**: This file is the **trigger artifact** for this audit. Today it is 100% Laravel: every code block, every file-path convention, every Do-NOT. The user's report ("API endpoints don't have to be Laravel, don't have to be PHP") names this file directly.

**Strategy**: Two-step — extract the Laravel-specific content into a new carve-out skill `laravel-api-endpoint`, then rewrite `api-endpoint` itself as a thin stack-routing shell.

#### Step 1.8a: Create new carve-out `.agent-src.uncompressed/skills/laravel-api-endpoint/SKILL.md` (NEW)

- [ ] **Create directory** `.agent-src.uncompressed/skills/laravel-api-endpoint/`.
- [ ] **Create file** `.agent-src.uncompressed/skills/laravel-api-endpoint/SKILL.md` (~165 lines).
- [ ] **Frontmatter** (exact):
  ```yaml
  ---
  name: laravel-api-endpoint
  description: "Use when creating a Laravel API endpoint — Controller, FormRequest, Resource, route, Policy, OpenAPI attributes. Single-action `__invoke` controllers, versioned routes, type-hinted Resource returns."
  source: package
  domain: engineering
  ---
  ```
- [ ] **Body**: copy the existing `api-endpoint/SKILL.md` content from L28 through L156 (the `## Laravel projects` section through `### OpenAPI documentation`). Demote the `## Laravel projects` heading to `# laravel-api-endpoint` at the top, then keep the subsections (`### What to generate`, `### Conventions`, `### Show endpoint example`, `### Create endpoint with service injection`, `### FormRequest example`, `### List endpoint with CollectionFormRequest`, `### File locations`, `### OpenAPI documentation`) intact, including all PHP code blocks verbatim.
- [ ] **Prepend** standard `## When to use` block:
  ```
  ## When to use

  Use when the user asks to create a new API endpoint in a **Laravel** project (presence of `artisan` + `composer.json` with `laravel/framework`).

  Do NOT use when:
  - The project is not Laravel — route to [`api-endpoint`](../api-endpoint/SKILL.md) for the stack-router.
  - Modifying existing endpoints (use `code-refactoring` skill).
  - API design decisions (use [`api-design`](../api-design/SKILL.md)).
  ```
- [ ] **Append** at the end:
  ```
  ## Output format

  1. Generated files — controller, route registration, FormRequest, Resource, Policy.
  2. Test file with happy path and validation error cases ([`pest-testing`](../pest-testing/SKILL.md)).
  3. Summary of created files and their locations.

  ## Gotcha

  - Don't forget to register the route — creating the controller without the route is a common miss.
  - Always check if a similar endpoint already exists — duplicates cause confusion.
  - FormRequest validation rules must match the OpenAPI schema — keep them in sync.
  - The model tends to forget the `return` type on Resource `toArray()` methods.

  ## Do NOT

  - Do NOT put business logic in controllers — delegate to services.
  - Do NOT skip FormRequest validation — every controller needs a FormRequest.
  - Do NOT return raw Eloquent models — always use API Resources.
  - Do NOT create routes without proper authorization (Policy in FormRequest or middleware).
  - Do NOT create multi-action controllers — only single-action with `__invoke()`.
  - Do NOT use `response()->json()` — use `Resource::make()`.

  ## Auto-trigger keywords

  - create laravel endpoint
  - new laravel API route
  - laravel controller
  - FormRequest
  - API Resource
  - invokable controller
  ```

#### Step 1.8b: Rewrite `.agent-src.uncompressed/skills/api-endpoint/SKILL.md` as a stack-routing shell

- [ ] **Replace the entire file** with the content below (~110 lines):
  ```
  ---
  name: api-endpoint
  description: "Use when the user says 'create endpoint', 'new API route', or 'add controller / route handler'. Routes to the framework-specific carve-out; covers conventions common to every stack."
  source: package
  domain: engineering
  ---

  # api-endpoint

  ## When to use

  Use this skill when the user asks to create a new API endpoint, REST route, route handler, or controller action — in any language / framework.

  Do NOT use when:
  - Modifying existing endpoints (use `code-refactoring` skill).
  - API design decisions — shape, versioning, deprecation, contract (use [`api-design`](../api-design/SKILL.md)).
  - The project is GraphQL / RPC — use the project's schema-driven workflow instead.

  ## Step 0: Route to the carve-out

  Detect the stack, then hand off to the matching carve-out skill for the framework-specific procedure (file layout, validation primitive, response-shaping convention).

  | Detected stack | Carve-out skill |
  |---|---|
  | Laravel (`artisan` + `composer.json` with `laravel/framework`) | [`laravel-api-endpoint`](../laravel-api-endpoint/SKILL.md) |
  | Symfony (`bin/console` + `composer.json` with `symfony/framework-bundle`) | [`symfony-workflow`](../symfony-workflow/SKILL.md) |
  | Next.js (`next` in `package.json`) | [`nextjs-patterns`](../nextjs-patterns/SKILL.md) |
  | Express / Fastify / NestJS / plain Node | follow project conventions in `agents/` + `package.json scripts` |
  | FastAPI / Django / Flask | follow project conventions in `agents/` + `pyproject.toml` |
  | Go (`net/http`, `gin`, `echo`, `fiber`) | follow project conventions in `agents/` + `go.mod` |
  | Rust (`axum`, `actix-web`, `rocket`) | follow project conventions in `agents/` + `Cargo.toml` |

  If the project doc folder (`agents/`) has an endpoint-creation guide, that is the source of truth — read it before generating code.

  ## Procedure: Create an API endpoint (stack-neutral)

  1. **Read project docs** — Check `./agents/` and `AGENTS.md` for endpoint conventions, routing layout, response shape.
  2. **Detect stack** and route to the carve-out per the table above.
  3. **Plan the endpoint** — method, path, request shape, response shape, auth requirement, idempotency.
  4. **Create the route registration** in the project's routing surface (route file, decorator-annotated handler, file-based router).
  5. **Create the request handler / controller** — thin; delegate business logic to a service / use-case.
  6. **Validate input at the boundary** via the framework's validation primitive (FormRequest, Zod, class-validator, Pydantic, struct-tag validators, etc.) — never inline ad-hoc `if` checks.
  7. **Authorize the action** via the framework's authz primitive (Policy, voter, guard, middleware, route dependency).
  8. **Shape the response** through a transformer / serializer / DTO — never return raw ORM entities.
  9. **Document** the endpoint (OpenAPI annotations / generated spec / project doc).
  10. **Verify** — run the project type-checker + targeted tests + smoke probe (`curl` / Bruno / Postman / integration test).

  ## Conventions (apply on every stack)

  - **One handler, one responsibility** — prefer single-purpose handlers over multi-action controllers when the framework supports it.
  - **No business logic in the handler** — delegate to a service / use-case layer.
  - **Validate at the boundary** — never trust raw request data inside the handler.
  - **Authorize every state-changing action** — no unprotected mutating endpoints.
  - **Shape responses through a transformer** — DTO, serializer, API resource, response model — never expose raw ORM entities.
  - **Version the API surface** explicitly (`/v1/`, header, content-type) — don't rely on implicit versioning.

  ## Output format

  1. Generated files — route registration, handler, request validator, response shaper, authorization rule.
  2. Test file with happy path and validation-error cases (using the project's test framework).
  3. Summary of created files and their locations.

  ## Gotcha

  - Don't forget to register the route — creating the handler without the route is a common miss.
  - Always check if a similar endpoint already exists — duplicates cause confusion.
  - Validation rules must match the documented contract (OpenAPI / schema / typed client) — keep them in sync.
  - Response shapes are part of the public contract — adding a field is additive; renaming or removing is breaking.

  ## Do NOT

  - Do NOT put business logic in the handler — delegate to services / use-cases.
  - Do NOT skip request validation — every handler validates at the boundary via the framework's primitive.
  - Do NOT return raw ORM entities — always go through a transformer / serializer / response model.
  - Do NOT create unprotected state-changing endpoints — authorize every mutation.
  - Do NOT improvise framework idioms — read the carve-out (`laravel-api-endpoint`, `nextjs-patterns`, etc.) for the stack-correct shape.

  ## Auto-trigger keywords

  - create endpoint
  - new API route
  - route handler
  - controller creation
  - REST endpoint
  - add endpoint
  ```

#### Step 1.8c: Update consumers + verify

- [ ] **Grep for references** to `api-endpoint` across `.agent-src.uncompressed/`, `docs/`, and `AGENTS.md`. Find: `rg -n "api-endpoint" .agent-src.uncompressed docs AGENTS.md`. For each match, decide:
  - If the context is Laravel-specific → update the reference to `laravel-api-endpoint`.
  - If the context is generic → leave the reference pointing at `api-endpoint` (now the router shell).
- [ ] **Verify** `python3 scripts/lint_framework_leakage.py --paths .agent-src.uncompressed/skills/api-endpoint --quiet` exits 0.
- [ ] **Verify** `python3 scripts/lint_skills.py` passes for the new `laravel-api-endpoint` skill (frontmatter, sections present).




## Phase 1 acceptance criteria

- [ ] `python3 scripts/lint_framework_leakage.py --paths .agent-src.uncompressed/rules .agent-src.uncompressed/skills/api-endpoint .agent-src.uncompressed/skills/code-review .agent-src.uncompressed/skills/security .agent-src.uncompressed/skills/verify-completion-evidence --quiet` exits 0.
- [ ] `task lint-skills` green for all files touched in Phase 1 (and the new `laravel-api-endpoint`).
- [ ] `git diff --stat` shows changes in exactly the 8 files Phase 1 names (4 rules + 4 skills) plus 1 new file (`laravel-api-endpoint/SKILL.md`).
- [ ] Manual smoke: open `api-endpoint/SKILL.md` and confirm the stack-routing table is present; open `laravel-api-endpoint/SKILL.md` and confirm the PHP code blocks are intact.

---

## Phase 2: Tier-2 Skills — Generalize generic skills with PHP/Laravel leakage

> 8 high-impact skills where Laravel is currently the default or only path. Every fix removes the hard mandate, demotes Laravel to "e.g." status, and adds peer examples for Symfony / JS-TS / Python / Go. No carve-out renames in this phase — those are Phase 5.

### Step 2.1: `.agent-src.uncompressed/skills/code-refactoring/SKILL.md` (20 hits)

**Why**: Step 3 is a Laravel-only API-layer table (FormRequest, Resource, OpenAPI attributes). Steps 5–6 mandate PHPStan + Rector + ECS + `php artisan test`. Step 7 names `app/Modules/`. Description leads with "Safely refactors PHP code".

- [ ] **Edit L3** (frontmatter description). Find: `"Use when the user says "refactor this", "rename class", or "move method". Safely refactors PHP code — finds all callers, updates downstream dependencies, and verifies with quality tools."`
  Replace with: `"Use when the user says 'refactor this', 'rename class', or 'move method'. Safely refactors code in any language — finds all callers, updates downstream dependencies, and verifies with the project's quality tools."`

- [ ] **Edit L23** (Before refactoring — module path). Find: `For modules, also read `app/Modules/{Module}/agents/`. See the `project-docs` skill for the mapping.`
  Replace with: `For modules, also read the project's module-docs directory (path varies by stack — Laravel: `app/Modules/{Module}/agents/`; Nx: `apps/{app}/docs/`; mono-repo: per-package `docs/`). See the `project-docs` skill for the mapping.`

- [ ] **Edit L44** (Step 2 — Type hints sub-bullet). Find: `- **Type hints / PHPDoc**: Update type references.`
  Replace with: `- **Type hints / annotations**: Update type references (PHPDoc, TypeScript types, Python type hints, Go generics, Rust generics).`

- [ ] **Edit L45** (Step 2 — Imports). Find: `- **Imports**: Add or update `use` statements.`
  Replace with: `- **Imports**: Add or update import statements (`use` for PHP, `import` for JS/TS/Python, `import` blocks for Go, `use` for Rust).`

- [ ] **Edit L48–L65** — replace the entire `### Step 3: Update API layer` section. Find the block from `### Step 3: Update API layer (if controllers/endpoints are affected)` through the end of the table (ends at L65 with `| **Module routes** | ...`). Replace with:
  ```
  ### Step 3: Update API layer (if request handlers / endpoints are affected)

  When refactoring touches handlers, route registrations, request validators, or response shapers, walk the stack-appropriate boundary. Use the carve-out skill for the project's framework if one exists; otherwise consult the table below for what to check on each stack.

  | Layer | What to check and update |
  |---|---|
  | **Route registration** | Route file / decorator / file-based-router entry — name, URL, HTTP method, parameter binding |
  | **Handler / Controller** | Entry signature, injected dependencies, return type |
  | **Request validator** | Validation rule definitions, allowlisted fields (FormRequest, Zod schema, class-validator DTO, Pydantic model, struct tags) |
  | **Response shaper** | Field mapping in the transformer (API Resource, serializer, DTO mapper, response model) |
  | **API contract** | OpenAPI annotations, generated spec, typed client (regenerate if generated) |
  | **Authorization rule** | Policy / voter / guard / middleware / route dependency that protects the route |
  | **Module routes** | Module-local routing surface (Laravel `app/Modules/*/Routes/`, Nx `apps/*/src/routes`, mono-repo per-package routes) |

  Carve-out routing:
  - Laravel: [`laravel-api-endpoint`](../laravel-api-endpoint/SKILL.md)
  - Next.js: [`nextjs-patterns`](../nextjs-patterns/SKILL.md)
  - Symfony: [`symfony-workflow`](../symfony-workflow/SKILL.md)
  ```

- [ ] **Edit L92–L99** — replace the entire `### Step 5: Verify with quality tools` section. Find:
  ```
  ### Step 5: Verify with quality tools

  Run quality tools after each significant step — do NOT batch everything to the end:

  - Run PHPStan: `vendor/bin/phpstan analyse` (see `quality-tools` skill for detection).
  - If PHPStan finds new errors from the refactoring → fix immediately before continuing.
  - Run Rector + ECS: `vendor/bin/rector process && vendor/bin/ecs check --fix`.
  - Run PHPStan again after Rector (Rector can introduce issues).
  ```
  Replace with:
  ```
  ### Step 5: Verify with the project's quality tools

  Run the project's type-checker and linter after each significant step — do NOT batch everything to the end. The exact command set depends on the stack; resolve via `quality-tools` skill or the project's `Taskfile.yml` / `package.json scripts` / `composer.json scripts` / `Makefile`.

  | Stack | Typical pipeline |
  |---|---|
  | Laravel / PHP | `vendor/bin/phpstan analyse` → `vendor/bin/rector process` → `vendor/bin/ecs check --fix` → re-run PHPStan |
  | TypeScript | `tsc --noEmit` → `eslint --fix` → `prettier --write` |
  | Python | `mypy` (or `pyright`) → `ruff check --fix` → `ruff format` |
  | Go | `go vet ./...` → `golangci-lint run --fix` → `gofmt -w` |
  | Rust | `cargo check` → `cargo clippy --fix` → `cargo fmt` |

  If auto-fixers can rewrite types (Rector for PHP, `eslint --fix` for TS), re-run the type-checker after them — auto-fixers can introduce new errors.
  ```

- [ ] **Edit L101–L105** — replace `### Step 6: Run tests`. Find:
  ```
  ### Step 6: Run tests

  - Run tests related to the changed code first (`php artisan test --filter=...`).
  - Then run the full test suite (`php artisan test`).  <!-- carve-out: new-gate-verification -->
  - All tests must pass before the refactoring is considered complete.
  ```
  Replace with:
  ```
  ### Step 6: Run tests

  - Run tests related to the changed code first (`php artisan test --filter=...`, `pnpm test -- <pattern>`, `pytest -k <pattern>`, `go test ./{path}/...`, `cargo test {pattern}`).
  - Then run the full test suite (`php artisan test`, `pnpm test`, `pytest`, `go test ./...`, `cargo test`).  <!-- carve-out: new-gate-verification -->
  - All tests must pass before the refactoring is considered complete.
  ```



### Step 2.2: `.agent-src.uncompressed/skills/dependency-upgrade/SKILL.md` (18 hits)

**Why**: Description leads with "update Laravel" / "bump PHP version". Verification block at L80–91 lists PHP/Laravel commands as the canonical pipeline and treats JS as a secondary path. Python, Go, Rust have no peer examples. Common-pitfalls table at L114 names PHPStan as the only verifier.

- [ ] **Edit L3** (frontmatter description). Find: `"Use when upgrading dependencies — "update Laravel", "bump PHP version", or "upgrade packages". Covers changelog review, breaking change detection, and verification."`
  Replace with: `"Use when upgrading dependencies — 'update framework X', 'bump runtime version', or 'upgrade packages'. Covers changelog review, breaking change detection, and verification. Stack-agnostic (Composer, npm/pnpm, pip/poetry, go.mod, Cargo)."`

- [ ] **Edit L12** (When to use). Find: `Use this skill when upgrading Composer packages, npm packages, or any project dependency.`
  Replace with: `Use this skill when upgrading project dependencies on any stack — Composer (PHP), npm / pnpm / yarn (JS/TS), pip / poetry / uv (Python), go.mod (Go), Cargo (Rust), or any other language-level package manager.`

- [ ] **Edit L28** (Assess — runtime). Find: `- **Check PHP/Node version requirements** — does the new version need a newer runtime?`
  Replace with: `- **Check runtime version requirements** — does the new version need a newer PHP / Node / Python / Go / Rust toolchain?`

- [ ] **Insert AFTER L74** (after the `### npm` block). Add two new sub-sections so Python and Go are peers, not afterthoughts:
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
  ```

- [ ] **Edit L78–L91** — replace the `### 4. Verify` block. Find:
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
  ```
  Replace with:
  ```
  ### 4. Verify

  After upgrading, run the project's full verification pipeline. The exact commands depend on the stack — resolve via the project's `Taskfile.yml`, `package.json scripts`, `composer.json scripts`, `Makefile`, or the `quality-tools` skill.

  | Stack | Type-check | Lint / autofix | Tests |
  |---|---|---|---|
  | PHP / Laravel | `vendor/bin/phpstan analyse` | `vendor/bin/rector process` + `vendor/bin/ecs check --fix` | `php artisan test` (or `vendor/bin/pest`) |  <!-- carve-out: new-gate-verification -->
  | TypeScript | `tsc --noEmit` | `eslint --fix` + `prettier --write` | `pnpm test` (or `vitest run`, `jest`) |
  | Python | `mypy` / `pyright` | `ruff check --fix` + `ruff format` | `pytest` |
  | Go | `go vet ./...` | `golangci-lint run --fix` | `go test ./...` |
  | Rust | `cargo check` | `cargo clippy --fix` + `cargo fmt` | `cargo test` |

  Re-run the type-checker after any auto-fixer that can rewrite types (Rector for PHP, `eslint --fix` for TS).
  ```

- [ ] **Edit L103** (Multi-package — exception line). Find: `- **Exception:** Tightly coupled packages (e.g., `laravel/framework` + `laravel/*`) can be upgraded together.`
  Replace with: `- **Exception:** Tightly coupled packages can be upgraded together (e.g., `laravel/framework` + `laravel/*`; `@nestjs/core` + `@nestjs/*`; `react` + `react-dom`; `next` + `@next/*`).`

- [ ] **Edit L114** (Common pitfalls — Skipping tests row). Find: `| Skipping tests after upgrade | Full test suite + PHPStan after every upgrade |`
  Replace with: `| Skipping tests after upgrade | Full test suite + project type-checker (PHPStan / tsc / mypy / `go vet` / `cargo check`) after every upgrade |`

### Step 2.3: `.agent-src.uncompressed/skills/merge-conflicts/SKILL.md` (12 hits)

**Why**: Step 4 has a `#### PHP files` subsection that uses `php -l` and PHPStan as the canonical post-resolve check. Step 4 `#### Migrations` mandates `php artisan migrate --env=testing`. Step 6 verify-block hardcodes `php artisan test` and `vendor/bin/phpstan analyse`. Result: a JS-only or Python-only project can't follow Step 6 without translation.

- [ ] **Edit L54** (Section header). Find: `### 4. File-type specific rules`
  Replace with: `### 4. File-type specific rules (stack-aware)`

- [ ] **Edit L56–L66** — replace the `#### PHP files` and `#### Migrations` blocks with a stack-aware version. Find:
  ```
  #### PHP files

  - After resolving, check that `use` statements are correct (no duplicates, no missing imports).
  - Verify the resolved code compiles: `php -l filename.php`
  - Run PHPStan on the file: `vendor/bin/phpstan analyse` (see `quality-tools` skill)

  #### Migrations

  - Never merge two migrations that modify the same table into one.
  - If both branches added migrations, keep both — adjust timestamps if they collide.
  - After resolving, run migrations to verify: `php artisan migrate --env=testing`
  ```
  Replace with:
  ```
  #### Source files (any language)

  - After resolving, check that import statements are correct (no duplicates, no missing imports). Applies to PHP `use`, JS/TS `import`, Python `import`, Go `import`, Rust `use`.
  - Verify the resolved file parses with the project's type-checker / linter on just the touched file:
    - PHP: `php -l filename.php` then `vendor/bin/phpstan analyse path/to/file.php`
    - TypeScript: `tsc --noEmit` (full project) or `eslint path/to/file.ts`
    - Python: `python -m py_compile path/to/file.py` then `mypy path/to/file.py`
    - Go: `go vet ./path/to/pkg/...`
    - Rust: `cargo check`

  #### Database migrations

  - Never merge two migrations that modify the same table into one.
  - If both branches added migrations, keep both — adjust timestamps / ordering to avoid collision.
  - After resolving, run migrations against a disposable database to verify:
    - Laravel: `php artisan migrate --env=testing`
    - Symfony / Doctrine: `php bin/console doctrine:migrations:migrate --env=test --no-interaction`
    - Node / Prisma: `pnpm prisma migrate dev --schema=...`
    - Node / Knex: `pnpm knex migrate:latest --env test`
    - Python / Alembic: `alembic upgrade head` (against a test DB URL)
    - Go / golang-migrate: `migrate -path ./migrations -database "$TEST_DATABASE_URL" up`
  ```

- [ ] **Edit L93–L113** — replace the `### 6. Verify after resolution` block. Find:
  ```
  ### 6. Verify after resolution

  After resolving ALL conflicts:

  ```bash
  # 1. Check no conflict markers remain
  grep -rn "<<<<<<< \|======= \|>>>>>>> " --include="*.php" --include="*.js" --include="*.ts" .

  # 2. Syntax check PHP files
  find . -name "*.php" -newer .git/MERGE_HEAD -exec php -l {} \;

  # 3. Run quality tools
  vendor/bin/phpstan analyse

  # 4. Run tests
  php artisan test

  # 5. Complete the merge/rebase
  git add .
  # Don't commit — let the user decide when to commit
  ```
  ```
  Replace with:
  ```
  ### 6. Verify after resolution

  After resolving ALL conflicts:

  ```bash
  # 1. Check no conflict markers remain (stack-agnostic — no --include filter)
  grep -rn "<<<<<<< \|======= \|>>>>>>> " . \
    --exclude-dir=node_modules --exclude-dir=vendor --exclude-dir=.git
  ```

  ```bash
  # 2. Syntax-check changed files (stack-dependent — pick the row that matches the project)
  # PHP:    find . -name "*.php" -newer .git/MERGE_HEAD -exec php -l {} \;
  # TS:     tsc --noEmit
  # Python: python -m compileall -q .
  # Go:     go build ./...
  # Rust:   cargo check
  ```

  ```bash
  # 3. Run the project's quality tools — resolve via the quality-tools skill, Taskfile,
  #    package.json scripts, composer.json scripts, or Makefile. Examples per stack:
  # PHP:    vendor/bin/phpstan analyse
  # TS:     pnpm lint
  # Python: ruff check && mypy
  # Go:     golangci-lint run
  # Rust:   cargo clippy
  ```

  ```bash
  # 4. Run tests — full suite, not just the touched files
  # PHP:    php artisan test    (or vendor/bin/pest)
  # TS:     pnpm test
  # Python: pytest
  # Go:     go test ./...
  # Rust:   cargo test
  ```

  ```bash
  # 5. Complete the merge/rebase
  git add .
  # Don't commit — let the user decide when to commit
  ```
  ```

- [ ] **Edit L159** (Do NOT — verification line). Find: `- Do NOT skip verification (PHPStan + tests) after resolving.`
  Replace with: `- Do NOT skip verification (project type-checker + tests) after resolving.`



### Step 2.4: `.agent-src.uncompressed/skills/project-analyzer/SKILL.md` (15 hits)

**Why**: `Detection checklist` (L172–214) prioritises PHP/Laravel as the default and lists Node.js / TypeScript / Python / Go / Rust as afterthoughts. `Project type`, `Legacy indicators`, and `Build & tooling` tables are PHP-only. A generic "scan this project" skill cannot return a useful first-pass for a Next.js or FastAPI repo today.

- [ ] **Edit L174** (sub-section header). Find: `### Framework & language`
  Replace with: `### Framework & language (multi-stack)`

- [ ] **Edit L176–L183** — replace the `Framework & language` table. Find:
  ```
  | Check                 | How to detect                                 |
  |-----------------------|-----------------------------------------------|
  | PHP version           | `composer.json` → `require.php`               |
  | Laravel version       | `composer.json` → `require.laravel/framework` |
  | Laravel or standalone | `artisan` file exists → Laravel               |
  | Node.js               | `package.json` exists                         |
  | Frontend framework    | `package.json` → Vue, React, etc.             |
  | TypeScript            | `tsconfig.json` exists                        |
  ```
  Replace with:
  ```
  | Check                  | How to detect                                                                |
  |------------------------|------------------------------------------------------------------------------|
  | PHP runtime + version  | `composer.json` → `require.php`                                              |
  | Laravel application    | `artisan` file at repo root + `laravel/framework` in `composer.json`         |
  | Symfony application    | `bin/console` + `symfony/framework-bundle` in `composer.json`                |
  | Composer package       | `composer.json` without `artisan` / `bin/console`                            |
  | Node.js runtime        | `package.json` exists                                                        |
  | TypeScript             | `tsconfig.json` exists                                                       |
  | Frontend framework     | `package.json` → `react`, `vue`, `svelte`, `solid`, `astro`, `@angular/core` |
  | Meta-framework         | `package.json` → `next`, `nuxt`, `remix`, `sveltekit`, `astro`               |
  | Python runtime         | `pyproject.toml`, `requirements.txt`, `setup.py`, or `Pipfile`               |
  | Python framework       | `pyproject.toml` / `requirements.txt` → `django`, `fastapi`, `flask`         |
  | Go module              | `go.mod` exists                                                              |
  | Rust crate / workspace | `Cargo.toml` exists                                                          |
  | Ruby app               | `Gemfile` → `rails`, `sinatra`                                               |
  | .NET project           | `*.csproj`, `*.fsproj`, or `global.json`                                     |
  | Java / Kotlin          | `pom.xml`, `build.gradle`, or `build.gradle.kts`                             |

  After detecting **any** match, record the stack in the analysis output and select the matching `project-analysis-*` sub-skill (Laravel, Symfony, Next.js, React, Node/Express, Zend/Laminas) — fall back to `project-analysis-core` if no framework-specific sub-skill applies.
  ```

- [ ] **Edit L185–L192** — replace the `Project type` table. Find:
  ```
  ### Project type

  | Signal                             | Type                           |
  |------------------------------------|--------------------------------|
  | `artisan` + `laravel/framework`    | Laravel application            |
  | `composer.json` without `artisan`  | Composer package or legacy PHP |
  | Module system (`app/Modules/`)     | Modular Laravel                |
  | Multi-tenant (`customer_database`) | Multi-tenant SaaS              |
  ```
  Replace with:
  ```
  ### Project type

  | Signal                                                                | Type                                  |
  |-----------------------------------------------------------------------|---------------------------------------|
  | `artisan` + `laravel/framework`                                       | Laravel application                   |
  | `bin/console` + `symfony/framework-bundle`                            | Symfony application                   |
  | `composer.json` without `artisan` / `bin/console`                     | Composer package or legacy PHP        |
  | `package.json` with `next` / `nuxt` / `remix` / `sveltekit` / `astro` | Meta-framework SSR/SSG app            |
  | `package.json` with `express` / `fastify` / `koa` / `hapi`            | Node HTTP service                     |
  | `package.json` with `@nestjs/core`                                    | NestJS application                    |
  | `pyproject.toml` with `django` / `fastapi` / `flask`                  | Python web app                        |
  | `go.mod` with `gin-gonic/gin` / `labstack/echo` / `gofiber/fiber`     | Go HTTP service                       |
  | Module system (`app/Modules/`, `src/modules/`, `packages/*`)          | Modular monolith / monorepo           |
  | Multi-tenant signal (`customer_database`, tenant middleware, `RLS`)   | Multi-tenant SaaS                     |
  | `apps/*` + `packages/*` + `turbo.json` / `nx.json` / `pnpm-workspace` | Monorepo                              |
  ```

- [ ] **Edit L194–L203** — replace the `Legacy indicators` table. Find:
  ```
  ### Legacy indicators

  | Signal                                     | Meaning                   |
  |--------------------------------------------|---------------------------|
  | No `declare(strict_types=1)` in most files | Legacy codebase           |
  | No typed properties / return types         | Legacy PHP (< 7.4)        |
  | `var_dump()` / `print_r()` in code         | Legacy debugging patterns |
  | No tests or very few tests                 | Low test coverage         |
  | No PHPStan / Rector config                 | No static analysis        |
  | Mixed naming conventions                   | Inconsistent standards    |
  ```
  Replace with:
  ```
  ### Legacy indicators (stack-aware)

  | Signal                                                                       | Meaning                       |
  |------------------------------------------------------------------------------|-------------------------------|
  | PHP: no `declare(strict_types=1)` in most files                              | Pre-modern PHP style          |
  | PHP: no typed properties / return types                                      | Legacy PHP (< 7.4)            |
  | PHP: no `phpstan.neon` / `rector.php`                                        | No static analysis            |
  | TS: `// @ts-ignore` / `// @ts-nocheck` density; `any` widespread             | Untyped TypeScript            |
  | TS: no `tsconfig.json` `strict: true`                                        | Loose TypeScript              |
  | JS: no ESLint config or `eslint.config.*`                                    | No linting                    |
  | Python: no type hints in most signatures; no `py.typed`                      | Untyped Python                |
  | Python: no `mypy.ini` / `pyrightconfig.json` / `ruff.toml`                   | No static analysis            |
  | Go: no `golangci.yml`                                                        | No lint pipeline              |
  | Rust: no `clippy.toml` and warnings ignored                                  | No lint hygiene               |
  | `var_dump()` / `console.log()` / `print()` / `fmt.Println()` left in code   | Legacy debugging patterns     |
  | No tests or very few tests                                                   | Low test coverage             |
  | Mixed naming conventions across the same module                              | Inconsistent standards        |
  ```

- [ ] **Edit L205–L214** — replace the `Build & tooling` table. Find:
  ```
  ### Build & tooling

  | Check         | How to detect                                             |
  |---------------|-----------------------------------------------------------|
  | Task runner   | `Makefile` or `Taskfile.yml`                              |
  | Docker        | `docker-compose.yml` or `compose.yaml`                    |
  | CI/CD         | `.github/workflows/`                                      |
  | Quality tools | `phpstan.neon`, `ecs.php`, `rector.php`, or `config-dev/` |
  | Editor config | `.editorconfig`                                           |
  | Code review   | `CODEOWNERS`, PR templates                                |
  ```
  Replace with:
  ```
  ### Build & tooling (stack-agnostic)

  | Check         | How to detect                                                                                                                                                       |
  |---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
  | Task runner   | `Makefile`, `Taskfile.yml`, `justfile`, `package.json scripts`, `composer.json scripts`                                                                             |
  | Docker        | `docker-compose.yml`, `compose.yaml`, `Dockerfile`                                                                                                                  |
  | CI/CD         | `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`, `azure-pipelines.yml`                                                                               |
  | Quality tools | PHP: `phpstan.neon`, `ecs.php`, `rector.php`. TS/JS: `eslint.config.*`, `.prettierrc*`, `tsconfig.json`. Python: `ruff.toml`, `mypy.ini`. Go: `.golangci.yml`. Rust: `clippy.toml` |
  | Editor config | `.editorconfig`                                                                                                                                                     |
  | Code review   | `CODEOWNERS`, PR templates (`.github/pull_request_template.md`)                                                                                                     |
  | Dependencies  | Lockfile presence: `composer.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `go.sum`, `Cargo.lock`                            |
  ```


### Step 2.5: `.agent-src.uncompressed/skills/test-driven-development/SKILL.md` (11 hits)

**Why**: Step 3 (L104–L110) already shows PHP/Pest **and** JS/Vitest in parallel — that's correct. The `## Examples` section (L173–L235), however, only shows PHP/Pest. Add a parallel TypeScript/Vitest worked example so neither stack is privileged. The `See also` block at L273–L275 names Pest as the "full conventions" link without a TypeScript peer.

- [ ] **Edit L175** (Examples sub-header). Find: `### PHP / Pest`
  Replace with: `### Example A — PHP / Pest`

- [ ] **Insert AFTER the closing fence of the PHP example block** (search for the last `}\n```` inside the `### Example A — PHP / Pest` section, then insert directly after it). Add a parallel TypeScript example:
  ```

  ### Example B — TypeScript / Vitest

  ```ts
  // src/email-validator.test.ts — RED
  import { describe, it, expect } from 'vitest';
  import { EmailValidator } from './email-validator';

  describe('EmailValidator', () => {
    it('rejects empty email', () => {
      const result = new EmailValidator().validate('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email required');
    });
  });
  ```

  Run: `npx vitest run --testNamePattern 'rejects empty email'` → fails
  (`EmailValidator` does not exist yet, or returns `{ isValid: true }`).

  ```ts
  // src/email-validator.ts — GREEN (minimum)
  export class EmailValidator {
    validate(email: string): { isValid: boolean; error?: string } {
      if (email.trim() === '') {
        return { isValid: false, error: 'Email required' };
      }
      return { isValid: true };
    }
  }
  ```

  Re-run → passes. No additional behaviour added (no `@` check, no length cap) — those need their own failing tests first.
  ```

- [ ] **Edit L273–L275** (See also block). Find:
  ```
  * Quality tools, PHPStan, ECS, Rector → [`quality-tools`](../quality-tools/SKILL.md)
  * Full Pest conventions, Laravel testing helpers → [`pest-testing`](../pest-testing/SKILL.md)
  * Running tests inside Docker → [`tests-execute`](../tests-execute/SKILL.md)
  ```
  Replace with:
  ```
  * Project type-checker / linter / formatter (PHPStan, ECS, Rector for PHP — tsc / eslint / prettier for TS — ruff / mypy for Python) → [`quality-tools`](../quality-tools/SKILL.md)
  * Full Pest conventions and Laravel test helpers → [`pest-testing`](../pest-testing/SKILL.md)
  * Running tests inside Docker → [`tests-execute`](../tests-execute/SKILL.md)
  ```

### Step 2.6: `.agent-src.uncompressed/skills/rtk-output-filtering/SKILL.md` (8 hits)

**Why**: L156–L159 declare custom filters are "for the project's PHP/Laravel toolchain" and the covered list (PHPStan, Pest, ECS, Rector, Artisan, Composer) is PHP-only. A Next.js / Python / Go project gets no guidance.

- [ ] **Edit L156–L159** — replace the "Custom filters" block. Find:
  ```
  Custom filters for the project's PHP/Laravel toolchain live in `.rtk/filters.toml`
  (project root, versioned in Git). These override global filters for matching commands.

  Covered: PHPStan, Pest, ECS, Rector, Docker Compose, Artisan, Composer.
  ```
  Replace with:
  ```
  Project-local custom filters live in `.rtk/filters.toml` (project root, versioned in Git). These override global filters for matching commands. Add entries for whatever tools the project actually runs.

  Coverage shipped with this package (extend per project):
  - PHP / Laravel: PHPStan, Pest, PHPUnit, ECS, Rector, Composer, Artisan
  - JS / TS: tsc, eslint, prettier, vitest, jest, playwright, pnpm/npm/yarn install + run
  - Python: ruff, mypy, pyright, pytest, pip / poetry / uv
  - Go: `go test`, `go build`, `go vet`, `golangci-lint`
  - Rust: `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt`
  - Infra / runtime: Docker Compose, Terraform, kubectl
  ```

### Step 2.7: `.agent-src.uncompressed/skills/file-editor/SKILL.md` (7 hits)

**Why**: Generic skill that opens edited files in the user's IDE, but every example pins PhpStorm + `app/Models/User.php`. A TypeScript developer in WebStorm or VS Code learns nothing useful. The `personal.ide` value enum at L43 lists only `code` and `phpstorm`.

- [ ] **Edit L43** (settings table — accepted values row). Find: `| `personal.ide` | `code`, `phpstorm` | _(empty)_ | CLI command to open files |`
  Replace with: `| `personal.ide` | `code`, `cursor`, `windsurf`, `phpstorm`, `webstorm`, `idea`, `goland`, `rubymine`, `pycharm`, `rider`, `subl`, `vim`, `nvim`, `emacs`, `zed` | _(empty)_ | CLI command to open files |`

- [ ] **Edit L65–L68** — replace the single-IDE example. Find:
  ```
  **PhpStorm** (`personal.ide: phpstorm`):
  ```bash
  phpstorm --line {line} {file}
  ```
  ```
  Replace with:
  ```
  **JetBrains IDEs** (`personal.ide: phpstorm` / `webstorm` / `idea` / `pycharm` / `goland` / `rubymine` / `rider`):
  ```bash
  phpstorm --line {line} {file}        # PHP
  webstorm --line {line} {file}        # JS / TS
  idea     --line {line} {file}        # Java / Kotlin / general
  pycharm  --line {line} {file}        # Python
  goland   --line {line} {file}        # Go
  ```

  **VS Code-family** (`personal.ide: code` / `cursor` / `windsurf`):
  ```bash
  code    --goto {file}:{line}
  cursor  --goto {file}:{line}
  windsurf --goto {file}:{line}
  ```

  **Zed** (`personal.ide: zed`):
  ```bash
  zed {file}:{line}
  ```

  **Terminal editors** (`personal.ide: vim` / `nvim` / `emacs`):
  ```bash
  vim  +{line} {file}
  nvim +{line} {file}
  emacs +{line} {file}
  ```
  ```

- [ ] **Edit L76–L89** — replace the worked example block. Find the block that starts with `# PhpStorm` and ends with `code app/Models/User.php`. Replace the whole block with stack-neutral examples:
  ```bash
  # JetBrains (PhpStorm / WebStorm / GoLand / PyCharm)
  phpstorm --line 42 src/Services/UserService.php
  webstorm --line 15 src/services/user-service.ts
  goland   --line 27 internal/user/service.go
  pycharm  --line 88 app/services/user_service.py

  # VS Code-family
  code     --goto src/services/user-service.ts:15
  cursor   --goto app/services/user_service.py:88

  # Open file without jumping to a line
  code     src/services/user-service.ts
  phpstorm src/Services/UserService.php
  ```

- [ ] **Edit L105–L106** (Common commands table — extend rows). Find:
  ```
  | VS Code | `code {file}` | Shell Command: Install 'code' in PATH |
  | PhpStorm | `phpstorm {file}` | JetBrains Toolbox CLI or `Create command-line launcher` in PhpStorm |
  ```
  Replace with:
  ```
  | VS Code         | `code {file}`     | Shell Command: Install 'code' in PATH                                        |
  | Cursor          | `cursor {file}`   | Settings → "Install 'cursor' shell command"                                  |
  | Windsurf        | `windsurf {file}` | Settings → "Install 'windsurf' shell command"                                |
  | Zed             | `zed {file}`      | Settings → "Install CLI" (creates `zed` in PATH)                             |
  | PhpStorm        | `phpstorm {file}` | JetBrains Toolbox CLI or *Tools → Create command-line launcher* in PhpStorm  |
  | WebStorm        | `webstorm {file}` | JetBrains Toolbox CLI or *Tools → Create command-line launcher* in WebStorm  |
  | IntelliJ IDEA   | `idea {file}`     | JetBrains Toolbox CLI or *Tools → Create command-line launcher* in IDEA      |
  | PyCharm         | `pycharm {file}`  | JetBrains Toolbox CLI or *Tools → Create command-line launcher* in PyCharm   |
  | GoLand          | `goland {file}`   | JetBrains Toolbox CLI or *Tools → Create command-line launcher* in GoLand    |
  | Vim / Neovim    | `vim {file}` / `nvim {file}` | Bundled with most distros                                         |
  ```

- [ ] **Edit L124–L125** (Pitfalls). Find:
  ```
  - Don't open files during batch operations (e.g., fixing 20 PHPStan errors) — only open when specifically relevant.
  - PHPStorm sometimes locks files when opening — wait briefly before editing the same file.
  ```
  Replace with:
  ```
  - Don't open files during batch operations (e.g., fixing 20 type-checker errors across PHPStan / tsc / mypy / `cargo check`) — only open when specifically relevant.
  - JetBrains IDEs (PhpStorm, WebStorm, IDEA, PyCharm, GoLand, RubyMine, Rider) sometimes briefly lock a file on open — wait a moment before editing the same file.
  ```

### Step 2.8: `.agent-src.uncompressed/skills/readme-writing-package/SKILL.md` (8 hits)

**Why**: A "package README writer" must work for npm packages, PyPI packages, Cargo crates, Go modules, and Composer packages alike. The current Examples (L91–L107) lock to `composer require` + `php artisan vendor:publish` — a Node, Python, Go, or Rust author can't reuse anything below the header.

- [ ] **Edit L56** (Sources — first bullet). Find: `- `composer.json` / `package.json` — name, description, requirements, scripts`
  Replace with: `- Manifest: `composer.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or `*.gemspec` — name, description, requirements, scripts`

- [ ] **Edit L91–L107** — replace the Requirements + Installation example block. Find:
  ```
  - PHP ^8.2
  - Laravel 11.x
  - ext-json
  ```
  …and the install block:
  ```
  ```bash
  composer require vendor/package

  # If framework integration needed:
  php artisan vendor:publish --tag=package-config
  ```
  ```
  Replace with stack-grouped examples:
  ```
  Pick the row that matches the package's ecosystem; show only that one in the rendered README:

  **PHP / Composer**
  - Requirements: `PHP ^8.2`, `Laravel 11.x`, `ext-json`
  ```bash
  composer require vendor/package
  # If framework integration needed:
  php artisan vendor:publish --tag=package-config
  ```

  **JavaScript / TypeScript**
  - Requirements: `Node 20+`, `TypeScript 5+` (peer)
  ```bash
  npm install @vendor/package
  # or
  pnpm add @vendor/package
  yarn add @vendor/package
  ```

  **Python**
  - Requirements: `Python >=3.11`
  ```bash
  pip install vendor-package
  # or
  poetry add vendor-package
  uv add vendor-package
  ```

  **Go**
  - Requirements: `Go >=1.22`
  ```bash
  go get example.com/vendor/package@latest
  ```

  **Rust / Cargo**
  - Requirements: `Rust >=1.75`
  ```bash
  cargo add vendor_package
  ```

  **Ruby**
  ```bash
  bundle add vendor-package
  ```
  ```

- [ ] **Edit L178** (Checklist row — compatibility). Find: `- [ ] Compatibility/requirements match `composer.json` / `package.json` / CI matrix`
  Replace with: `- [ ] Compatibility / requirements match the package manifest (`composer.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.gemspec`) and the CI matrix`

- [ ] **Edit L201–L203** (Pitfalls). Find:
  ```
  - Model over-explains internals before showing how to use the package
  - Existing README may be outdated — verify against actual `composer.json` / source, not old text
  - Model forgets post-install steps (config publish, service provider, env vars)
  ```
  Replace with:
  ```
  - Model over-explains internals before showing how to use the package
  - Existing README may be outdated — verify against the actual manifest (`composer.json` / `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`) and source, not against the old README prose
  - Model forgets post-install steps — pick from: config publish, service provider registration (PHP); peer-dependency install, `postinstall` script (JS/TS); env-var setup; CLI binary linking; codegen step
  ```



---

## Phase 3 — Generic Commands (PHP/Laravel as default → multi-stack dispatch)

**Scope**: Commands that any project can invoke (`/quality-fix`, `/optimize:rtk`, `/package-test`, `/optimize:augmentignore`) currently hardcode the PHP toolchain — PHPStan / Rector / ECS / Composer / Artisan — and treat npm / TS / Python / Go as a footnote. The remediation pattern is consistent: detect the project manifest first, dispatch to the matching toolchain, and fall back to a generic "run the project's quality script" instruction when no manifest matches a known recipe.

**Verification per step**: `task sync && task lint-skills` must stay green (commands compile, frontmatter intact). The router does not auto-load commands, so no `task ci` re-run is forced — but the slash-command-suggestion catalog (`docs/contracts/slash-command-suggestion-policy.md`) should still list every edited command unchanged.

### Step 3.1: `.agent-src.uncompressed/commands/quality-fix.md` (22 hits)

**Why**: This command is the central "fix everything the linters / type-checkers find" entry point. Its current body assumes PHPStan + Rector + ECS only. The `trigger_description` (L9) and `trigger_context` (L10) name PHPStan explicitly, the detection block (L36–L40) only enumerates PHP recipes, and Steps 1–3 (L42–L63) are a PHPStan/Rector loop. A TypeScript or Python project invoking `/quality-fix` today receives no actionable instructions.

- [ ] **Edit L9** (frontmatter trigger_description). Find: `  trigger_description: "fix the quality errors, run PHPStan and fix issues, fix code style"`
  Replace with: `  trigger_description: "fix the quality errors — run the project's type-checker / linter / formatter and resolve every issue (PHPStan / tsc / mypy / golangci-lint / clippy / …)"`

- [ ] **Edit L10** (frontmatter trigger_context). Find: `  trigger_context: "PHPStan/Rector/ECS output in recent tool results"`
  Replace with: `  trigger_context: "type-checker / linter / formatter output in recent tool results (PHPStan, Rector, ECS, tsc, eslint, prettier, ruff, mypy, golangci-lint, clippy)"`

- [ ] **Edit L36–L40** — replace the detection block. Find:
  ```
  - Detect the project type:
    - Project ships a `quality:*` wrapper (Artisan or Composer script) → prefer `php artisan quality:phpstan` / `php artisan quality:rector --fix`
    - `phpstan/phpstan` installed → `vendor/bin/phpstan analyse`
    - `rector/rector` installed → `vendor/bin/rector process`
    - `symplify/easy-coding-standard` installed → `vendor/bin/ecs check --fix`
  ```
  Replace with:
  ```
  - Detect the project's quality toolchain **before** doing anything else. Pick the first match:
    1. Project ships a wrapper script — prefer the wrapper over invoking tools directly:
       - PHP: `php artisan quality:*` (Laravel), `composer run quality`, `composer run lint`
       - JS / TS: `npm run lint`, `npm run typecheck`, `pnpm lint`, `pnpm typecheck`, `yarn lint`, `yarn typecheck`
       - Python: `make lint`, `task lint`, `nox -s lint`, `tox -e lint`
       - Polyglot: `Taskfile.yml`, `Makefile`, or `justfile` with a `quality` / `lint` / `check` target
    2. No wrapper — invoke tools directly based on which are installed:
       - PHP: `vendor/bin/phpstan analyse`, `vendor/bin/rector process`, `vendor/bin/ecs check --fix`
       - JS / TS: `npx tsc --noEmit`, `npx eslint . --fix`, `npx prettier . --write`, `npx biome check --apply`
       - Python: `ruff check . --fix`, `ruff format .`, `mypy .`, `pyright`
       - Go: `golangci-lint run --fix`, `go vet ./...`, `gofmt -w .`
       - Rust: `cargo clippy --fix --allow-dirty`, `cargo fmt`
    3. Nothing detected → ask the user which command runs the project's quality pipeline. Do not invent one.
  ```

- [ ] **Edit L42–L49** — generalise Step 1. Find:
  ```
  ### Step 1: PHPStan — fix all errors

  1. Run PHPStan and capture the full output.
  2. For each error, **fix it in code**. Resolve the root cause.
  3. **Do NOT add errors to the baseline or phpstan.neon ignore lists.**
  4. If truly impossible (confirmed false positive), use inline ignore with reason.
  5. After fixing, run PHPStan again.
  6. Repeat until **0 errors**.
  ```
  Replace with:
  ```
  ### Step 1: Type-checker — fix all errors

  Run the project's type-checker (chosen in the detection step):
  - PHP → PHPStan
  - JS / TS → `tsc --noEmit`
  - Python → mypy / pyright
  - Go → `go vet` + `go build`
  - Rust → `cargo check`

  1. Run the type-checker and capture the full output.
  2. For each error, **fix it in code**. Resolve the root cause.
  3. **Do NOT add errors to the baseline or ignore list** (`phpstan-baseline.neon`, `tsconfig.json` `exclude`, `# type: ignore`, `// @ts-ignore`, `#[allow(...)]`, `//nolint`).
  4. If truly impossible (confirmed false positive), use the language-native inline ignore with a one-line reason: `@phpstan-ignore`, `// @ts-expect-error: <reason>`, `# type: ignore[<code>]  # <reason>`, `//nolint:<linter> // <reason>`, `#[allow(<lint>)] // <reason>`.
  5. After fixing, re-run the type-checker.
  6. Repeat until **0 errors**.
  ```


- [ ] **Edit L51–L56** — generalise Step 2. Find:
  ```
  ### Step 2: Rector — apply automated refactoring

  1. Run Rector with the fix flag.
  2. Review what Rector changed — it may introduce new PHPStan errors.
  3. Run Rector again to verify no further changes are applied.
  4. Repeat until Rector produces no more changes.
  ```
  Replace with:
  ```
  ### Step 2: Auto-fixer / refactoring tool — apply transforms

  Run the project's auto-fixer / refactoring tool (skip the step entirely if the project does not ship one):
  - PHP → `vendor/bin/rector process`
  - JS / TS → `npx eslint . --fix` (rule auto-fixes), `npx biome check --apply-unsafe` (safe transforms only)
  - Python → `ruff check . --fix` (lint auto-fixes), `ruff check . --fix --unsafe-fixes` (broader)
  - Go → `golangci-lint run --fix`, `gofmt -w .`, `goimports -w .`
  - Rust → `cargo clippy --fix --allow-dirty --allow-staged`, `cargo fmt`

  1. Run the auto-fixer with the apply / fix flag.
  2. Review the diff — auto-fixes may introduce new type-checker errors or change semantics on edge cases.
  3. Re-run the auto-fixer to verify it produces no further changes.
  4. Repeat until the auto-fixer is idempotent.
  ```

- [ ] **Edit L58–L63** — generalise Step 3. Find:
  ```
  ### Step 3: Final PHPStan verification

  1. Run PHPStan one more time.
  2. If new errors appeared (e.g. from Rector changes), fix them as in Step 1.
  3. If fixes were needed, go back to Step 2.
  4. Done when PHPStan reports **0 errors** and Rector has **no changes**.
  ```
  Replace with:
  ```
  ### Step 3: Final type-checker verification

  1. Run the type-checker (from Step 1) one more time.
  2. If new errors appeared (e.g. from auto-fixer changes), fix them as in Step 1.
  3. If fixes were needed, go back to Step 2.
  4. Done when the type-checker reports **0 errors** **and** the auto-fixer is idempotent. Also run the formatter once at the very end (`vendor/bin/ecs check --fix` / `prettier --write` / `ruff format` / `cargo fmt`) to normalise whitespace.
  ```

- [ ] **Edit L107–L111** — generalise the Pitfalls block. Find:
  ```
  - **Do NOT commit or push.** Only apply local changes.
  - **Do NOT modify baseline files** (`phpstan-baseline.neon`) or config files (`biome.json`, `tsconfig.json`).
  - **Do NOT add entries to `ignoreErrors`** in `phpstan.neon`.
  - Inline ignores (`@phpstan-ignore`, `@ts-expect-error`, `biome-ignore`) are a last resort.
  - Run `php -l` on modified PHP files if you made significant structural changes.
  ```
  Replace with:
  ```
  - **Do NOT commit or push.** Only apply local changes.
  - **Do NOT modify baseline files** (`phpstan-baseline.neon`, `tsconfig.json` `exclude`, `.mypy.ini` ignore list, `.eslintrc` `ignorePatterns`, `clippy.toml` `allow` list).
  - **Do NOT widen ignore lists** in the config (`ignoreErrors`, `exclude`, `# type: ignore` blanket, `eslint-disable` file-wide).
  - Inline ignores (`@phpstan-ignore`, `@ts-expect-error`, `# type: ignore[code]`, `biome-ignore`, `eslint-disable-next-line`, `//nolint:`, `#[allow(...)]`) are a last resort and must carry a one-line reason.
  - After significant structural changes, run a language-level syntax check (`php -l <file>`, `node --check <file>`, `python -m py_compile <file>`, `go build ./...`, `cargo check`) before claiming the file is fixed.
  ```


### Step 3.2: `.agent-src.uncompressed/commands/optimize/rtk.md` (13 hits)

**Why**: The detection table (L31–L36) and noise-pattern table (L82–L85) already list `package.json` / `playwright` alongside Composer — that's good. But the table is still PHP-first, the priorities recipe (L118–L121) only seeds PHP tools, and the Composer / Pest / ECS / Rector entries dominate. A polyglot project gets PHPStan + Pest filters auto-installed and nothing for tsc / vitest / pytest / cargo.

- [ ] **Edit L30–L36** — extend the "detect installed quality tools" table. Find:
  ```
  | Detection                                                         | Tool                |
  |---|---|
  | `composer.json` contains `phpstan` or `larastan`                  | PHPStan             |
  | `composer.json` contains `pestphp/pest` or `phpunit/phpunit`      | Pest / PHPUnit      |
  | `composer.json` contains `symplify/easy-coding-standard`          | ECS                 |
  | `composer.json` contains `rector/rector`                          | Rector              |
  | `composer.json` contains scripts like `quality:phpstan`           | Artisan quality commands |
  | `package.json` contains `playwright`                              | Playwright          |
  ```
  Replace with:
  ```
  | Detection                                                                                      | Tool                       |
  |------------------------------------------------------------------------------------------------|----------------------------|
  | `composer.json` contains `phpstan` or `larastan`                                               | PHPStan                    |
  | `composer.json` contains `pestphp/pest` or `phpunit/phpunit`                                   | Pest / PHPUnit             |
  | `composer.json` contains `symplify/easy-coding-standard`                                       | ECS                        |
  | `composer.json` contains `rector/rector`                                                       | Rector                     |
  | `composer.json` contains scripts like `quality:phpstan`                                        | Artisan / Composer quality wrappers |
  | `package.json` contains `typescript`                                                            | tsc                        |
  | `package.json` contains `eslint`                                                                | ESLint                     |
  | `package.json` contains `prettier`                                                              | Prettier                   |
  | `package.json` contains `@biomejs/biome`                                                        | Biome                      |
  | `package.json` contains `vitest`                                                                | Vitest                     |
  | `package.json` contains `jest`                                                                  | Jest                       |
  | `package.json` contains `playwright` / `@playwright/test`                                       | Playwright                 |
  | `pyproject.toml` / `requirements*.txt` contains `ruff`                                          | Ruff                       |
  | `pyproject.toml` / `requirements*.txt` contains `mypy` / `pyright`                              | mypy / Pyright             |
  | `pyproject.toml` / `requirements*.txt` contains `pytest`                                        | pytest                     |
  | `.golangci.yml` exists OR `golangci-lint` in `go.mod` tool dependencies                         | golangci-lint              |
  | `go.mod` exists                                                                                 | `go test` / `go vet`       |
  | `Cargo.toml` exists                                                                             | cargo (build / test / clippy / fmt) |
  | `Gemfile` contains `rubocop` / `standard`                                                       | RuboCop / Standard         |
  ```

- [ ] **Edit L81–L86** — extend the "common noise patterns" table. Find:
  ```
  |---|---|
  | PHPStan       | Progress bars (`\d+/\d+`), separator lines (`━`), notes              |
  | Pest/PHPUnit  | Empty lines, box-drawing chars (`│`, `⇂`)                            |
  | ECS/Rector    | Separator lines, empty lines                                         |
  | Composer      | Download progress, "Loading composer"                                |
  | Docker Compose| Build context lines, pull progress                                   |
  ```
  Replace with:
  ```
  |----------------|------------------------------------------------------------------------------|
  | PHPStan        | Progress bars (`\d+/\d+`), separator lines (`━`), notes                      |
  | Pest / PHPUnit | Empty lines, box-drawing chars (`│`, `⇂`)                                    |
  | ECS / Rector   | Separator lines, empty lines                                                 |
  | Composer       | Download progress, "Loading composer"                                        |
  | tsc            | Progress dots, repeated cache-hit notes, watch-mode banners                  |
  | ESLint         | Numeric prefix per line (`123:45`), summary divider, `0 errors / 0 warnings` |
  | Prettier       | File-list output when only formatting (`✔ src/foo.ts`)                       |
  | Vitest / Jest  | Spinner frames, watch banner, coverage summary table when not requested      |
  | Playwright     | Browser launch banner, retry notices, trace-file paths repeated per run      |
  | Ruff           | Progress (`Checking N files`), repeated file headers in `--watch`            |
  | mypy / Pyright | `Daemon running` banners, success summary repeated per file                  |
  | golangci-lint  | Progress (`linters`), divider lines between linters                          |
  | `go test`      | `=== RUN` / `--- PASS` per sub-test (suppress in passing runs)               |
  | Cargo          | `   Compiling …` lines for dependencies, `Finished release` banner            |
  | Docker Compose | Build-context lines, pull progress                                            |
  ```

- [ ] **Edit L117–L121** — extend the "priorities recipe" example. Find:
  ```
  |---|---|---|---|
  | 1   | phpstan    | phpstan\|quality:phpstan\|vendor/bin/phpstan | 80 |
  | 2   | pest       | pest\|phpunit\|artisan test                  | 60 |
  | ... | ...        | ...                                          | ...|
  ```
  Replace with:
  ```
  |-----|--------------|---------------------------------------------------------------|------|
  | 1   | phpstan      | phpstan\|quality:phpstan\|vendor/bin/phpstan                 | 80   |
  | 2   | pest         | pest\|phpunit\|artisan test                                  | 60   |
  | 3   | tsc          | tsc\|tsc --noEmit                                            | 60   |
  | 4   | eslint       | eslint\|next lint                                            | 50   |
  | 5   | vitest       | vitest\|jest                                                 | 50   |
  | 6   | playwright   | playwright\|@playwright/test                                 | 40   |
  | 7   | ruff         | ruff check\|ruff format                                      | 60   |
  | 8   | mypy         | mypy\|pyright                                                | 50   |
  | 9   | pytest       | pytest\|python -m pytest                                     | 50   |
  | 10  | golangci     | golangci-lint\|go vet                                        | 50   |
  | 11  | gotest       | go test                                                       | 40   |
  | 12  | cargo        | cargo build\|cargo check\|cargo clippy\|cargo test\|cargo fmt| 50   |
  | ... | ...          | (add per project as the toolchain grows)                     | ...  |
  ```


### Step 3.3: `.agent-src.uncompressed/commands/package-test.md` (18 hits)

**Why**: The command already supports **both** Composer and npm in parallel — that's correct structurally. The leakage is narrower: the flow has no path for Python (editable installs via `pip install -e .` / `uv pip install -e .` / `poetry add --editable`), Go (`go mod edit -replace`), Rust (`cargo add --path`), or Ruby (`bundle config local.<gem>`). For a TypeScript-only or Python-only project the existing 2-way branch works; for a Go / Rust / Python contributor invoking `/package-test`, the command currently exits with "no composer.json or package.json found" even though their ecosystem has a perfectly good local-link mechanism.

This step adds ecosystems as opt-in rows rather than rewriting the dual Composer/npm path, which already works.

- [ ] **Edit L4** (frontmatter skills array). Find: `skills: [composer, npm]`
  Replace with: `skills: [composer, npm, python-packages, go-modules, cargo-packages]`
  Note: `python-packages`, `go-modules`, and `cargo-packages` skills do not exist yet. If they are missing at sync time, leave the entry but flag with a comment so the lint pass can re-route to a generic `package-management` skill instead. **Do not** create empty skill stubs as part of this roadmap.

- [ ] **Edit L19–L20** (Detection paragraph). Find: `Check the project root for `composer.json` and `package.json`.`
  Replace with: `Check the project root for a package manifest. Supported (try in this order, take the first match — the project can have several):`
  Then **immediately after that sentence** insert a manifest table:
  ```

  | Manifest                                                          | Ecosystem        | Link mechanism                                           |
  |-------------------------------------------------------------------|------------------|----------------------------------------------------------|
  | `composer.json`                                                   | PHP / Composer   | `repositories[].type: path` + `composer require @dev`    |
  | `package.json`                                                    | JS / TS / Node   | `npm link` / `pnpm link` / `yarn link` / `file:../path`  |
  | `pyproject.toml`, `setup.py`, or `setup.cfg`                      | Python           | `pip install -e <path>` / `uv pip install -e <path>` / `poetry add --editable <path>` |
  | `go.mod`                                                          | Go               | `go mod edit -replace example.com/pkg=<path>`            |
  | `Cargo.toml`                                                      | Rust             | `cargo add --path <path>` or `[patch.crates-io]` block   |
  | `Gemfile`                                                         | Ruby             | `bundle config local.<gem> <path>`                       |
  ```

- [ ] **Edit L26–L27** (Multiple-manifests numbered list). Find:
  ```
  1. Composer (PHP)
  2. npm (JavaScript/TypeScript)
  ```
  Replace with:
  ```
  1. Composer (PHP)
  2. npm / pnpm / yarn (JavaScript / TypeScript)
  3. Python (pip / poetry / uv)
  4. Go modules
  5. Cargo (Rust)
  6. Bundler (Ruby)
  ```

- [ ] **Edit L40** (no-manifest error message). Find: `❌  No composer.json or package.json found in project root. Cannot link a local package.`
  Replace with: `❌  No supported package manifest (composer.json / package.json / pyproject.toml / setup.py / go.mod / Cargo.toml / Gemfile) found in project root. Cannot link a local package.`

- [ ] **Edit L52–L55** (path-validation block). Find:
  ```
  Validate:
  - Path exists and is a directory
  - For Composer: directory contains `composer.json`
  - For npm: directory contains `package.json`
  ```
  Replace with:
  ```
  Validate:
  - Path exists and is a directory
  - The directory contains a manifest matching the ecosystem chosen in the detection step (`composer.json`, `package.json`, `pyproject.toml` / `setup.py`, `go.mod`, `Cargo.toml`, or `Gemfile`)
  - If the directory has multiple manifests, ask the user which one to link (rare but possible — e.g. a Composer package that also ships a JS bundle)
  ```

- [ ] **Edit L61–L62** (read-name block). Find:
  ```
  - **Composer:** Read `name` from the package's `composer.json`
  - **npm:** Read `name` from the package's `package.json`
  ```
  Replace with:
  ```
  - **Composer:** Read `name` from the package's `composer.json` (e.g. `vendor/package`)
  - **npm / pnpm / yarn:** Read `name` from the package's `package.json` (e.g. `@scope/package`)
  - **Python:** Read `[project].name` from `pyproject.toml`, or `setup(name=...)` from `setup.py`
  - **Go:** Read `module` from `go.mod` (e.g. `example.com/vendor/package`)
  - **Rust:** Read `[package].name` from `Cargo.toml`
  - **Ruby:** Read the gem name from the `*.gemspec` file in the package directory
  ```

- [ ] **Insert AFTER L101** (after the npm `npm update` block — append three new sub-sections for the additional ecosystems):
  ```

  #### Python

  Editable install (preferred):
  ```bash
  pip install -e {package-path}
  # or, if the project uses uv:
  uv pip install -e {package-path}
  # or, if the project uses poetry:
  cd {project-root} && poetry add --editable {package-path}
  ```

  Re-sync after upstream changes:
  ```bash
  pip install -e {package-path} --force-reinstall --no-deps
  ```

  #### Go

  Edit `go.mod` in the **project** root to add a `replace` directive:
  ```
  replace example.com/vendor/package => ../my-package
  ```
  Then run `go mod tidy` so the lockfile picks up the local path. Remove the `replace` line before publishing.

  #### Rust / Cargo

  Add as a path dependency in the **project's** `Cargo.toml`:
  ```toml
  [dependencies]
  vendor_package = { path = "../my-package" }
  ```
  Or, to override a published crate without rewriting the dependency line, use `[patch.crates-io]`:
  ```toml
  [patch.crates-io]
  vendor_package = { path = "../my-package" }
  ```
  Run `cargo build` to re-resolve.

  #### Ruby / Bundler

  ```bash
  bundle config local.{gem-name} {package-path}
  bundle install
  ```
  Remove with `bundle config --delete local.{gem-name}`.
  ```

- [ ] **Edit L123–L124** (verification block). Find:
  ```
  - **Composer:** Check that `vendor/{package-name}` is a symlink → the local path
  - **npm:** Check that `node_modules/{package-name}` is a symlink → the local path
  ```
  Replace with:
  ```
  - **Composer:** Check that `vendor/{package-name}` is a symlink → the local path
  - **npm / pnpm / yarn:** Check that `node_modules/{package-name}` is a symlink → the local path
  - **Python:** `pip show {package-name}` → `Location` should point inside `{package-path}` (editable installs show the source dir, not site-packages)
  - **Go:** `go list -m {module-path}` → resolved path should match the `replace` target
  - **Rust:** `cargo metadata --format-version 1 | jq '.packages[] | select(.name=="{package-name}") | .manifest_path'` → should point inside `{package-path}`
  - **Ruby:** `bundle config get local.{gem-name}` → should return the linked path
  ```


### Step 3.4: `.agent-src.uncompressed/commands/optimize/augmentignore.md` (16 hits)

**Why**: The stack-detection table (L26–L39) already covers composer / npm / cargo / go correctly. The leakage sits in three places: (a) the **default Laravel-storage rows** (L34, L36, L65) treat Laravel paths as universal even though most consumer projects are not Laravel; (b) the **whitelist-own-packages step** (L89–L97) only reads `composer.json`; (c) the **stack-source step** (L114–L116) only reads `composer.json` + `package.json`. The fix is to (a) gate Laravel rows behind a Laravel detection, (b) extend the whitelist step to npm scopes / Go module prefixes / Python namespace packages, (c) extend the stack source to all major manifests.

- [ ] **Edit L34** — gate IDE-helper row behind detection. Find: `` | `_ide_helper.php` exists | `_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php` | ``
  Replace with: `` | `_ide_helper.php` exists (Laravel `barryvdh/laravel-ide-helper`) | `_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php` | ``
  (No behavioural change — just makes the trigger explicit so an agent in a non-Laravel project does not chase a missing file.)

- [ ] **Edit L36** — gate Laravel-storage row. Find: `` | `storage/` exists (Laravel) | `storage/logs/`, `storage/framework/cache/`, `storage/framework/sessions/`, `storage/framework/views/` | ``
  Replace with: `` | `storage/` exists AND `artisan` exists (Laravel) | `storage/logs/`, `storage/framework/cache/`, `storage/framework/sessions/`, `storage/framework/views/` | ``
  Rationale: many non-Laravel projects have a `storage/` directory with very different semantics (user uploads, persisted state). Requiring `artisan` co-presence is the cheapest reliable Laravel-detection signal.

- [ ] **Insert AFTER L39** — extend the detection table with non-PHP rows. Insert these rows:
  ```
  | `pyproject.toml` exists | `__pycache__/`, `*.pyc`, `*.pyo`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.tox/`, `.nox/`, `dist/`, `build/`, `*.egg-info/` |
  | `Pipfile` or `Pipfile.lock` exists | `Pipfile.lock` |
  | `poetry.lock` exists | `poetry.lock` |
  | `Cargo.toml` exists | `target/`, `Cargo.lock` (binaries only — keep for libraries) |
  | `go.mod` exists | `go.sum`, `vendor/` (if `go mod vendor` is used) |
  | `Gemfile` exists | `.bundle/`, `vendor/bundle/`, `Gemfile.lock` (apps only — keep for gems) |
  | `next.config.js` / `next.config.mjs` / `next.config.ts` exists | `.next/`, `out/` |
  | `nuxt.config.ts` / `nuxt.config.js` exists | `.nuxt/`, `.output/` |
  | `vite.config.*` exists | `dist/`, `.vite/` |
  | `astro.config.*` exists | `.astro/`, `dist/` |
  | `svelte.config.*` exists | `.svelte-kit/`, `build/` |
  | `tsconfig.json` exists | `*.tsbuildinfo`, `.tscache/` |
  | `.terraform/` exists | `.terraform/`, `*.tfstate`, `*.tfstate.backup`, `.terraform.lock.hcl` (debatable — keep if collaborating) |
  ```

- [ ] **Edit L65** — gate the Laravel translation row in the "common ignore candidates" table. Find: `` | `lang/*/validation.php` | Translation files — huge, static, rarely needed | ``
  Replace with:
  ```
  | `lang/*/validation.php` (Laravel) | Translation files — huge, static, rarely needed |
  | `locales/**/*.json` (i18next / next-intl / vue-i18n) | Translation bundles — large, mostly static |
  | `messages/**/*.{json,po,properties}` (gettext / Java-style) | Same reason |
  ```

- [ ] **Edit L89–L97** — generalise the "whitelist own packages" step. Find:
  ```
  ### 6. Whitelist own packages

  Check `composer.json` for the project's own organization namespace:
  - Look at `name` field (e.g., `your-org/project-name` → org is `your-org`)
  - Look at `repositories` for private packages from the same org
  - Add negation pattern: `!vendor/{org}/` to keep own packages in the retrieval index

  This ensures the agent can find code in own packages via `codebase-retrieval`,
  while still excluding the thousands of third-party vendor files.
  ```
  Replace with:
  ```
  ### 6. Whitelist own packages

  Detect the project's own organization namespace from whichever manifest is present.
  Add a negation pattern after the broad ignore so the agent can still index
  first-party packages via `codebase-retrieval`:

  | Manifest         | Where the org lives                                         | Negation pattern                          |
  |------------------|-------------------------------------------------------------|-------------------------------------------|
  | `composer.json`  | `name` (`vendor/pkg`) + `repositories[]` for private repos  | `!vendor/{org}/`                          |
  | `package.json`   | `name` (`@scope/pkg`) — derive `@scope`                     | `!node_modules/@{scope}/`                 |
  | `pyproject.toml` | `[project].name` + `[tool.poetry].repositories`             | `!**/site-packages/{org}*/` (rare — most Python projects don't vendor) |
  | `go.mod`         | `module example.com/{org}/{repo}` — derive `example.com/{org}` | `!vendor/example.com/{org}/` (only if `go mod vendor` is used) |
  | `Cargo.toml`     | `[package].name` / workspace members                        | Not applicable — Cargo does not vendor by default; skip |
  | `Gemfile`        | Git source URLs pointing to the org                         | `!vendor/bundle/ruby/*/gems/{org-prefix}*/` |

  Effect: the broad ignore (`vendor/` / `node_modules/` / `vendor/bundle/`) excludes
  thousands of third-party files; the negation keeps first-party packages indexed.
  ```

- [ ] **Edit L101–L105** — generalise the .gitignore cross-reference. Find:
  ```
  Read `.gitignore` — most entries there should also be in `.augmentignore`.
  But `.augmentignore` should ALSO include:
  - Lock files (`composer.lock`, `package-lock.json`) — tracked in Git but useless for retrieval.
  - IDE helpers (`_ide_helper.php`) — tracked in Git but huge generated files.
  - OpenAPI specs — tracked but too large for context.
  ```
  Replace with:
  ```
  Read `.gitignore` — most entries there should also be in `.augmentignore`.
  But `.augmentignore` should ALSO include the following — these are typically
  tracked in Git (so absent from `.gitignore`) yet useless for the retrieval
  index because they are large, generated, or duplicate first-class source:

  - Lock files (`composer.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile.lock`, `Gemfile.lock`, `go.sum`, `Cargo.lock` for binaries) — tracked but useless for code understanding.
  - IDE helpers and codegen artefacts (`_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php`, `*.generated.ts`, `*.gen.go`, `__generated__/`) — tracked but huge.
  - API contracts that are generated, not authored (`openapi.{yaml,json}` produced by codegen, `schema.graphql` generated from resolvers, `swagger.json`) — keep the source, drop the generated.
  - Translation bundles when the project ships them in source control (`lang/`, `locales/`, `i18n/` files larger than ~20 KB).
  ```

- [ ] **Edit L113–L116** — generalise the stack-source list. Find:
  ```
  1. Read `AGENTS.md` — extract tech stack (framework, language, DB, frontend, infra).
  2. Read `composer.json` — extract `require` and `require-dev` packages.
  3. Read `package.json` (if exists) — extract frontend dependencies.
  4. List all skills: `ls .augment/skills/`
  ```
  Replace with:
  ```
  1. Read `AGENTS.md` — extract tech stack (framework, language, DB, frontend, infra).
  2. Read every package manifest present in the project root — extract dependencies:
     - `composer.json` → `require`, `require-dev`
     - `package.json` → `dependencies`, `devDependencies`, `peerDependencies`
     - `pyproject.toml` → `[project].dependencies`, `[tool.poetry.dependencies]`, `[dependency-groups]`
     - `requirements*.txt` / `Pipfile` → package list
     - `go.mod` → `require` blocks
     - `Cargo.toml` → `[dependencies]`, `[dev-dependencies]`, workspace members
     - `Gemfile` → `gem` lines
  3. List all skills: `ls .augment/skills/`
  ```

- [ ] **Edit L267** (Rules section, meta-skills list). Find:
  `` - **Never ignore meta/agent-system skills** — `agent-docs-writing-writing`, `commands`, `context-create`, `override-management`, `guidelines`, `project-docs`, `roadmap-management`, `naming`, `skill-reviewer`, `file-editor`, `copilot-config`, `copilot-agents-optimization`. ``
  Replace with:
  `` - **Never ignore meta / agent-system skills** — these are framework-independent and used by every project regardless of stack: `agent-docs-writing`, `agents-md-thin-root`, `check-refs`, `command-routing`, `command-writing`, `compress-memory`, `context-authoring`, `copilot-agents-optimization`, `copilot-config`, `description-assist`, `file-editor`, `guideline-writing`, `learning-to-rule-or-skill`, `lint-skills`, `md-language-check`, `override-management`, `persona-writing`, `project-analyzer`, `project-docs`, `project-health`, `roadmap-writing`, `rule-writing`, `skill-improvement-pipeline`, `skill-management`, `skill-reviewer`, `skill-writing`. ``
  Rationale: the original list contained stale names (`agent-docs-writing-writing`, `roadmap-management`, `naming`, `commands`, `context-create`, `guidelines`) that no longer exist as skill directories.



## Phase 4 — Cosmetic / Examples (14 generic artefacts)

**Goal**: For artefacts where Laravel/PHP is the **only** example (forcing the agent to invent equivalents for other stacks), add parallel multi-stack examples or replace the Laravel-specific example with a stack-agnostic one. Skip artefacts where Laravel is already listed as **one of several** examples — those are acceptable per the AI-Council classification.

Files NOT in this phase (verified acceptable on re-scan): `error-handling-patterns/SKILL.md`, `judge-code-quality/SKILL.md`, `skill-writing/SKILL.md`, `systematic-debugging/SKILL.md`, `missing-tool-handling.md`, `readme-writing/SKILL.md`, `readme-reviewer/SKILL.md`, `roadmap-writing/SKILL.md`, `analysis-skill-router/SKILL.md`, `universal-project-analysis/SKILL.md`, `security-audit/SKILL.md` (already has explicit `**Laravel:**` carve-out heading).

### Step 4.1: `.agent-src.uncompressed/rules/downstream-changes.md` (2 hits)

- [ ] **Edit L74**. Find: `` 1. **No broken imports** — `php -l` or PHPStan catches these ``
  Replace with: `` 1. **No broken imports** — `php -l` / PHPStan (PHP), `tsc --noEmit` (TS), `mypy` / `pyright` (Python), `cargo check` (Rust), `go build ./...` (Go) catches these ``

- [ ] **Edit L76**. Find: `` 3. **No broken types** — PHPStan Level 9 catches signature mismatches ``
  Replace with: `` 3. **No broken types** — the project's strict type-checker (PHPStan Level 9, `tsc --strict`, `mypy --strict`, `cargo check`, `go vet`) catches signature mismatches ``

### Step 4.2: `.agent-src.uncompressed/rules/context-hygiene.md` (2 hits)

- [ ] **Edit L64**. Find: `- Quality check (PHPStan, ECS) that still errors`
  Replace with: `- Quality check (type-checker + linter — e.g. PHPStan + ECS, tsc + eslint, mypy + ruff) that still errors`

### Step 4.3: `.agent-src.uncompressed/skills/git-workflow/SKILL.md` (4 hits)

- [ ] **Edit L30**. Find: `1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill).`
  Replace with: `1. Run the project's quality pipeline (see `quality-tools` skill) — typically: type-checker → auto-fixer → linter → type-checker.`

- [ ] **Edit L31**. Find: `` 2. Run tests: `php artisan test`. ``  <!-- carve-out: new-gate-verification -->
  Replace with: `2. Run the project's test command — detect from manifest: `php artisan test` / `vendor/bin/phpunit` (PHP), `npm test` / `pnpm test` / `vitest` / `jest` (JS-TS), `pytest` (Python), `cargo test` (Rust), `go test ./...` (Go).`

### Step 4.4: `.agent-src.uncompressed/skills/security/SKILL.md` (5 hits — heaviest cosmetic fix)

This skill currently mandates Laravel `FormRequest` and lists `tymon/jwt-auth` / `laravel/sanctum` as if they were the universal auth path. The fix is to keep the security principles framework-agnostic while keeping Laravel as one named example.

- [ ] **Edit L16**. Find: `* Validation logic only — route to [`laravel-validation`](../laravel-validation/SKILL.md)`
  Replace with:
  ```
  * Validation logic only — route to the framework-specific validation skill (e.g. [`laravel-validation`](../laravel-validation/SKILL.md) for Laravel)
  ```

- [ ] **Edit L33**. Find: `` - Check auth setup: `tymon/jwt-auth` or `laravel/sanctum`. ``
  Replace with:
  ```
  - Check auth setup — detect from project manifest:
    - PHP / Laravel: `tymon/jwt-auth`, `laravel/sanctum`, `laravel/passport`
    - PHP / Symfony: `symfony/security-bundle`, `lexik/jwt-authentication-bundle`
    - Node / JS: `passport`, `next-auth`, `lucia`, `jose`
    - Python: `python-jose`, `authlib`, framework-native (Django `auth`, FastAPI `OAuth2PasswordBearer`)
    - Go: `golang-jwt`, `oauth2`
    - Rust: `jsonwebtoken`, `axum-login`
  ```

- [ ] **Edit L40**. Find: `2. Use in FormRequest `authorize()` or controller `$this->authorize()`.`
  Replace with: `2. Enforce at the request boundary — Laravel `FormRequest::authorize()` / `$this->authorize()`, Symfony `#[IsGranted]` voter, Express middleware, FastAPI `Depends`, Axum extractor, Django permission class.`

- [ ] **Edit L54**. Find: `- Verify all user input is validated via FormRequest before use.`
  Replace with: `- Verify all user input is validated at the request boundary before use — Laravel `FormRequest`, Symfony validators, JSON-schema / zod / pydantic / serde, etc.`

- [ ] **Edit L57**. Find: `- Run PHPStan — must pass (catches type-safety issues that enable injection).`
  Replace with: `- Run the project's strict type-checker (PHPStan, mypy, tsc --strict, cargo check) — must pass (catches type-safety issues that enable injection).`

- [ ] **Edit L73**. Find: `- Do NOT bypass FormRequest validation in controllers.`
  Replace with: `- Do NOT bypass the framework's request-boundary validation in controllers / route handlers.`

### Step 4.5: `.agent-src.uncompressed/skills/developer-like-execution/SKILL.md` (5 hits — Laravel-only examples)

The skill teaches "minimal-evidence execution" but every example uses `php artisan` / Laravel logs. Add parallel examples for the other major stacks so the principle survives translation.

- [ ] **Edit L86–L88**. Find:
  ```
  - Laravel: `route:list --json | jq '.[] | select(.uri | test("users"))'`
  - Logs: `rg "request_id=abc123" storage/logs` — never `cat storage/logs/laravel.log`
  ```
  Replace with:
  ```
  - Route lookup — Laravel `php artisan route:list --json | jq '…'`, Rails `bin/rails routes | grep users`, Express `console.log(app._router.stack)`, FastAPI `app.routes`, Symfony `bin/console debug:router`.
  - Logs — `rg "request_id=abc123" <log-dir>` — never `cat <log-file>`. Log dirs by stack: Laravel `storage/logs/`, Rails `log/`, Node `./logs/` or `journalctl`, Python `./logs/` or `journalctl`, Docker `docker compose logs <svc> --since 5m`.
  ```

- [ ] **Edit L158–L174**. Find the "Project commands" block (the four `php artisan …` lines starting `# Laravel route lookup`). Replace the whole block with:
  ```
  # Route lookup — pick the project's framework
  php artisan route:list --json | jq '.[] | select(.uri == "api/users") | {method, uri, name, action, middleware}'   # Laravel
  bin/console debug:router --format=json | jq '.[] | select(.path == "/api/users")'                                  # Symfony
  bin/rails routes -g users                                                                                          # Rails
  curl -s http://localhost:3000/__routes | jq '.[] | select(.path == "/api/users")'                                  # Express custom-introspection
  curl -s http://localhost:8000/openapi.json | jq '.paths["/api/users"]'                                             # FastAPI

  # Config inspection
  php artisan config:show app | grep env       # Laravel
  bin/console debug:config framework            # Symfony
  bin/rails runner 'puts Rails.application.config_for(:database)'  # Rails

  # Recent logs — targeted, not full dump
  tail -n 200 storage/logs/laravel.log | rg "payment|timeout"             # Laravel
  tail -n 200 log/development.log | rg "payment|timeout"                   # Rails
  docker compose logs api --since 5m --no-color | rg "payment|timeout"     # any container stack
  journalctl -u myapp --since "5 min ago" | rg "payment|timeout"           # systemd

  # DB-state probe — targeted single record, not full table
  php artisan tinker --execute="User::where('email','x@y')->first(['id','email','status'])"   # Laravel
  bin/rails runner "p User.where(email: 'x@y').first&.slice(:id,:email,:status)"               # Rails
  bin/console doctrine:query:sql "SELECT id,email,status FROM users WHERE email='x@y' LIMIT 1" # Symfony
  psql -d mydb -c "SELECT id,email,status FROM users WHERE email='x@y' LIMIT 1"                 # raw SQL fallback
  ```

### Step 4.6: `.agent-src.uncompressed/skills/database/SKILL.md` (3 hits)

- [ ] **Edit L5**. Find: `  - eloquent-tamer`
  Replace with: `  - eloquent-tamer    # Laravel-specific carve-out`

- [ ] **Edit L17**. Find: `- Writing Eloquent models (use `eloquent` skill)`
  Replace with: `- Writing framework-specific ORM models (use the matching skill — e.g. `eloquent` for Laravel, `symfony-workflow` for Doctrine, framework-native skill for Prisma / TypeORM / SQLAlchemy / GORM / Diesel)`

- [ ] **Edit L55**. Find: `` 3. **Run schema queries** — `php artisan tinker --execute="Schema::getColumnListing('table')"` ``
  Replace with:
  ```
  3. **Run schema queries** — use the project's REPL or a raw introspection query:
     - Laravel: `php artisan tinker --execute="Schema::getColumnListing('table')"`
     - Symfony / Doctrine: `bin/console doctrine:mapping:info`
     - Rails: `bin/rails runner "p ActiveRecord::Base.connection.columns('table').map(&:name)"`
     - Prisma: `npx prisma db pull --print | grep -A20 "model Table"`
     - Generic SQL: `psql -d mydb -c "\d table"` / `mysql -e "DESCRIBE table"`
  ```

### Step 4.7: `.agent-src.uncompressed/skills/feature-planning/SKILL.md` (4 hits)

- [ ] **Edit L148**. Find: `` 3. **Exact command** — `php artisan migrate --path=database/migrations/2026_05_09_create_logins.php`, never *"run the migration"*. ``
  Replace with: `` 3. **Exact command** — the precise CLI invocation, never *"run the migration"*. Examples: `php artisan migrate --path=database/migrations/2026_05_09_create_logins.php` (Laravel), `bin/console doctrine:migrations:migrate --no-interaction` (Symfony), `bin/rails db:migrate VERSION=20260509…` (Rails), `npx prisma migrate deploy` (Prisma), `alembic upgrade +1` (Python / Alembic), `sqlx migrate run` (Rust). ``

### Step 4.8: `.agent-src.uncompressed/skills/finishing-a-development-branch/SKILL.md` (3 hits)

- [ ] **Edit L64**. Find: `3. Quality pipeline (PHPStan → Rector dry-run → ECS → PHPStan) green`
  Replace with: `3. Quality pipeline green — the project's full sequence (type-checker → auto-fixer dry-run → linter → type-checker; e.g. PHPStan → Rector → ECS → PHPStan for Laravel-PHP, tsc → eslint --fix → eslint → tsc for TS, mypy → ruff --fix → ruff → mypy for Python)`

### Step 4.9: `.agent-src.uncompressed/skills/context-authoring/SKILL.md` (3 hits)

- [ ] **Edit L74**. Find: `` | `data-sensitivity.md` | Eloquent `$hidden` / `$casts`, Sentry `beforeSend`, logging helpers, API resources, export commands | ``
  Replace with: `` | `data-sensitivity.md` | ORM hidden-field config (Eloquent `$hidden` / `$casts`, Symfony `#[Ignore]`, Prisma `select` defaults, SQLAlchemy `__init__` filters), Sentry `beforeSend`, logging redaction helpers, API serialisers / resources, export commands | ``

### Step 4.10: `.agent-src.uncompressed/skills/roadmap-management/SKILL.md` (3 hits)

- [ ] **Edit L96**. Find: `- [ ] All quality gates pass (PHPStan, Rector, tests)`
  Replace with: `- [ ] All quality gates pass — the project's type-checker, auto-fixer, linter, and full test suite (see the `quality-tools` skill for stack-specific invocations)`


### Step 4.11: `.agent-src.uncompressed/skills/multi-tenancy/SKILL.md` (2 hits — declare scope)

This skill is **deeply** coupled to Laravel (Eloquent `$connection`, `DB::connection()`, `RefreshDatabase`, Artisan). Rather than rewrite all examples, declare the scope at the top so the agent does not load it for non-Laravel projects.

- [ ] **Edit frontmatter (top of file)**. Add a `scope:` key right after `description:`:
  ```yaml
  scope:
    framework: laravel
    rationale: "Uses Eloquent model conventions, Laravel Context, and Artisan traits — concepts not portable across frameworks. Other stacks need a stack-native multi-tenancy skill."
  ```

- [ ] **Edit L52**. Find: `Search the codebase for the service responsible for tenant switching. Typical responsibilities:`
  Replace with: `**Scope**: Laravel-specific (see frontmatter). For non-Laravel multi-tenant systems, the concepts below still apply but the implementation differs — consult the framework's connection / session / DI conventions.\n\nSearch the codebase for the service responsible for tenant switching. Typical responsibilities:`

### Step 4.12: `.agent-src.uncompressed/commands/feature/roadmap.md` (2 hits)

- [ ] **Edit L100**. Find: `- [ ] Quality: PHPStan + Rector`
  Replace with: `- [ ] Quality: project's type-checker + auto-fixer (see `quality-tools` skill — e.g. PHPStan + Rector for PHP, tsc + eslint --fix for TS, mypy + ruff for Python)`

- [ ] **Edit L209**. Find: `- **Include quality gates** (PHPStan, Rector, tests) in every phase.`
  Replace with: `- **Include quality gates** in every phase — the project's type-checker, auto-fixer, and full test run. Look up the actual commands via `quality-tools` instead of hardcoding stack-specific tool names in the roadmap.`

### Step 4.13: `.agent-src.uncompressed/commands/module/explore.md` (3 hits — frontmatter + body)

- [ ] **Edit L6 (frontmatter)**. Find: `skills: [laravel]`
  Replace with:
  ```yaml
  skills: [laravel, symfony-workflow, php-coder]
  scope:
    structure: modular-monolith
    rationale: "Targets projects with a Modules/ or src/<Domain>/ folder convention (HMVC, DDD-lite, Symfony bundles). Pure-flat repositories have nothing to explore."
  ```

- [ ] **Edit L20–L21**. Find:
  ```
  - **Laravel projects**: Check if `app/Modules/` exists.
  - **Composer projects / packages**: Check `./agents/` or `src/` for domain directories.
  ```
  Replace with:
  ```
  - **Laravel HMVC**: Check `app/Modules/`.
  - **Symfony / DDD-lite**: Check `src/<Domain>/` or `src/Module/<Domain>/`.
  - **Composer packages / libraries**: Check `./agents/` or `src/` for domain directories.
  - **Node / TS monorepo**: Check `packages/`, `apps/`, or `modules/`.
  - **Python**: Check top-level package dirs under `src/<package>/` or flat `<package>/`.
  - **Go**: Check `internal/<domain>/` or `cmd/<service>/`.
  ```

- [ ] **Edit L25**. Find: `Scan `app/Modules/` and show all modules (skip `.module-template` and hidden dirs):`
  Replace with: `Scan the detected modules directory (see step 1) and show all modules. Skip `.module-template`, `.example`, and hidden dirs:`

### Step 4.14: `.agent-src.uncompressed/commands/onboard.md` (1 hit — symbolic, keep as-is + add Symfony hint)

The probe at L218–L226 is **already** multi-stack (PHP, Node, Rust, Go, Python, Ruby). The one improvement is splitting PHP detection so Symfony is named.

- [ ] **Edit L220**. Find: `[ -f composer.json ] && stacks+=("php")`
  Replace with:
  ```bash
  if [ -f composer.json ]; then
    if grep -q '"laravel/framework"' composer.json 2>/dev/null; then
      stacks+=("php-laravel")
    elif grep -q '"symfony/framework-bundle"' composer.json 2>/dev/null; then
      stacks+=("php-symfony")
    else
      stacks+=("php")
    fi
  fi
  ```
  Rationale: lets downstream `stack.detected` resolve to the matching carve-out skill set without an extra round-trip.


## Phase 5 — Relocation (4 misclassified carve-outs)

**Goal**: 3 skills and 1 command currently sit at the top level with generic-sounding names but are 100 % Laravel-coupled. Rename them with a `laravel-` prefix (matching the existing carve-out pattern `laravel-reverb`, `laravel-mail`, `laravel-middleware`, `laravel-validation`, `laravel-pulse`, `laravel-horizon`, `laravel-notifications`, `laravel-pennant`, `laravel-scheduling`), update **every** cross-reference, and propagate through the source / Augment / multi-tool pipelines via `task sync`.

**Rule**: edits go to `.agent-src.uncompressed/` only. Generated trees (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) regenerate via `task sync` + `task generate-tools` (Step 6.2).

### Step 5.1: Rename `skills/websocket` → `skills/laravel-websocket`

Skill body uses `ShouldBroadcast`, `broadcastOn()`, `routes/channels.php`, Laravel Echo — all Laravel-Broadcasting-specific. Generic WebSocket implementations (Node `ws`, Python `websockets`, Go `gorilla/websocket`, Rust `tokio-tungstenite`) need their own stack-native skills, not this one.

- [ ] **Move directory**:
  ```bash
  git mv .agent-src.uncompressed/skills/websocket .agent-src.uncompressed/skills/laravel-websocket
  ```

- [ ] **Edit `.agent-src.uncompressed/skills/laravel-websocket/SKILL.md` L2**. Find: `name: websocket`
  Replace with: `name: laravel-websocket`

- [ ] **Edit same file L3**. Find: `description: "Use when building real-time features — WebSocket broadcasting, live updates, presence channels, connection state — even when the user just says 'push this to the client live'."`
  Replace with: `description: "Use when building Laravel real-time features — Broadcasting events, ShouldBroadcast, private/presence channels, Echo client. For non-Laravel WebSockets, use the framework-native skill (Node ws, Python websockets, Go gorilla, Rust tokio-tungstenite)."`

- [ ] **Edit same file L5**. Find: `domain: engineering`
  Replace with:
  ```yaml
  domain: engineering
  framework: laravel
  ```

- [ ] **Edit same file L8**. Find: `# websocket`
  Replace with: `# laravel-websocket`

- [ ] **Update cross-references** (4 files):
  - `.agent-src.uncompressed/contexts/augment-infrastructure.md:89` — find `` `jobs-events`, `logging-monitoring`, `grafana`, `websocket` `` → replace with `` `jobs-events`, `logging-monitoring`, `grafana`, `laravel-websocket` ``
  - `.agent-src.uncompressed/contexts/skills-and-commands.md:104` — find `` `laravel-reverb`, `websocket` `` → replace with `` `laravel-reverb`, `laravel-websocket` ``
  - `.agent-src.uncompressed/contexts/communication/rules-auto/guidelines-mechanics.md:36` — find `` | `websocket.md` | WebSocket conventions — Broadcasting, channel types, connection management | `` → replace with `` | `laravel-websocket.md` | Laravel Broadcasting conventions — channel types, connection management, Echo client | ``
  - `.agent-src.uncompressed/skills/laravel-reverb/SKILL.md:19` — find `[websocket](../websocket/SKILL.md)` → replace with `[laravel-websocket](../laravel-websocket/SKILL.md)`

### Step 5.2: Rename `skills/dto-creator` → `skills/laravel-dto`

Skill body uses `SimpleDto` base class, attribute mapping, PHP-attribute syntax — Laravel/PHP-specific data-mapper pattern, not a generic DTO concept.

- [ ] **Move directory**:
  ```bash
  git mv .agent-src.uncompressed/skills/dto-creator .agent-src.uncompressed/skills/laravel-dto
  ```

- [ ] **Edit `.agent-src.uncompressed/skills/laravel-dto/SKILL.md` L2**. Find: `name: dto-creator`
  Replace with: `name: laravel-dto`

- [ ] **Edit same file L3**. Find: `description: "Use when the user says "create a DTO", "new data transfer object", or needs to convert request/response data into a typed PHP class. Creates DTOs with SimpleDto base class and attribute mapping."`
  Replace with: `description: "Use when creating a Laravel/PHP DTO with the SimpleDto base class and attribute mapping. For DTOs in other stacks, use the stack-native skill (TypeScript class-validator/zod, Python dataclass/pydantic, Rust serde struct, Go struct + tags)."`

- [ ] **Edit same file L5**. Find: `domain: engineering`
  Replace with:
  ```yaml
  domain: engineering
  framework: laravel
  ```

- [ ] **Edit same file L8**. Find: `# dto-creator`
  Replace with: `# laravel-dto`

- [ ] **Update cross-references** (3 files):
  - `.agent-src.uncompressed/contexts/augment-infrastructure.md:82` — in the PHP/Laravel table row, find `` `dto-creator` `` → replace with `` `laravel-dto` ``
  - `.agent-src.uncompressed/skills/php-service/SKILL.md:16` — find `` - DTOs (use `dto-creator` skill) `` → replace with `` - DTOs (use `laravel-dto` skill for Laravel/PHP; framework-native skill for other stacks) ``
  - `.agent-src.uncompressed/skills/skill-reviewer/SKILL.md:196` — find `| dto-creator |` → replace with `| laravel-dto |`


### Step 5.3: Rename `skills/migration-creator` → `skills/laravel-migration`

Skill body uses Laravel migration commands (`php artisan make:migration`), Schema builder, the project's table-prefix and multi-tenant conventions — all Laravel-specific. The generic concept (cross-stack migration planning) already lives in `migration-architect`.

- [ ] **Move directory**:
  ```bash
  git mv .agent-src.uncompressed/skills/migration-creator .agent-src.uncompressed/skills/laravel-migration
  ```

- [ ] **Edit `.agent-src.uncompressed/skills/laravel-migration/SKILL.md` L2**. Find: `name: migration-creator`
  Replace with: `name: laravel-migration`

- [ ] **Edit same file L3**. Find: `description: "Use when the user says "create migration", "add column", or "new table". Creates migrations with correct table prefixes, column naming, and multi-tenant awareness."`
  Replace with: `description: "Use when creating a Laravel migration — table prefixes, column naming, multi-tenant awareness, php artisan make:migration. For Symfony use Doctrine migrations, for Rails use bin/rails generate migration, for Prisma use prisma migrate, for Alembic use alembic revision."`

- [ ] **Edit same file L5**. Find: `domain: engineering`
  Replace with:
  ```yaml
  domain: engineering
  framework: laravel
  ```

- [ ] **Edit same file L8**. Find: `# migration-creator`
  Replace with: `# laravel-migration`

- [ ] **Update cross-references** (6 files):
  - `.agent-src.uncompressed/contexts/augment-infrastructure.md:88` — find `` `database`, `migration-creator`, `multi-tenancy` `` → replace with `` `database`, `laravel-migration`, `multi-tenancy` ``
  - `.agent-src.uncompressed/contexts/skills-and-commands.md:98` — find `` `database`, `migration-creator`, `multi-tenancy`, `sql-writing` `` → replace with `` `database`, `laravel-migration`, `multi-tenancy`, `sql-writing` ``
  - `.agent-src.uncompressed/skills/database/SKILL.md:18` — find `` - Creating migrations only (use `migration-creator` skill) `` → replace with `` - Creating migrations only — use the framework-specific migration skill (`laravel-migration` for Laravel, framework-native for others) ``
  - `.agent-src.uncompressed/skills/migration-architect/SKILL.md:3` — find `hands off to `migration-creator` for DDL once locked.` → replace with `hands off to the framework-specific migration skill (`laravel-migration`, Doctrine `bin/console make:migration`, etc.) for DDL once locked.`
  - `.agent-src.uncompressed/skills/migration-architect/SKILL.md:16` — find `[`migration-creator`](../migration-creator/SKILL.md)` → replace with `[`laravel-migration`](../laravel-migration/SKILL.md)`
  - `.agent-src.uncompressed/skills/migration-architect/SKILL.md:31` — same find/replace as L16
  - `.agent-src.uncompressed/skills/migration-architect/SKILL.md:103` — find `Next: /migration-creator for the DDL of phase 1` → replace with `Next: /laravel-migration (or framework-native equivalent) for the DDL of phase 1`
  - `.agent-src.uncompressed/skills/migration-architect/SKILL.md:115` — find `Do NOT write DDL — that is `migration-creator`'s job.` → replace with `Do NOT write DDL — that is the framework-specific migration skill's job (`laravel-migration` for Laravel).`
  - `.agent-src.uncompressed/skills/adversarial-review/SKILL.md:107` — find `- **migration-creator** — review migration for data safety.` → replace with `- **laravel-migration** (or framework-native equivalent) — review migration for data safety.`
  - `.agent-src.uncompressed/skills/eloquent/SKILL.md:18` — find `` - Creating migrations only (use `migration-creator` skill) `` → replace with `` - Creating migrations only (use `laravel-migration` skill) ``

### Step 5.4: Tag `commands/update-form-request-messages.md` as Laravel-specific

The command is already named after a Laravel concept (FormRequest) and lists `skills: [laravel-validation]`. The fix is to make the framework binding **explicit** in the frontmatter so the rule-router and the command-suggester treat it as a carve-out.

- [ ] **Edit `.agent-src.uncompressed/commands/update-form-request-messages.md` frontmatter**. Find:
  ```yaml
  ---
  name: update-form-request-messages
  tier: 2
  skills: [laravel-validation]
  description: Sync the messages() method of a FormRequest class — add missing entries, link them to language keys, and clean up stale ones
  disable-model-invocation: true
  ```
  Replace with:
  ```yaml
  ---
  name: update-form-request-messages
  tier: 2
  framework: laravel
  skills: [laravel-validation]
  description: "Sync the messages() method of a Laravel FormRequest class — add missing entries, link them to language keys, and clean up stale ones. Laravel-specific: only triggers in projects with app/Http/Requests/*.php files."
  disable-model-invocation: true
  ```

- [ ] **Update cross-reference** (1 file):
  - `.agent-src.uncompressed/contexts/augment-infrastructure.md:110` — leave as-is (already lists by command name; the `framework: laravel` tag is the discriminator that downstream tools read).

- [ ] **Optional follow-up** (NOT in this roadmap — file a follow-up): rename the command file itself to `commands/laravel/update-form-request-messages.md` once the broader carve-out subdirectory convention is decided in a separate ADR.


## Phase 5 acceptance criteria

- [ ] `git status` shows 4 directory renames (R) plus the frontmatter / cross-reference edits — no orphan duplicates
- [ ] `grep -rn "migration-creator\|dto-creator\|^| .* websocket .*|" .agent-src.uncompressed/` returns 0 hits (old names fully retired)
- [ ] `grep -rn "framework: laravel" .agent-src.uncompressed/skills/laravel-*/SKILL.md .agent-src.uncompressed/commands/update-form-request-messages.md` returns one match per renamed artifact
- [ ] `task check-refs` exits 0 (no broken cross-references)
- [ ] `task lint-skills` green for all 4 renamed artifacts (frontmatter still valid)

## Phase 6 — Validation, Regeneration & Rollout

**Goal**: prove every edit in Phases 0–5 holds together, regenerate the four downstream projections (source / Augment / multi-tool / Claude bundle), and stage the rollout so a single broken step does not poison `main`.

**Hard Gate Policy**: every `task` invocation below is a **carve-out for this roadmap only**. `quality.local_auto_run: false` is the project default; CI steps in roadmaps are normally blocked by [`roadmap-ci-steps-policy`](../../.agent-src.uncompressed/rules/roadmap-ci-steps-policy.md). The carve-out is justified because this roadmap touches the source-of-truth of the linter / rule-router / cross-reference graph itself — validation can only be done after the edits land.

### Step 6.1: Source-of-truth lints (run BEFORE regeneration)

- [ ] `python3 scripts/lint_framework_leakage.py .agent-src.uncompressed/` — must exit 0. If non-zero, the offending file / line is printed; fix in place before continuing.
- [ ] `task lint-skills` — frontmatter validation across all skills incl. the 4 renames. Must exit 0 or `warn`-only.
- [ ] `task lint-rule-budget` — confirms the new Tier-2 rule from Phase 0 stays within the per-rule character cap.
- [ ] `task lint-rule-tiers` — confirms `framework-neutrality-in-generic-skills` is correctly classified as Tier 2 (auto-loaded only on matching repo signal).
- [ ] `task check-refs` — confirms all internal `[...](path/to/file.md)` links resolve after the renames in Phase 5.
- [ ] `task check-context-paths` — confirms `contexts/augment-infrastructure.md` and `contexts/skills-and-commands.md` table entries still point to existing files.

**Failure handling**: if any lint fails, do NOT proceed to Step 6.2. Fix the source file, re-run **only the failing lint**, then resume.

### Step 6.2: Regenerate downstream projections

The four projections regenerate from `.agent-src.uncompressed/` in a fixed order. Skipping or reordering breaks the cross-tool consistency check.

- [ ] **A → B (compress source)**: `task sync`
  - Compresses `.agent-src.uncompressed/` → `.agent-src/` (caveman grammar) and projects to `.augment/`.
  - Expect: ~50 files changed (the edited skills + their compressed twins), plus `router.json` regen if Phase 0 added a rule.

- [ ] **B → C (multi-tool projection)**: `task generate-tools`
  - Regenerates `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.
  - Expect: per-tool diffs for every renamed skill + every leakage-fix edit.

- [ ] **C → D (Claude bundle)**: `task ci-cloud-bundle`
  - Verifies the cloud-skills bundle still builds after renames. Read-only check — no file output unless drift detected.

### Step 6.3: Cross-tool consistency checks

- [ ] `task lint-projection-fidelity` — confirms `.agent-src/` ↔ `.augment/` ↔ `.claude/` ↔ `.cursor/` semantic equivalence (no projection lost a renamed file).
- [ ] `task counts-check` — confirms skill / rule / command counts are coherent across all projections.
- [ ] `task check-index` — confirms `README.md`, `docs/architecture.md`, `docs/getting-started.md` reflect any new counts.
- [ ] `task check-public-catalog-links` — confirms the public catalog still resolves after renames.


### Step 6.4: Full CI gate

- [ ] `task ci` — full pipeline (~70 sub-tasks). Must exit 0.  <!-- carve-out: new-gate-verification -->
  - If a failure surfaces, classify it: (a) caused by Phase 0–5 edits → fix; (b) pre-existing unrelated failure → file follow-up issue, do NOT mask in this roadmap.

### Step 6.5: AI Council validation (optional but recommended)

- [ ] Invoke `/council pr` against the staged branch — second-opinion review on Phases 0–5.
  - Council reads: roadmap + diff. Outputs: blocker / nit / verdict.
  - **Cost gate**: this is one OpenAI + one Anthropic call (~$1–3). Skip if the rollout window is hot.

### Step 6.6: Staged rollout

The diff touches ~50 source files + ~150 generated files. Land it in **three commits**, not one — keeps `git blame` clean and lets bisect isolate regressions.

- [ ] **Commit A — `feat(rules): add framework-neutrality Tier-2 rule + linter`**
  - Includes: Phase 0 artifacts only (`rules/framework-neutrality-in-generic-skills.md`, `scripts/lint_framework_leakage.py`, `tests/test_lint_framework_leakage.py`, `router.json` regen, Taskfile wiring).
  - Verifies: `task lint-skills`, `task lint-rule-budget`, `task check-router`, full `pytest`.

- [ ] **Commit B — `refactor(skills,rules,commands): remove PHP/Laravel leakage from generic artifacts`**
  - Includes: Phases 1–4 edits to source + regenerated `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.
  - Verifies: `task ci` full pipeline.

- [ ] **Commit C — `refactor(skills,commands): relocate 4 Laravel-coupled artifacts to laravel-* namespace`**
  - Includes: Phase 5 renames (`websocket` → `laravel-websocket`, `dto-creator` → `laravel-dto`, `migration-creator` → `laravel-migration`, `update-form-request-messages` framework-tag), all cross-reference updates, regenerated projections.
  - Verifies: `task check-refs`, `task lint-projection-fidelity`, `task ci`.

**Branch + PR convention**: per [`commit-policy`](../../.agent-src.uncompressed/rules/commit-policy.md), do NOT push or open a PR without explicit user permission for this roadmap. The agent stops after Commit C is locally green and reports back.

### Step 6.7: Post-merge follow-ups (file as separate issues, do NOT include in this roadmap)

- [ ] Decide whether the carve-out subdirectory convention (e.g. `skills/laravel/`, `commands/laravel/`) should replace the flat `laravel-*` prefix. Requires its own ADR.
- [ ] Decide whether `multi-tenancy` should be renamed `laravel-multi-tenancy` after Step 4.11's scope declaration proves insufficient in practice.
- [ ] Extend the Phase 0 linter with optional checks for Symfony / Rails / Express-only mandates once the package adds carve-outs for those stacks.

## Phase 6 acceptance criteria

- [ ] `task ci` green  <!-- carve-out: new-gate-verification -->
- [ ] 3 commits staged locally, in the order above
- [ ] No pushed branch / opened PR until the user explicitly authorizes (per `commit-policy`)
- [ ] Council verdict (if invoked) recorded in `agents/council-*/framework-neutrality-audit-{date}.md`

## Success criteria (whole roadmap)

- [ ] `python3 scripts/lint_framework_leakage.py` exits 0 against every generic artifact in `.agent-src.uncompressed/{skills,rules,commands}/`
- [ ] `framework-neutrality-in-generic-skills` rule appears in `router.json` at Tier 2 and blocks future leakage in CI
- [ ] All 4 renamed carve-outs (`laravel-websocket`, `laravel-dto`, `laravel-migration`, framework-tagged `update-form-request-messages`) carry `framework: laravel` in their frontmatter
- [ ] Generic artifacts touched in Phases 1–4 either (a) have no framework mention, or (b) name PHP/Laravel as one of ≥2 parallel examples ("e.g. PHPStan for PHP, mypy for Python, tsc for TS")
- [ ] `task ci` green across all 70+ sub-tasks  <!-- carve-out: new-gate-verification -->
- [ ] All 4 projections (`.agent-src/`, `.augment/`, `.claude/` + tool family, `cloud-bundle`) regenerate without manual fixup

## Success definition

The audit succeeds when **a new contributor cannot reintroduce framework leakage by accident**:

1. **Prevention** — Phase 0's Tier-2 rule + `task lint-framework-leakage` reject any new generic skill that mentions PHPStan / Eloquent / FormRequest without parallel multi-stack examples.
2. **Cure** — Phases 1–5 fix the existing 584 hits so the linter starts from a green baseline.
3. **Discovery** — Phase 5's `laravel-*` prefix + `framework: laravel` frontmatter let the rule-router serve the right artifact per project automatically (no manual selection).
4. **Auditability** — every change in this roadmap cites the source file, line number, and exact replacement string. A future LLM (or human) can re-run the audit by diffing `agents/analysis/framework-leakage-scan-2026-05-17.txt` against a fresh scan output.

## Rollback

If any phase introduces a regression that surfaces post-merge:

- **Commit A only** — revert the one commit; the Tier-2 rule disappears, no skill / command body changes were shipped.
- **Commit B only** — revert leaves the new rule in place but rolls back the leakage fixes. The rule will then flag the restored leakage in CI — expected; either re-land B or revert A too.
- **Commit C only** — revert restores old names; cross-references in B will become broken — revert B as well, or land a compensating commit that restores the old cross-refs.

In all three cases, the revert is a single `git revert <sha>` per commit — no schema migration, no data fixup. The roadmap is **fully reversible**.

## Postscript — actual rollout (2026-05-18)

The original Step 6.6 plan was **3 commits**. The branch shipped as **11 commits** (9 phase-bounded edits + 2 process-hardening / Phase-6-polish commits added mid-Phase-6 per AI Council verdicts in `agents/council-responses/2026-05-18-process-hardening.md` and `agents/council-responses/2026-05-18-phase6-finalization.md`). Rationale:  <!-- council-ref-allowed: rollout-record traces commit SHAs to council verdicts that justified them; inlining the multi-member synthesis would lose the citation chain -->

- **Bisectability over commit-count minimalism.** Phases 0–5 each touched a distinct concern (linter scaffolding, Tier-1 mandates, Tier-2 leakage, multi-stack examples, relocations, frontmatter carve-outs). Squashing them into Commit B would have made `git bisect` useless for a regression in any single phase.
- **Schema + linter refinements landed mid-Phase-6** (commits `05d13f29` cross-stack heuristic, `c486de2d` framework carve-out tags, `fbac3f99` process hardening with `user-interrupt-priority` + validation budget) — these are scope-adjacent process changes, not body edits, and deserved their own SHAs.
- **Rollback is still single-revert per concern**: the rollback matrix above generalises to `git revert <sha>` for whichever commit reintroduces the regression. The 11-commit shape strictly extends, never violates, the 3-commit invariant (every concern is still atomic).

The 11-commit final shape is the authoritative rollout record; the 3-commit plan in Step 6.6 reflects the pre-execution estimate.

## See also

- [`rules/architecture.md`](../../.agent-src.uncompressed/rules/architecture.md) — package architecture, carve-out pattern
- [`docs/contracts/rule-router.md`](../../docs/contracts/rule-router.md) — Tier-1 / Tier-2 routing, per-rule char budget
- [`rules/roadmap-ci-steps-policy.md`](../../.agent-src.uncompressed/rules/roadmap-ci-steps-policy.md) — CI-step gate (this roadmap declares a carve-out in Phase 6)
- [`contexts/execution/roadmap-process-loop.md`](../../.agent-src.uncompressed/contexts/execution/roadmap-process-loop.md) — how `/roadmap:process-step` walks this file
- `agents/analysis/framework-leakage-scan-2026-05-17.txt` — raw evidence (1008 lines, 584 hits)
- `scripts/_tmp_scan_framework_leakage.py` — throwaway scanner (replaced by Phase 0's permanent linter)

