---
name: laravel-validation
description: "Use when writing validation logic — Form Requests, rules, custom rule objects, and request-boundary design with strong correctness."
source: package
---

# laravel-validation

## When to use

FormRequests, rules, custom rules, auth, nested/conditional/API/file validation. Extends `coder`, `laravel`.

## Before: base skills, inspect existing FormRequests, understand input boundary, check custom rules, error style, tests.

## Principles: validation at request boundary, FormRequests for non-trivial, explicit rules, separate from business logic.

## FormRequests: `authorize()` per convention, `rules()` focused, `prepareForValidation()` only when necessary. No business workflows.

## Rules: explicit over clever, reuse built-in, group logically, extract custom objects when complex/reusable. Inline only for truly small cases.

## Conditional: readable conditions, avoid tangled sets. Nested: explicit keys, validate structure+values. Files: type/size/presence, don't trust client metadata. Custom rules: validation only, no side effects.

## Normalization: only for correctness, predictable, no business decisions. Auth boundary: separate from validation.

## API: match existing error response structure, consistent across endpoints.

## Testing: required fields, invalid formats, boundaries, conditionals, auth. Focused tests.

## Gotcha: `required` ≠ opposite of `nullable`, FormRequests not controllers, custom rules use `$fail` not exceptions, don't validate trusted data.

## Do NOT: validate in controllers, `$request->all()`, skip API validation, business logic in validation, custom rules when built-in works.
