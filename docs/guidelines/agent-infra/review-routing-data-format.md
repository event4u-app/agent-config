# Review Routing Data Format

Schema and conventions for the two project-local YAML files that feed the
[`review-routing-awareness`](../../rules/review-routing-awareness.md) rule
and the [`review-routing`](../../skills/review-routing/SKILL.md) skill.

Both files are **optional** and live in the consumer repository — never
in package-shipped artifacts. Absence is handled gracefully: routing
falls back to generic role-based reviewer suggestions.

## File locations

Primary (checked first):

- `.github/ownership-map.yml`
- `.github/historical-bug-patterns.yml`

Fallback (checked if the `.github/` file does not exist):

- `agents/ownership-map.yml`
- `agents/historical-bug-patterns.yml`

Choose one location per project and stick with it. Having both is not an
error, but tools read only the first match.

## ownership-map.yml

Maps glob patterns → roles + optional focus + optional risk hint.

```yaml
# Required: the version field — breaks loudly if future schema changes.
version: 1

# Optional: last-reviewed timestamp. If > 6 months old, routing
# flags the map as stale in its report.
updated: 2026-02-01

# Optional: defaults applied when no entry matches. If omitted,
# unmatched paths fall through to reviewer-awareness defaults.
defaults:
  roles: [backend]

# Required: list of entries, first match wins per file.
entries:
  - paths:
      - "app/Billing/**"
      - "app/Services/Payment*.php"
    roles: [finance-engineering, security]
    focus: "tax calculation + idempotency"
    risk: "monetary correctness — regressions bill real customers"

  - paths:
      - "**/Tenant*.php"
      - "app/Http/Middleware/TenantScope.php"
    roles: [platform, security]
    focus: "cross-tenant isolation"
    risk: "data leak across customers"

  - paths:
      - "resources/views/**"
      - "**/*.blade.php"
    roles: [frontend]
    focus: "a11y + responsive layout"
```

Field semantics:

- **paths** (required, list) — fnmatch globs, same syntax as
  `pr-risk-config.yml`. First match wins; later entries are ignored for
  that path.
- **roles** (required, list) — role identifiers from the common
  vocabulary in [`reviewer-awareness`](../../rules/reviewer-awareness.md)
  or project-custom roles.
- **focus** (optional, string) — one-line description of what reviewers
  should look at. Surfaced in the PR comment verbatim.
- **risk** (optional, string) — one-line description of what goes wrong
  when this area breaks. Used by routing to annotate high-risk matches.

## historical-bug-patterns.yml

Registry of recurring failure modes. Each pattern names a class of bug
the project has paid for before, with the minimum control or test
expected for similar new work.

```yaml
version: 1
updated: 2026-02-01

patterns:
  - id: n-plus-one-tenant-listing
    label: "N+1 on tenant-scoped listings"
    severity: medium
    paths:
      - "app/Http/Controllers/**Listing*.php"
      - "app/Services/**Query*.php"
    required_test: "assert query count ≤ N for a multi-row fixture"
    references:
      - "PR #842 — production slowdown 2024-09"

  - id: missing-policy-on-admin-route
    label: "Admin-only route without Gate::allows"
    severity: high
    paths:
      - "app/Http/Controllers/Admin/**"
      - "routes/admin.php"
    required_test: "negative test: non-admin gets 403"

  - id: queue-job-not-idempotent
    label: "Queue job without idempotency key"
    severity: high
    paths:
      - "app/Jobs/**"
    required_test: "asserting a retried job does not double-write"
```

Field semantics:

- **id** (required, unique string) — stable slug; used in PR comments
  and tests as a label.
- **label** (required, string) — human-readable name.
- **severity** (required, `low` | `medium` | `high`) — matched patterns
  contribute this severity to overall PR routing.
- **paths** (required, list) — fnmatch globs. A pattern matches the
  diff when **any** changed file matches any glob.
- **required_test** (required, string) — the specific assertion or
  regression test the pattern demands. Feeds
  [`verify-before-complete`](../../rules/verify-before-complete.md) and
  [`judge-test-coverage`](../../skills/judge-test-coverage/SKILL.md).
- **references** (optional, list) — links to prior PRs, incidents, or
  postmortems. Agents quote these verbatim when warning about a match.

## Maintenance

- Both files are code. Review changes to them like code — PR + review.
- Stale is worse than absent. Update the `updated` field or delete the
  file when ownership or patterns have drifted.
- Never auto-generate entries from agent sessions. Entries are curated,
  not inferred.

## See also

- [`review-routing-awareness`](../../rules/review-routing-awareness.md)
- [`reviewer-awareness`](../../rules/reviewer-awareness.md)
- [`review-routing`](../../skills/review-routing/SKILL.md)
