---
name: security
description: "Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding."
source: package
---

# security

## When to use

Use when implementing authentication, authorization, or any security-sensitive functionality.

Do NOT use when:
- Validation logic only (use `laravel-validation` skill)
- Full security audit (use `security-audit` skill)

## Procedure: Implement security for a feature

### Step 0: Inspect

1. Read `agents/authentication.md` for auth flow.
2. Read `agents/gates.md` for gate/policy patterns.
3. Check existing policies in `app/Policies/`.

### Step 1: Authentication

- Check auth setup: `tymon/jwt-auth` or `laravel/sanctum`.
- Check `config/auth.php` for guards and providers.
- Customer identification happens after auth — see `multi-tenancy` skill.

### Step 2: Authorization

1. Create policy in `app/Policies/` if needed.
2. Use in FormRequest `authorize()` or controller `$this->authorize()`.
3. Check `agents/gates.md` for non-model gates.

### Step 3: Review for adversarial

For security-sensitive changes, run `adversarial-review` skill.
Focus on: attack surface, trusting user input, authorization gaps.

## Conventions

→ See guideline `php/security.md` for auth, SQL injection, XSS, CSRF, headers, session, mass assignment.

### Validate

- Verify all user input is validated via FormRequest before use.
- Confirm authorization check exists (Policy or Gate) for every state-changing action.
- Check that no raw user input reaches SQL, HTML output, or shell commands.
- Run PHPStan — must pass (catches type-safety issues that enable injection).

## Gotcha

- Validation ensures format, not intent — don't trust input after validation alone.
- `Gate::authorize()` throws, `Gate::allows()` returns bool — choose based on error handling.
- Rate limiting: ALL public endpoints, not just login.
- Never log passwords, tokens, or API keys.

## Do NOT

- Do NOT bypass FormRequest validation in controllers.
- Do NOT use `$request->all()` for mass assignment — use `$request->validated()`.
- Do NOT store plaintext passwords or secrets in the database.
- Do NOT expose internal error details in production API responses.

## Auto-trigger keywords

- security
- authentication
- authorization
- CSRF
- XSS
- policy
