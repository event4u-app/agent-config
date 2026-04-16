# Security Guidelines

> Security conventions — authentication, authorization, input validation, SQL injection, XSS, CSRF, headers.

**Related Skills:** `security`, `laravel-validation`
**Related Guidelines:** [validations.md](validations.md)

## Authentication

- Check `tymon/jwt-auth` or `laravel/sanctum` in `composer.json`.
- Check `config/auth.php` for guards and providers.
- API: JWT tokens or API keys (depending on endpoint).
- Customer identification after auth — see `multi-tenancy` skill.

## Authorization (Policies)

```php
// In FormRequest
public function authorize(): bool
{
    return $this->user()->can('view', $this->route('project'));
}

// In Controller
$this->authorize('update', $project);
```

- Create policies in `app/Policies/`.
- Register in `AuthServiceProvider` (if not auto-discovery).
- Check `agents/gates.md` for custom gates.

## Input Validation

- Always use FormRequest classes — never validate in controllers.
- Be specific: types, lengths, formats.
- Never trust client-side validation.

```php
// ✅ Strict
'email' => ['required', 'email:rfc,dns', 'max:255'],
'amount' => ['required', 'decimal:0,2', 'min:0', 'max:999999.99'],
```

## SQL Injection Prevention

- Always use Eloquent or Query Builder (parameterized by default).
- Never concatenate user input into raw SQL.
- Use `DB::raw()` only for expressions, never with user input.

## XSS Prevention

- API: use API Resource classes (no HTML rendering).
- Blade: `{{ }}` (escaped) — never `{!! !!}` with user input.
- Sanitize HTML input for rich text (`htmlpurifier`).

## CSRF

- API routes excluded (token-based auth).
- Web routes have CSRF via `VerifyCsrfToken` middleware.

## Rate Limiting

- Apply to auth endpoints (login, password reset).
- Use `throttle:` middleware on sensitive routes.
- Check `RouteServiceProvider` or `bootstrap/app.php` for definitions.

## Sensitive Data

- Never log passwords, tokens, API keys.
- `encrypt()` / `decrypt()` for sensitive data at rest.
- Environment variables for secrets — never hardcode.

## Security Headers

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Project-specific |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

Set in middleware — not in individual controllers. CORS: `config/cors.php`.

## Session Security

- `httpOnly` and `secure` flags on cookies.
- `SameSite=Lax` or `Strict`.
- Regenerate session ID after login.

## Mass Assignment

```php
// ✅ Only validated data
$project = Project::create($request->validated());

// ❌ Dangerous
$project = Project::create($request->all());
```

## Do NOT

- Bypass FormRequest validation.
- Use `$request->all()` for mass assignment.
- Disable CSRF for web routes.
- Store plaintext passwords/secrets.
- Expose internal error details in production.
- Trust `X-Forwarded-For` without proxy config.
- Use `md5()`/`sha1()` for password hashing.
- Store tokens in localStorage — use httpOnly cookies.
