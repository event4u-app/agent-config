# Framework Neutrality — Patterns

> Forbidden-pattern table, cross-stack documentation allowance, and carve-out pointer shape for the `framework-neutrality-in-generic-skills` rule

_Origin: migrated from `src/rules/framework-neutrality-in-generic-skills.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, scope, and exemption list stay in the rule; this file carries the pattern reference._

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
auto-detect heuristic skips a hit when its ±2-line window contains
patterns from a different ecosystem family (`php_family` vs
`js_family` vs `python_family`).

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
→ Laravel-specific: see [laravel-validation](../../../src/skills/laravel-validation/SKILL.md)
→ Next.js-specific: see [nextjs-patterns](../../../src/skills/nextjs-patterns/SKILL.md)
```

The pointer is a link, not a procedure — the generic artifact never
inlines stack-specific code.

## Enforcement

`scripts/lint_framework_leakage.ts` runs in the package CI pipeline.
Exit codes:

- `0` — no hits, or every hit is auto-detected as cross-stack, or
  every hit is allowlisted in
  `scripts/lint_framework_leakage_allowlist.json` with a `reason`.
- `1` — at least one hit in a generic artifact (non-carve-out) that
  is neither cross-stack nor allowlisted.

## See also

- `framework-neutrality-in-generic-skills` (rule) — Iron Law, scope, exemption list.
- `roadmap-ci-steps-policy` — sibling Tier-2a rule that drove this pattern.
- `skill-quality` — every skill must remain executable; carve-outs must still pass skill-quality.
