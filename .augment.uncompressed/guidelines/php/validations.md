# Validation Guidelines

> Project-specific FormRequest conventions. Array syntax, route params, property mapping.

**Related Skills:** `laravel-validation`, `api-endpoint`
**Related Guidelines:** [controllers.md](controllers.md)

## Core Rules

- Every controller has a matching FormRequest: `{Action}{Entity}Request`
- Every FormRequest **must** have an `authorize()` method (using Policies)
- Validation messages **should** use translations (`__('validation.xxx')`)

## Rule Syntax

Always use **array syntax** for rules — never pipe-separated strings.

```php
// ✅ Good
'email' => ['required', 'email', 'max:60'],

// ❌ Bad
'email' => 'required|email|max:60',
```

Use Laravel's `Illuminate\Validation\Rules` classes when possible:

```php
// ✅ Good
'email' => [new Exists('connection.staff', 'email')],

// ❌ Bad
'email' => ['exists:connection.staff,email'],
```

## Route Parameters

Validate route parameters via `prepareForValidation()`:

```php
public function prepareForValidation(): void
{
    /** @var Project $project */
    $project = $this->route('project');

    $this->merge([
        'latitude' => $project->getLatitude(),
        'longitude' => $project->getLongitude(),
    ]);
}
```

## Property Mapping

When request keys differ from model properties, handle mapping in the FormRequest
(not in Controller or Service):

```php
// ✅ Best — FormRequest as single source of truth
public function prepareForValidation(): void
{
    $this->merge([
        'id' => $this->input('user_id'),
        'name' => $this->input('user_name'),
    ]);
    $this->offsetUnset('user_id');
    $this->offsetUnset('user_name');
}
```

## Inline vs FormRequest

- Inline: only for small, truly local cases.
- FormRequest: when validation is reused, complex, involves authorization, nested structures, or custom messages.

## Conditional Validation

- Use Laravel's conditional features intentionally.
- Keep conditions readable.
- Complex conditions → normalize first, then compose clearer rules.

## Nested and Array Input

- Be explicit with nested keys and wildcard rules.
- Validate structure as well as leaf values.
- Don't accept loosely structured input when shape matters.

## File Validation

- Validate presence, type, size explicitly.
- Don't trust client-provided metadata alone.
- Align with downstream processing expectations.

## Custom Rules

- Create custom rule objects when logic is reused or domain-specific.
- Keep custom rules focused on validation only — no side effects.
- Custom Rule objects must return `$fail` callback, not throw exceptions.

## Authorization Boundary

- Use `authorize()`, policies, or gates consistently.
- Keep authorization failure and validation failure conceptually separate.
- Don't mix role/business auth logic into validation rules.

## API Validation

- Respect existing API error response structure.
- Keep validation consistent across endpoints.
- Don't introduce a new validation response shape in an established API.

## Do NOT

- Validate in controllers — use FormRequests.
- Use `$request->all()` — use `$request->validated()`.
- Skip validation for API endpoints.
- Put business logic in validation classes.
- Create custom rules when built-in rules suffice.

