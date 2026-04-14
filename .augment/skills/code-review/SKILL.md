---
name: code-review
description: "Use when the user says "review this", "check my code", or wants feedback on changes. Reviews for correctness, quality, security, and coding standards."
source: package
---

# code-review

## When to use

PR review, self-review, responding to feedback, "review"/"check" code changes.

## Review order

1. Goal → 2. Architecture → 3. Correctness → 4. Quality → 5. Security → 6. Performance → 7. Tests → 8. Conventions

Mindset: thorough but pragmatic, understand intent first, check full picture, assume good intent.

## Review checklist

### Code quality

| Check | What to look for |
|---|---|
| **Strict types** | `declare(strict_types=1)` in new files, typed properties/params/returns |
| **PSR-12** | Coding style, line length ≤120, trailing commas, Yoda comparisons |
| **Naming** | Clear, descriptive names. `camelCase` vars, `snake_case` array keys, `UPPER_SNAKE` constants |
| **Early returns** | No deep nesting. Guard clauses at the top. |
| **Single responsibility** | Each class/method does one thing. Controllers are thin. |
| **No magic** | No magic properties on models (use getters/setters). No `$request->input()` without FormRequest. |
| **PHPDoc** | Only where type hints are insufficient (generics, complex arrays). No redundant docblocks. |

### Architecture

| Check | What to look for |
|---|---|
| **Layer separation** | Business logic in services, not controllers. Models have no business logic. |
| **Single-action controllers** | New controllers use `__invoke()`. No multi-action controllers. |
| **FormRequest** | Every controller has a dedicated FormRequest. No inline `$request->validate()`. |
| **API Resources** | Controllers return Resources, never raw models or `response()->json()`. |
| **DTOs** | Structured data transfer between layers, not raw arrays. |
| **Dependency injection** | Constructor injection, no `new Service()` or `app()` calls in business logic. |

### Database & Performance

| Check | What to look for |
|---|---|
| **N+1 queries** | Relationship access in loops without eager loading |
| **Missing indexes** | New columns used in WHERE/JOIN without index |
| **Unbounded queries** | `Model::all()` or queries without pagination/limit |
| **Raw SQL** | Parameterized queries only. No string concatenation with user input. |
| **Migrations** | Reversible (has `down()`). Correct connection. Correct table prefix. |
| **Money** | Uses `decimal` or `Math` helper, never `float` |

### Security

| Check | What to look for |
|---|---|
| **Authorization** | Policy check in FormRequest or middleware. No unprotected endpoints. |
| **Input validation** | All user input validated via FormRequest rules. |
| **Mass assignment** | No `$model->fill($request->all())` without `$fillable`/`$guarded`. |
| **SQL injection** | No raw queries with unescaped user input. |
| **XSS** | Blade output escaped (`{{ }}` not `{!! !!}`) unless intentional. |
| **Sensitive data** | No secrets, tokens, or passwords in code or logs. |

### Tests

| Check | What to look for |
|---|---|
| **Coverage** | New code paths have tests. Bug fixes have regression tests. |
| **Test quality** | Tests verify behavior, not implementation details. |
| **Pest syntax** | Correct Pest conventions. No `readonly`/`final` on test classes. |
| **Seeders** | Test data via seeders (or factories where allowed). |
| **Assertions** | Meaningful assertions. Not just "no exception thrown". |
| **Flaky risks** | Time-dependent tests use `travel()`. No reliance on execution speed. |

## Before PR: quality pipeline (PHPStan → Rector → ECS → PHPStan) → tests → CI → self-review diff.

## Receiving feedback

READ → UNDERSTAND → VERIFY → EVALUATE → RESPOND → IMPLEMENT. Unclear → STOP, don't implement.

No performative agreement ("Great point!"). Just: "Fixed." / "Updated — [what changed]."

**Internal team:** implement after understanding. **External/bot:** verify for THIS codebase, YAGNI check, check context.

**Push back when:** breaks functionality, lacks context, YAGNI, incorrect for stack, conflicts with architecture. Use technical reasoning.

**PR comments:** list all → categorize (blocking→simple→complex) → clarify → fix one at a time → reply in thread.

## Output: 🔴 Blocker → 🟡 Suggestion → 🟢 Nit. Focus on logic/architecture, not linter issues.

## Before PR: run `adversarial-review` skill.

## Gotcha: don't rewrite working code, stay in scope, "I'd prefer X" not valid unless prevents bug, check for tests.

## Do NOT: approve without reading, agree without verifying, performative language, nitpick style, merge without CI green.
