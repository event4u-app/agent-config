---
name: jira-ticket
description: "jira-ticket"
disable-model-invocation: true
---

# jira-ticket

## Instructions

### 1. Extract ticket from branch

`git branch --show-current` → extract `[A-Z]+-[0-9]+`. Not found → ask user.

### 2. Fetch Jira ticket

`GET /issue/{ticketId}` → summary, description, type, priority, status, comments, links.

### 3. Sentry links

Scan description/comments for `*.sentry.io/issues/*` → `get_issue_details` → stacktrace, tags.

### 4. Analyze codebase

`codebase-retrieval` → relevant code. Bug: trace code path. Feature: understand architecture.

### 5. Plan

Task list. Bug: root cause + fix. Feature: subtasks. **Ask confirmation before changes.**

### 6. Implement — follow standards, `Math` helper, strict types

### 7. Verify — `php -l`, suggest tests

### Rules

- No commit/push. Plan first. Ask if unclear. Flag bigger problems.
