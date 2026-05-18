---
type: "auto"
tier: "2a"
description: "When editing a generic skill, rule, or command — block single-stack mandates (PHP/Laravel/Symfony only). Generic artifacts use language-agnostic procedures with carve-out pointers."
source: package
triggers:
  - path_prefix: ".agent-src.uncompressed/skills/"
  - path_prefix: ".agent-src.uncompressed/rules/"
  - path_prefix: ".agent-src.uncompressed/commands/"
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
applies_to_user_types:
  - "maintainer"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule's subject is generic artifacts under .agent-src.uncompressed/; every body link points there by design."
  - type: "substring"
    pattern: "scripts/lint_framework_leakage"
    reason: "Rule cites the enforcing linter script by name in body and enforcement section."
---

# framework-neutrality-in-generic-skills

## The Iron Law

```
NO GENERIC ARTIFACT MAY MANDATE A SPECIFIC FRAMEWORK.
SPECIFICS BELONG IN CARVE-OUT ARTIFACTS (laravel-*, symfony-*,
nextjs-*, pest-*, eloquent, quality-tools).
```

A generic skill, rule, or command names a *procedure* — what to do.
A carve-out artifact names a *stack* — how that procedure looks in
Laravel, Next.js, Pest, etc. Mixing the two leaks framework assumptions
into surfaces the agent must trigger on regardless of project stack.

## Scope

This rule fires on edits under:

- `.agent-src.uncompressed/skills/`
- `.agent-src.uncompressed/rules/`
- `.agent-src.uncompressed/commands/`

**Exempt** (file or directory name matches — these are correctly
framework-specific): `laravel*`, `symfony*`, `nextjs*`, `react-*`,
`^php-*`, `^pest-*`, `^eloquent`, `^blade*`, `^livewire`, `^flux`,
`^artisan-*`, `^composer-*`, `^docker*`, `^aws-*`, `^grafana`,
`^openapi$`, `^quality-tools`, `^sql-writing`, `^tailwind*`,
`^terraform*`, `^terragrunt*`, `^traefik`, `^mobile-e2e`,
`-routing$`, `project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)`.

## Forbidden patterns in generic artifacts

| Pattern | Why it leaks | Fix |
|---|---|---|
| `FormRequest` as a mandate | Laravel-only validation class | Say "request-validation primitive (FormRequest in Laravel, zod in Next.js, pydantic in FastAPI)" or move to `laravel-validation` carve-out |
| `php artisan …` as a canonical command | Laravel CLI | Generalize to "the framework's CLI" or move to `artisan-commands` carve-out |
| `PHPStan` as the only example | PHP-only static analyser | List peers (`mypy` for Python, `tsc` for TypeScript) or move to `quality-tools` carve-out |
| `composer.json` mentioned alone | PHP package manifest | Add `package.json` / `pyproject.toml` peers, or move to a PHP-scoped carve-out |
| `Eloquent` / `Model::…` | Laravel ORM | Generalize to "the project's ORM/data layer" or move to `eloquent` carve-out |
| `Pest` as the only test runner | PHP/Laravel test framework | List peers (`pytest`, `vitest`, `jest`) or move to `pest-testing` carve-out |
| `Blade` / `Livewire` / `Flux` as default UI | Laravel view stack | Generalize to "the project's UI layer" or move to `blade-ui` / `livewire` / `flux` carve-outs |
| `vendor/bin/<tool>` as a canonical path | PHP/Composer-specific binary path | Say "the project's quality CLI" or carve-out it |
| `Rector` as the only refactor tool | PHP-only refactorer | List peers (`ts-morph`, `libcst`) or carve-out it |
| "every controller" / "all controllers" | Assumes MVC PHP framework | Generalize to "every request handler" / "every endpoint" |

## Allowed: cross-stack documentation

Multi-stack tables or detection maps with **at least two ecosystems
side-by-side** are documentation, not leakage. The linter's
auto-detect heuristic (Step 0.5 of the audit roadmap) skips a hit when
its ±2-line window contains patterns from a different ecosystem family
(`php_family` vs `js_family` vs `python_family`).

Example (allowed):

```
- PHP/Composer project → `composer.json` present
- Node project        → `package.json` present
- Python project      → `pyproject.toml` present
```

## Allowed: carve-out pointers

A generic artifact may end a section with a one-line handoff to its
framework-specific peers. Canonical shape:

```
→ Laravel-specific: see [laravel-validation](../skills/laravel-validation/SKILL.md)
→ Next.js-specific: see [nextjs-patterns](../skills/nextjs-patterns/SKILL.md)
```

The pointer is a link, not a procedure — the generic artifact never
inlines stack-specific code.

## Enforcement

`scripts/lint_framework_leakage.py` runs in `task ci-fast` and `task
ci`. Exit codes:

- `0` — no hits, or every hit is auto-detected as cross-stack, or
  every hit is allowlisted in
  `scripts/lint_framework_leakage_allowlist.json` with a `reason`.
- `1` — at least one hit in a generic artifact (non-carve-out) that
  is neither cross-stack nor allowlisted.

The linter is intentionally noisy on first introduction — the audit
roadmap drives hits to zero phase by phase.

## See also

- [`roadmap-ci-steps-policy`](roadmap-ci-steps-policy.md) — sibling
  Tier-2a rule that drove this pattern.
- [`skill-quality`](skill-quality.md) — every skill must remain
  executable; carve-outs must still pass skill-quality.
- [`scope-control`](scope-control.md) — neutralizing a skill is not
  a refactor pretext; only touch the leaking sentences.
