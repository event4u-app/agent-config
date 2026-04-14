---
name: security-audit
description: "ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work."
source: package
---

# security-audit

## When to use

Proactive security audit, codebase/module risks, pre-release checks. NOT for: writing secure code (`security`), bugs (`bug-analyzer`), perf (`performance-analysis`).

## Workflow

1. **Map attack surface:** HTTP params/headers/cookies, file uploads, API payloads, webhooks, queue payloads, imports, URLs
2. **Trace trust boundaries:** Input → Controller → Validation → Service → DB/File — sanitized? complete? safe?

### 3. Check vulnerability categories

| Category | What to look for |
|---|---|
| **SQL Injection** | Raw queries with concatenation, missing parameter binding |
| **XSS** | Unescaped output in Blade (`{!! !!}`), JSON responses with HTML |
| **CSRF** | Missing middleware, API endpoints without token verification |
| **Auth bypass** | Missing policy checks, broken gate logic, `withoutMiddleware()` |
| **IDOR** | Direct object access without ownership verification |
| **Mass assignment** | Missing `$fillable`/`$guarded`, `request()->all()` in create/update |
| **File upload** | Missing type validation, path traversal, executable uploads |
| **SSRF** | User-controlled URLs passed to HTTP client |
| **Deserialization** | Unserializing user input, unsafe queue payloads |
| **Secret exposure** | Hardcoded credentials, secrets in logs, `.env` in public dir |
| **Rate limiting** | Missing throttle on auth endpoints, password reset, API |
| **Header injection** | User input in response headers, email headers |

4. **Laravel-specific:** `env()` outside config, APP_DEBUG in prod, missing $fillable, Route::any(), missing rate limiting, broadcast auth, cookie encryption.
5. **Dependencies:** `composer audit`, `npm audit`, known CVEs.

## Output: Vulnerability, Category (OWASP), Location, Severity, Exploitability, Impact, Evidence, Fix, Confidence.

## Related: `analysis-autonomous-mode`, `security`, `universal-project-analysis`, `bug-analyzer`.

## Gotcha: concrete attack vectors only, check if framework already mitigates, verify middleware/config.

## Do NOT: theoretical risks, ignore input flows, assume framework handles all, confuse quality with security, skip dep audit.
