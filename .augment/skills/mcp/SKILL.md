---
name: mcp
description: "Use when working with MCP (Model Context Protocol) servers — their tools, capabilities, and best practices for effective agent workflows."
source: package
---

# MCP Skill

## When to use

MCP tool selection, combining tools in workflows, troubleshooting, building commands/skills referencing MCP.

## Available MCP Servers

### Sentry (`augment-partner-remote-mcp-sentry`)

Error tracking and performance monitoring.

| Tool | Purpose | When to use |
|---|---|---|
| `find_organizations` | Find org slug | First call — needed for all other Sentry tools |
| `find_projects` | Find project slug | When filtering by project |
| `find_teams` | Find team slug/ID | Team-based queries |
| `find_releases` | Recent releases | Check deploy timing, release versions |
| `get_issue_details` | Full issue: stacktrace, tags | Investigating a specific error |
| `get_issue_tag_values` | Distribution by tag | Analyzing who/what is affected |
| `get_trace_details` | Trace overview | Performance investigation |
| `get_event_attachment` | Download attachments | Screenshots, logs on events |
| `search_issues` | List issues by criteria | "Show me unresolved errors" |
| `search_events` | Count/aggregate events | "How many errors today?" |
| `search_issue_events` | Filter events in an issue | "Events from last hour" |
| `analyze_issue_with_seer` | AI root cause analysis | When stacktrace alone isn't enough |

**Key pattern:** Always get org slug first → then use other tools.
**See:** `sentry` skill for investigation workflow.

### Jira (`jira`)

Issue tracking and project management.

| Tool | Purpose | When to use |
|---|---|---|
| `GET /search/jql` | Search with JQL | Find tickets by criteria |
| `GET /issue/{key}` | Read ticket details | Get context for a task |
| `POST /issue` | Create ticket | New bugs, tasks, stories |
| `PUT /issue/{key}` | Update ticket | Change fields, assignee |
| `GET /issue/{key}/transitions` | Available status changes | Before transitioning |
| `POST /issue/{key}/transitions` | Change ticket status | Move to "In Progress", etc. |
| `POST /issue/{key}/comment` | Add comment | Progress updates, analysis |
| `GET /project` | List projects | Find project key |
| `GET /field` | List available fields | Before writing JQL |

**Key pattern:** Check fields (`GET /field`) before writing JQL. Check transitions before changing status.
**See:** `jira` skill for JQL patterns and ADF format.

### GitHub (`github-api`)

Repository, PR, and CI management.

| Tool | Purpose | When to use |
|---|---|---|
| `GET /repos/{o}/{r}/pulls` | List PRs | Find open PRs for branch |
| `POST /repos/{o}/{r}/pulls` | Create PR | Open a new pull request |
| `GET /repos/{o}/{r}/pulls/{n}/files` | PR changed files | Review what changed |
| `GET /repos/{o}/{r}/issues` | List issues/PRs | Search by label, assignee |
| `GET /search/issues` | Search issues/PRs | Complex queries with `q=` |
| `GET /repos/{o}/{r}/actions/runs` | CI runs | Check build status |
| `GET /repos/{o}/{r}/actions/jobs/{id}` | CI job details | Read failure logs |
| `GET /repos/{o}/{r}/commits/{sha}/check-runs` | Check runs | Detailed CI status |
| `GET /repos/{o}/{r}/commits/{sha}/status` | Commit status | Quick pass/fail check |

**Key pattern:** Use `head=org:branch` to filter PRs by branch. Use `q=is:pr` or `q=is:issue` to separate.
**See:** `git-workflow` and `code-review` skills.

### Browser / Playwright (`Playwright`)

Web interaction and testing.

| Tool | Purpose | When to use |
|---|---|---|
| `browser_navigate` | Open URL | Load a page |
| `browser_snapshot` | Accessibility snapshot | Read page content (better than screenshot) |
| `browser_click` | Click element | Interact with UI |
| `browser_type` | Type text | Fill forms |
| `browser_evaluate` | Run JavaScript | Extract data, manipulate DOM |
| `browser_take_screenshot` | Visual capture | Document UI state |
| `browser_network_requests` | Network log | Debug API calls |

**Key pattern:** Use `browser_snapshot` over screenshots — it returns structured data the agent can act on.

### Context7 (`Context_7`)

Library documentation lookup.

| Tool | Purpose | When to use |
|---|---|---|
| `resolve-library-id` | Find library ID | First — before querying docs |
| `query-docs` | Query documentation | Get up-to-date API docs and examples |

**Key pattern:** Always resolve library ID first → then query. Max 3 calls per question.
**Use for:** Laravel, PHP, Livewire, Tailwind, or any library docs.

### Sequential Thinking (`Sequential_thinking`)

Structured problem-solving.

| Tool | Purpose | When to use |
|---|---|---|
| `sequentialthinking` | Step-by-step reasoning | Complex problems, planning, analysis |

**Use for:** Breaking down complex tasks, planning before implementation, multi-step reasoning.

## Workflows: bug = Jira+Sentry+codebase. Feature = Jira+codebase+Context7. CI = GitHub+codebase+launch-process. PR = GitHub+Jira.

## Errors: retry once, look up org/project slugs first, batch GitHub calls (rate limits).

## Permissions: reads = safe. Writes (Jira tickets, GitHub PRs, comments) = ask user first.

## Related: `sentry`, `jira`, `git-workflow`, `copilot`

## Gotcha: MCP is token-expensive (prefer CLI), max 5 chained calls, handle connection failures, Sentry/Jira worth the cost.

## Do NOT: call without understanding side effects, use when simpler alternatives exist.
