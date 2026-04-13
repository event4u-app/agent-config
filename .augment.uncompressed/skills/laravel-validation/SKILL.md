---
name: laravel-validation
description: "Use when writing validation logic — Form Requests, rules, custom rule objects, and request-boundary design with strong correctness."
---

# laravel-validation

## When to use

Use this skill for Laravel request validation and input constraint design, especially when working with:

- Form Requests
- Validation rules
- Custom rule objects
- Request authorization
- Nested input validation
- Conditional validation
- API request validation
- File upload validation
- Validation refactoring

This skill extends `coder` and `laravel`.

## Before writing code

1. **Read the base skills first** — apply `coder` and `laravel`.
2. **Inspect existing Form Requests** — match style, naming, authorization handling, and rule structure.
3. **Understand the input boundary** — determine what comes from HTTP and what belongs to later application layers.
4. **Check existing custom rules** — reuse them before creating new ones.
5. **Inspect validation error style** — especially in APIs with established response conventions.
6. **Review related tests** — validation rules should align with existing testing patterns.

## Core principles

- Validation belongs at the request boundary.
- Prefer Form Requests for non-trivial request validation.
- Keep rules explicit and readable.
- Separate validation from business processing.
- Authorization and validation should be intentionally placed and easy to understand.

## Form Request rules

- Use Form Requests for reusable or non-trivial validation.
- Put request authorization into `authorize()` when that matches project conventions.
- Keep `rules()` focused on input constraints.
- Use `prepareForValidation()` only when input normalization is truly necessary.
- Do not overload Form Requests with business workflows.

## Rule design rules

- Prefer clear, explicit rules over clever compact expressions.
- Reuse built-in Laravel rules when they are sufficient.
- Group related rules logically.
- Keep nested array validation understandable.
- Extract custom rule objects when validation logic becomes complex or reusable.

## Inline vs Form Request guidance

- Use inline validation only for small, truly local cases when the project allows it.
- Prefer Form Requests when:
    - the validation is reused
    - the request is complex
    - authorization is involved
    - nested structures exist
    - custom messages/attributes matter

## Conditional validation rules

- Use Laravel's conditional validation features intentionally.
- Keep conditions readable and predictable.
- Avoid deeply tangled conditional rule sets.
- When conditions become complex, consider normalization plus clearer rule composition.

## Nested and array input rules

- Be explicit with nested keys and wildcard rules.
- Validate structure as well as leaf values.
- Keep large nested payload rules well organized.
- Do not accept loosely structured input when the shape matters.

## File validation rules

- Validate file presence, type, size, and other relevant constraints explicitly.
- Match project conventions for uploads and media handling.
- Do not trust client-provided metadata alone.
- Keep upload validation aligned with downstream processing expectations.

## Custom rule rules

- Create custom rule objects when:
    - logic is reused
    - domain-specific validation is needed
    - readability improves
- Keep custom rules focused on validation only.
- Do not hide large external side effects inside validation rules.

## Input normalization rules

- Normalize input only when it improves correctness and consistency.
- Keep normalization predictable.
- Do not transform input so heavily that the original request behavior becomes surprising.
- Avoid mixing normalization and business decisions.

## Authorization boundary rules

- Use request authorization, policies, or gates consistently with project conventions.
- Do not mix role/business authorization logic directly into validation rules.
- Keep authorization failure and validation failure conceptually separate.

## API validation rules

- Respect the existing API error response structure.
- Keep validation behavior consistent across endpoints.
- Do not introduce a new validation response shape in an established API.

## Testing rules

- Test important validation behavior explicitly.
- Cover:
    - required fields
    - invalid formats
    - boundary conditions
    - conditional rules
    - authorization where relevant
- Prefer focused tests over giant invalid-payload tests unless the project already uses that style.

## What NOT to do

- Do not put business logic into validation classes.
- Do not scatter complex validation across controllers.
- Do not create custom rules when built-in rules are enough.
- Do not mix authorization decisions into unrelated validation conditions.
- Do not overuse input normalization.
- Do not accept vague nested payloads when structure matters.

## Output expectations

When generating Laravel validation code:

- prefer Form Requests for non-trivial validation
- keep rules explicit and readable
- separate validation, authorization, and business logic
- reuse built-in and existing custom rules where possible
- validate nested input carefully
- match the project's validation and API error conventions


## Gotcha

- `required` and `nullable` are not opposites — `required` means the field must be present, `nullable` means the value can be null.
- The model tends to validate in the controller instead of using FormRequests — always use FormRequests.
- Custom Rule objects must return the `$fail` callback, not throw exceptions.
- Don't validate data you already trust (e.g., data from a verified internal service).

## Do NOT

- Do NOT validate in controllers — use FormRequest classes.
- Do NOT use $request->all() — use $request->validated().
- Do NOT skip validation for API endpoints.

## Auto-trigger keywords

- validation
- Form Request
- validation rules
- custom rule
