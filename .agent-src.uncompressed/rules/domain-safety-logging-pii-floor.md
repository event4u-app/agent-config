---
type: "auto"
tier: "2a"
description: "Writing logging code, structured logger configuration, or log-line generation — refuse to log raw PII; require redaction at the logger or structured-field allowlist"
source: package
triggers:
  - keyword: "log"
  - keyword: "logger"
  - keyword: "logging"
  - keyword: "Sentry"
  - keyword: "Datadog"
  - keyword: "structured log"
  - phrase: "log the user"
  - phrase: "log the request"
routes_to:
  - "skill:logging-monitoring"
  - "skill:secrets-management"
applies_to_user_types:
  - "all"
---

# Domain Safety — Logging PII Floor

## Iron Law

```
NO RAW EMAIL, NAME, PHONE, ADDRESS, TOKEN, OR PAYMENT IDENTIFIER
EVER REACHES THE LOG STREAM. REDACT AT THE LOGGER OR USE A
STRUCTURED-FIELD ALLOWLIST.
```

Logs are the most common PII-leak surface in modern apps: developers log "the user object" or "the full request" during debugging and ship it to staging or prod where it lands in Datadog / Sentry / CloudWatch — three more systems with three more breach surfaces. The fix is architectural: redact at the logger boundary, never at the call site.

## Required patterns when logging touches user data

1. **Allowlisted structured fields only.** Log `user_id`, `tenant_id`, `request_id`, `event_type` — never `user` or `request` blobs.
2. **Logger-level redaction.** Configure the logger to scrub `email`, `phone`, `name`, `address`, `token`, `password`, `card_number`, `iban` keys recursively from any payload.
3. **No raw exception payloads.** Exceptions captured by Sentry / Bugsnag must scrub the request body before send. Use the SDK's `before_send` hook.
4. **No log-and-forget for auth flows.** Login / password-reset / token-mint logs never include the credential itself, only the actor + outcome.

## Refuse to write

- `logger.info("User logged in: $request->all()")` — refuse + show allowlisted version.
- `Log::info($user)` — refuse + show `Log::info('user.login', ['user_id' => $user->id])`.
- `console.log(req.body)` for any auth / billing / customer endpoint — refuse + show scrubbed alternative.

## Companion: secrets

Tokens, API keys, and webhook secrets follow the same rule under `skill:secrets-management`. Logging code that touches credentials triggers both rules — the allowlist + scrubbing approach satisfies both.

## See also

- `skill:logging-monitoring` — logger architecture.
- `skill:secrets-management` — credential handling.
- `domain-safety-export-redact` — companion when data leaves via export.
