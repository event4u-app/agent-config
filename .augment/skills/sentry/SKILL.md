---
name: sentry
description: "Use when the user shares a Sentry URL, says "check Sentry", or wants to investigate production errors. Uses Sentry MCP tools for deep analysis."
source: package
---

# Sentry Skill

## When to use

Sentry investigation, error patterns, MCP tools, error reporting/breadcrumbs, alerts.

## Available MCP tools

### Issue investigation

| Tool | Purpose |
|---|---|
| `get_issue_details` | Full issue details: stacktrace, tags, metadata |
| `get_issue_tag_values` | Distribution by tag (browser, URL, environment, user) |
| `search_issues` | Find issues by criteria (unresolved, critical, etc.) |
| `search_events` | Count/aggregate events, find individual error logs |
| `search_issue_events` | Filter events within a specific issue |
| `analyze_issue_with_seer` | AI root cause analysis with code fix suggestions |

### Context tools

| Tool | Purpose |
|---|---|
| `get_trace_details` | Trace overview for performance issues |
| `get_event_attachment` | Download screenshots, logs attached to events |
| `find_organizations` | Find org slug (needed for most queries) |
| `find_projects` | Find project slug |
| `find_releases` | Check recent releases and deploy timing |

## Investigation workflow

### 1. Get issue details

From a Sentry URL:
```
get_issue_details(issueUrl='https://sentry.io/issues/PROJECT-123/')
```

From an issue ID:
```
get_issue_details(organizationSlug='my-org', issueId='PROJECT-123')
```

### 2. Analyze the stacktrace

- **Top frame** = where it crashed
- **Bottom frame** = entry point (HTTP request, job, command)
- Read each file in the call chain using `codebase-retrieval`
- Identify where data becomes invalid or assumptions break

### 3. Check distribution

```
get_issue_tag_values(issueId='PROJECT-123', tagKey='environment')
get_issue_tag_values(issueId='PROJECT-123', tagKey='url')
get_issue_tag_values(issueId='PROJECT-123', tagKey='browser')
```

Useful tags: `environment`, `url`, `browser`, `os`, `release`, `user`, `device`

### 4. Check frequency and timing

```
search_events(organizationSlug='my-org', naturalLanguageQuery='count of errors for PROJECT-123 in last 7 days')
```

### 5. AI analysis (if needed)

```
analyze_issue_with_seer(issueUrl='https://sentry.io/issues/PROJECT-123/')
```

Only use when you cannot determine the root cause from the stacktrace alone.

## Error reporting in code

### MonitoringHelper (project convention)

Always use the project's `MonitoringHelper` — never the Sentry SDK directly:

```php
// ✅ Correct
MonitoringHelper::captureException($exception);

// ❌ Wrong
\Sentry\captureException($exception);
```

### Breadcrumbs

Use project enums for structured breadcrumbs:

```php
use App\Enums\Sentry\BreadcrumbType;
use App\Enums\Sentry\BreadcrumbLevel;
```

### Context

Check the project for Sentry context enums and the tenant switching service that sets context automatically.

## Common error patterns

| Pattern | Root cause | Fix approach |
|---|---|---|
| `TypeError: null passed to non-nullable` | Missing null check on optional DB column | Add null guard or make parameter nullable |
| `ModelNotFoundException` | Deleted or missing related record | Add `optional()` or existence check |
| `ConnectionException` | Multi-tenant DB switch failed | Check tenant switching service flow |
| `ValidationException` in jobs | Job data changed between dispatch and execution | Re-validate in `handle()` |
| `Undefined array key` | External API/import data missing expected field | Add `array_key_exists()` or null coalescing |

## Search patterns

### Find issues by criteria

```
search_issues(organizationSlug='my-org', naturalLanguageQuery='unresolved errors in production last 24h')
search_issues(organizationSlug='my-org', naturalLanguageQuery='errors affecting more than 100 users')
search_issues(organizationSlug='my-org', naturalLanguageQuery='issues assigned to me')
```

### Count events

```
search_events(organizationSlug='my-org', naturalLanguageQuery='how many errors today')
search_events(organizationSlug='my-org', naturalLanguageQuery='count of database failures this week')
```

## Related: `logging-monitoring`, `bug-analyzer`, `/bug-investigate`, `config/sentry.php`.

## Gotcha: same issue ≠ same root cause (check multiple events), check Events tab not just latest, UI link saves tokens over MCP.

## Do NOT: Sentry SDK directly (use MonitoringHelper), ignore errors, expose sensitive data in context.
