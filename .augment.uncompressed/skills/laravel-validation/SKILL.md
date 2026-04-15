---
name: laravel-validation
description: "Use when writing validation logic — Form Requests, rules, custom rule objects, and request-boundary design with strong correctness."
source: package
---

# laravel-validation

## When to use

Use when creating FormRequests, validation rules, or custom rule objects.

Do NOT use when:
- Authorization logic only (use `security` skill)
- API response format (use `api-design` skill)

## Procedure: Create a FormRequest

### Step 0: Inspect

1. Check existing FormRequests — match style, naming, authorization, rule structure.
2. Check existing custom rules — reuse before creating new ones.
3. Check API error response format — match it.

### Step 1: Create the class

1. Name: `{Action}{Entity}Request` — e.g. `CreateProjectRequest`.
2. Implement `authorize()` using Policies.
3. Implement `rules()` with array syntax — never pipe-separated.
4. Use `prepareForValidation()` only when normalization is truly necessary.

### Step 2: Rules

1. Use Laravel's `Illuminate\Validation\Rules` classes where possible.
2. Keep rules explicit — prefer clarity over cleverness.
3. For nested arrays: validate structure AND leaf values.
4. Extract custom rule objects for complex/reusable logic.

### Step 3: Test

- Test required fields, invalid formats, boundary conditions, conditional rules.
- Test authorization where relevant.
- Use focused tests per validation concern.

## Conventions

→ See guideline `php/validations.md` for array syntax, route params, property mapping, custom rules.

## Gotcha

- `required` ≠ not `nullable` — `required` means present, `nullable` means value can be null.
- Custom Rule objects must return `$fail` callback, not throw exceptions.
- Don't validate data you already trust (e.g., from a verified internal service).

## Do NOT

- Do NOT validate in controllers — use FormRequest classes.
- Do NOT use `$request->all()` — use `$request->validated()`.
- Do NOT put business logic in validation classes.

## Auto-trigger keywords

- validation
- Form Request
- validation rules
- custom rule
