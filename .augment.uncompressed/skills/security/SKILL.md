---
name: security
description: "Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding."
source: package
---

# security

## When to use

Use this skill when implementing authentication, authorization, input validation, or any security-sensitive functionality.

## Before making changes

1. Read `agents/authentication.md` for the project's auth flow (JWT, session, API keys).
2. Read `agents/gates.md` for gate and policy patterns.
3. Read `agents/middleware.md` for security middleware stack.
4. Check existing policies in `app/Policies/` to match patterns.

## Authentication

### Detection

Check the project's auth setup:
- Look for `tymon/jwt-auth` or `laravel/sanctum` in `composer.json`.
- Check `config/auth.php` for guards and providers.
- Read `agents/authentication.md` for project-specific auth flows.

### API authentication

- API requests are authenticated via JWT tokens or API keys (depending on the endpoint).
- The `Authenticate` middleware validates tokens and resolves the current user.
- Customer identification happens after auth — see `multi-tenancy` skill.

## Authorization (Policies)

### Existing policies

Policies live in `app/Policies/` and follow Laravel conventions:

```php
final class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        // Authorization logic
    }
}
```

### Creating new policies

1. Create the policy class in `app/Policies/`.
2. Register it in `AuthServiceProvider` (if not using auto-discovery).
3. Use it in the controller or FormRequest:

```php
// In FormRequest
public function authorize(): bool
{
    return $this->user()->can('view', $this->route('project'));
}

// In Controller
$this->authorize('update', $project);
```

### Gates

Check `agents/gates.md` for custom gates that don't map to a model.

## Input validation

- **Always use FormRequest classes** — never validate in controllers.
- **Sanitize all user input** — use Laravel's validation rules.
- **Never trust client-side validation** — always validate server-side.
- **Use explicit validation rules** — be specific about types, lengths, formats.

```php
// ✅ Strict validation
'email' => ['required', 'email:rfc,dns', 'max:255'],
'amount' => ['required', 'decimal:0,2', 'min:0', 'max:999999.99'],

// ❌ Too loose
'email' => ['required', 'string'],
'amount' => ['required', 'numeric'],
```

## SQL injection prevention

- **Always use Eloquent or Query Builder** — parameterized queries by default.
- **Never concatenate user input into raw SQL.**
- **Use `DB::raw()` carefully** — only for expressions, never with user input.
- **Use `whereIn()` with arrays** — not manual string building.

## XSS prevention

- **API responses:** Use API Resource classes — they don't render HTML.
- **Blade views:** Use `{{ }}` (escaped) — never `{!! !!}` with user input.
- **Sanitize HTML input** if rich text is needed (e.g., `htmlpurifier`).

## CSRF protection

- **API routes** are excluded from CSRF (they use token-based auth).
- **Web routes** automatically have CSRF protection via `VerifyCsrfToken` middleware.

## Rate limiting

- Check `app/Providers/RouteServiceProvider.php` or `bootstrap/app.php` for rate limiter definitions.
- Apply rate limiting to auth endpoints (login, password reset).
- Use `throttle:` middleware on sensitive routes.

## Sensitive data

- **Never log passwords, tokens, or API keys.**
- **Use `encrypt()` / `decrypt()`** for sensitive data at rest.
- **Use environment variables** for secrets — never hardcode.
- **Check `EncryptedClientSoftwareConfigurationCast`** for the pattern used in this project.

## Security headers

Essential headers for web responses:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Prevent clickjacking |
| `X-XSS-Protection` | `0` | Disable browser XSS filter (use CSP instead) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Content-Security-Policy` | Project-specific | Prevent XSS, data injection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |

- CORS configuration: `config/cors.php`.
- Set headers in middleware — not in individual controllers.

## Session security

- Use `httpOnly` and `secure` flags on session cookies.
- Set `SameSite=Lax` or `Strict` to prevent CSRF.
- Regenerate session ID after login: `$request->session()->regenerate()`.
- Set appropriate session lifetime in `config/session.php`.

## Mass assignment protection

```php
// ✅ Only use validated data
$project = Project::create($request->validated());

// ❌ Dangerous — allows any field
$project = Project::create($request->all());

// ✅ Explicit fields
$project->update($request->only(['title', 'description', 'status']));
```


## Adversarial review

For security-sensitive changes, run the **`adversarial-review`** skill.
Focus on the "Security-sensitive changes" attack questions: Attack surface? Trusting user input? Authorization gaps?

## Auto-trigger keywords

- security
- authentication
- authorization
- CSRF
- XSS
- policy

## Gotcha

- Don't log passwords, tokens, or API keys — even in debug mode or error contexts.
- The model tends to trust user input after validation — validation ensures format, not intent.
- `Gate::authorize()` throws, `Gate::allows()` returns bool — choose based on your error handling strategy.
- Rate limiting must be applied to ALL public endpoints — not just login.

## Do NOT

- Do NOT bypass FormRequest validation in controllers.
- Do NOT use `$request->all()` for mass assignment — use `$request->validated()`.
- Do NOT disable CSRF protection for web routes.
- Do NOT store plaintext passwords or secrets in the database.
- Do NOT expose internal error details in API responses (use generic messages in production).
- Do NOT trust `X-Forwarded-For` headers without proper proxy configuration.
- Do NOT skip security headers in web responses.
- Do NOT use `md5()` or `sha1()` for password hashing — use `bcrypt` or `argon2`.
- Do NOT store API keys or tokens in localStorage — use httpOnly cookies.
