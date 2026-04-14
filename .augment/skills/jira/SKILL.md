---
name: jira
description: "Use when the user says "check Jira", "create ticket", "update issue", or needs JQL queries, ticket transitions, or branch-to-ticket linking."
source: package
---

# Jira Skill

## When to use

Jira tickets, JQL, transitions, branch-ticket linking. NOT for: GitHub Issues, Linear.

## Available MCP tools

| Tool | Purpose |
|---|---|
| `jira` (GET `/search/jql`) | Search issues with JQL |
| `jira` (GET `/issue/{key}`) | Read a specific ticket |
| `jira` (POST `/issue`) | Create a new ticket |
| `jira` (PUT `/issue/{key}`) | Update a ticket |
| `jira` (GET `/issue/{key}/transitions`) | Get available status transitions |
| `jira` (POST `/issue/{key}/transitions`) | Transition ticket status |
| `jira` (POST `/issue/{key}/comment`) | Add a comment |
| `jira` (GET `/project`) | List projects |
| `jira` (GET `/field`) | List available fields (check before writing JQL) |

## Branch-to-ticket detection

Extract ticket IDs from branch names automatically:

```
feat/DEV-1234/user-notifications  →  DEV-1234
fix/DEV-5678/null-pointer         →  DEV-5678
hotfix/DEV-999/critical-fix       →  DEV-999
```

Pattern: `[A-Z]+-[0-9]+` anywhere in the branch name.

Use `git branch --show-current` to detect, then fetch the ticket:

```
jira GET /issue/DEV-1234
```

## JQL patterns

### Common queries

```jql
# My open tickets
assignee = currentUser() AND status != Done ORDER BY priority DESC

# Tickets in current sprint
project = DEV AND sprint in openSprints() AND assignee = currentUser()

# Recently updated bugs
project = DEV AND type = Bug AND updated >= -7d ORDER BY updated DESC

# Tickets by component
project = DEV AND component = "Import" AND status != Done
```

### Tips

- Always check available fields first: `GET /field`
- Use `currentUser()` for the authenticated user
- Use `sprint in openSprints()` for current sprint
- JQL is case-insensitive for field names but case-sensitive for values

## Creating tickets

### Required fields

Always check issue types first: `GET /issue/createmeta/{project}/issuetypes`

Minimum fields for creation:
- `project` — project key (e.g., `DEV`)
- `issuetype` — issue type (Bug, Task, Story, etc.)
- `summary` — short title

### Description format (ADF)

Jira uses Atlassian Document Format for descriptions:

```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Description text here." }
      ]
    }
  ]
}
```

### Attribution

Always add attribution when creating issues or comments:

```
Co-authored by Augment Code
```

With link to `https://www.augmentcode.com/?utm_source=atlassian&utm_medium=jira_issue&utm_campaign=jira`

## Status transitions

Before transitioning, always get available transitions first:

```
GET /issue/DEV-1234/transitions
```

Then transition with the correct ID:

```json
POST /issue/DEV-1234/transitions
{ "transition": { "id": "31" } }
```

**Important:** Never transition without explicit user permission (see `rules/no-commit.md` — same principle applies to ticket status changes).

## Linking to PRs

When creating PRs, include the Jira ticket in:
- **Branch name:** `feat/DEV-1234/description`
- **PR title:** `feat(DEV-1234): description`
- **PR description:** Link to the ticket

## Related: `bug-analyzer`, `feature-planning`, `/bug-investigate`, `/feature-plan`.

## Gotcha: JQL case-sensitive, search before creating (no duplicates), ADF not Markdown for descriptions, `accountId` for assignee.

## Do NOT: change status without permission, create without duplicate check.
