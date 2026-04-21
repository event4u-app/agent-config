---
name: security-audit
description: "ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work."
source: package
---

# security-audit

## Mission

Find real security vulnerabilities in code before they are exploited. This skill is
**proactive** — it audits code for security weaknesses, not just responds to incidents.

For writing secure code patterns (policies, auth, CSRF), use the `security` skill instead.

## When to use

Use this skill when:

- Auditing a codebase or module for security risks
- `analysis-autonomous-mode` routes here after detecting risky patterns
- Reviewing code that handles user input, authentication, or authorization
- Checking for vulnerabilities before a release or deployment

Do NOT use when:

* Writing new auth/policy code — route to [`security`](../security/SKILL.md)
* Hunting for functional bugs — route to [`bug-analyzer`](../bug-analyzer/SKILL.md) (proactive mode)
* Investigating performance — route to [`performance-analysis`](../performance-analysis/SKILL.md)
* You need a pre-implementation threat model for a new feature — route to
  [`threat-modeling`](../threat-modeling/SKILL.md)
* You need end-to-end authorization analysis for one route/action — route to
  [`authz-review`](../authz-review/SKILL.md)

## Procedure: Security audit

### 1. Map attack surface

Identify all entry points where untrusted data enters:

- HTTP request parameters, headers, cookies
- File uploads
- API payloads (JSON, XML, form data)
- Webhook callbacks
- Queue job payloads from external sources
- Import files (CSV, Excel, XML)
- URL path segments and query strings

### 2. Trace trust boundaries

For each entry point, trace where user input flows:

```
User Input → Controller → Validation → Service → DB/File/External
                 ↓              ↓           ↓
            Is it sanitized?  Complete?  Used safely?
```

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

### 4. Framework-specific checks

**Laravel:**
- `env()` in non-config files (leaks in debug mode)
- Debug mode (`APP_DEBUG=true`) in production
- Missing `$fillable` on models used with `request()->all()`
- `Route::any()` exposing unintended HTTP methods
- Missing rate limiting on login/register/password-reset
- Broadcast channels without proper authorization
- Missing encryption on sensitive cookie/session data

### 5. Dependency audit

- Check `composer.lock` for known vulnerable packages
- Check `package-lock.json` for frontend vulnerabilities
- Identify outdated packages with known CVEs
- Check if security patches are available

## Output format

For each vulnerability:

- **Vulnerability:** concise title
- **Category:** OWASP category (Injection, Broken Auth, etc.)
- **Location:** file and line
- **Severity:** Low / Medium / High / Critical
- **Exploitability:** How easy to exploit (trivial / requires auth / complex)
- **Impact:** What an attacker could achieve
- **Evidence:** code reference showing the weakness
- **Fix:** concrete mitigation
- **Confidence:** Low / Medium / High

## Integration with other skills

- **analysis-autonomous-mode** — routes here when security concerns are detected
- **security** — complementary: security is about writing secure code, this is about finding holes
- **universal-project-analysis** — provides context about packages and framework usage
- **bug-analyzer** — some bugs have security implications (chain when found)

## Gotcha

- Don't report theoretical vulnerabilities without a concrete attack vector — false positives erode trust.
- The model tends to flag framework-handled security as issues (e.g., Laravel's CSRF is already handled).
- Always check if a finding is already mitigated by middleware or configuration before reporting it.

## Do NOT

- Do NOT report theoretical risks that require impossible preconditions
- Do NOT ignore user input flows — always trace from entry to usage
- Do NOT assume frameworks handle everything — verify middleware and config
- Do NOT confuse code quality issues with security vulnerabilities
- Do NOT skip dependency checking — known CVEs are real risks
