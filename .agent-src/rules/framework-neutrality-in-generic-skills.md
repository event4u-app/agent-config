---
type: "auto"
tier: "2a"
description: "When editing a generic skill, rule, or command in .agent-src.uncompressed/ — block PHP/Laravel/Symfony as the only path. Generic artifacts must offer language-agnostic procedures with framework-specific carve-out pointers."
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

Generic skill/rule/command names *procedure*; carve-out names *stack*. Mix → leakage on triggers agent uses regardless of project.

## Scope

Fires on edits under `.agent-src.uncompressed/{skills,rules,commands}/`.

Exempt (name match): `laravel*`, `symfony*`, `nextjs*`, `react-*`, `^php-*`, `^pest-*`, `^eloquent`, `^blade*`, `^livewire`, `^flux`, `^artisan-*`, `^composer-*`, `^docker*`, `^aws-*`, `^grafana`, `^openapi$`, `^quality-tools`, `^sql-writing`, `^tailwind*`, `^terraform*`, `^terragrunt*`, `^traefik`, `^mobile-e2e`, `-routing$`, `project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)`.

## Forbidden patterns in generic artifacts

| Pattern | Why leaks | Fix |
|---|---|---|
| `FormRequest` mandate | Laravel-only validation | "request-validation primitive (FormRequest/zod/pydantic)" or carve-out to `laravel-validation` |
| `php artisan …` as canonical | Laravel CLI | "the framework's CLI" or carve-out to `artisan-commands` |
| `PHPStan` as only example | PHP-only static analyser | list peers (`mypy`, `tsc`) or carve-out to `quality-tools` |
| `composer.json` alone | PHP package manifest | add `package.json`/`pyproject.toml` peers or carve-out |
| `Eloquent`/`Model::…` | Laravel ORM | "project's ORM/data layer" or carve-out to `eloquent` |
| `Pest` as only test runner | PHP/Laravel test framework | list peers (`pytest`, `vitest`, `jest`) or carve-out to `pest-testing` |
| `Blade`/`Livewire`/`Flux` as default UI | Laravel view stack | "project's UI layer" or carve-out |
| `vendor/bin/<tool>` as canonical | PHP/Composer-specific path | "project's quality CLI" or carve-out |
| `Rector` as only refactor tool | PHP-only | list peers (`ts-morph`, `libcst`) or carve-out |
| "every/all controllers" | MVC PHP assumption | "every request handler"/"every endpoint" |

## Allowed: cross-stack documentation

Multi-stack tables with ≥2 ecosystems side-by-side = docs, not leakage. Linter auto-skips when ±2-line window contains different ecosystem family (`php_family` vs `js_family` vs `python_family`).

Example (allowed):

```
- PHP/Composer project → `composer.json` present
- Node project        → `package.json` present
- Python project      → `pyproject.toml` present
```

## Allowed: carve-out pointers

End a generic section with one-line handoff. Canonical:

```
→ Laravel-specific: see [laravel-validation](../skills/laravel-validation/SKILL.md)
→ Next.js-specific: see [nextjs-patterns](../skills/nextjs-patterns/SKILL.md)
```

Pointer = link, not procedure. Generic artifact never inlines stack-specific code.

## Enforcement

`scripts/lint_framework_leakage.py` runs in `task ci-fast` and `task ci`. Exit codes:

- `0` — no hits, or every hit auto-detected as cross-stack, or every hit allowlisted in `scripts/lint_framework_leakage_allowlist.json` with `reason`.
- `1` — at least one hit in a generic (non-carve-out) artifact, neither cross-stack nor allowlisted.

Linter noisy on first introduction — audit roadmap drives hits to zero phase by phase.

## See also

- [`roadmap-ci-steps-policy`](roadmap-ci-steps-policy.md) — sibling Tier-2a rule that drove this pattern.
- [`skill-quality`](skill-quality.md) — every skill stays executable; carve-outs still pass skill-quality.
- [`scope-control`](scope-control.md) — neutralizing ≠ refactor pretext; only touch leaking sentences.
