# Data Sensitivity

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/contexts/data-sensitivity.md` in the consumer project
  and fill in. This is the canonical reference for what data leaves the
  system (logs, error reports, analytics, third-party APIs) and what
  MUST be masked.

  Delete this HTML comment after filling in.
-->

## Classification levels

<!-- Keep or adapt these; remove tiers that do not apply. -->

| Level | Meaning | Examples | Handling |
|---|---|---|---|
| **public** | safe to log, render, expose | module names, status codes | no restriction |
| **internal** | safe in server-side logs, not in responses | user IDs, tenant slugs | never render to unauthenticated clients |
| **confidential** | masked in logs, error reports, analytics | emails, IP addresses, names | always mask in logs and Sentry |
| **secret** | must never leave the process | passwords, tokens, API keys | encrypted at rest; never logged |

## Field inventory

<!--
  List every persistent field that is NOT `public`. Missing fields are
  treated as `public` by default — so an unlisted column is effectively
  a leak-by-omission.
-->

| Table / model | Field | Level | Masking rule | Notes |
|---|---|---|---|---|
| `users` | `email` | confidential | redact middle portion → `a***@example.com` | … |
| `users` | `password` | secret | never log, even redacted | hashed in DB |
| … | … | … | … | … |

## Log-safe types

<!-- Document the helpers and conventions used to mask fields in log output. -->

- **Logging helper / decorator:** <!-- e.g., `loggable()` trait, `SafeString` value object -->
- **Sentry beforeSend hook:** <!-- where, and which fields it strips -->
- **Structured log fields that MUST NOT contain confidential data:**
  <!-- e.g., `request.body`, `exception.message` -->

## Known leak points (regression watchlist)

<!--
  Places where confidential data has leaked before. A reviewer reads
  this list before approving changes to: loggers, error handlers, admin
  exports, third-party integrations, webhook payloads.
-->

- …

## See also

- `agents/contexts/auth-model.md` — who can see what
- `agents/contexts/observability.md` — how logs are routed
