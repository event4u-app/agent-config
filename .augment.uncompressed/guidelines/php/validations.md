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

