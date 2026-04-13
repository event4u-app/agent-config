---
name: security
description: "Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding."
---

# security

## When to use

Auth, authorization, input validation, security-sensitive code.

## Before: `agents/authentication.md`, `agents/gates.md`, `agents/middleware.md`, existing policies in `app/Policies/`.

## Authentication

Detect: `tymon/jwt-auth` or `laravel/sanctum` in composer.json, `config/auth.php`, `agents/authentication.md`. API: JWT/API keys → Authenticate middleware → customer identification (see `multi-tenancy`).

## Authorization (Policies)

Policies in `app/Policies/`, register in AuthServiceProvider (or auto-discovery). Use in FormRequest (`$this->user()->can()`) or Controller (`$this->authorize()`). Gates: `agents/gates.md`.

## Validation: FormRequests always, specific rules (`email:rfc,dns`, `decimal:0,2`), never trust client-side.

## SQL injection: Eloquent/Query Builder. Never concatenate user input. `DB::raw()` only for expressions.

## XSS: `{{ }}` (escaped) in Blade, API Resources. Never `{!! !!}` with user input.

## CSRF: API excluded (token auth), web auto-protected. Rate limiting: auth endpoints + sensitive routes.

## Sensitive data: never log secrets, `encrypt()`/`decrypt()`, env vars. Headers: nosniff, DENY/SAMEORIGIN, HSTS, CSP. Sessions: httpOnly, secure, SameSite, regenerate after login.

## Mass assignment: `$request->validated()` only. Never `$request->all()`.

## Security changes: run `adversarial-review`.

## Gotcha: never log secrets, validation ≠ intent, `authorize()` throws vs `allows()` returns bool, rate limit ALL public endpoints.

## Do NOT: bypass FormRequest, `$request->all()`, disable CSRF, plaintext secrets, expose internal errors, trust X-Forwarded-For, skip headers, md5/sha1 for passwords, localStorage for tokens.
