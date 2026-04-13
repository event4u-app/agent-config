---
skills: [git-workflow]
description: Generate a PR description as a copyable markdown block — used standalone or by create-pr
---

# create-pr-description

## Input

PR URL or auto-detect (branch → GitHub API → confirm). Never reuse old PR numbers.

## Instructions

### 1. Detect PR / Branch

PR URL → use API. No URL → `git branch --show-current` → search GitHub → use PR or branch diff.

### 2. Gather context

- **Jira**: extract from branch, fetch API. Not found → ask.
- **Diff**: `git diff origin/{default}..HEAD --stat`
- **Commits**: `git log origin/{default}..HEAD --format="%s"`
- **PR template**: **MUST** read `.github/pull_request_template.md`
- Read key changed files (migrations, new classes, services, routes)
- Check roadmap/agent docs

### 3. PR title

Format: `{TICKET-ID}: {summary}`. Use Jira summary or derive from commits.

### 4. PR body

**ALWAYS** use PR template. Fill: Jira badge, description (2-5 sentences), type of change, links. Checklist: leave as-is.

If no PR template exists, use this structure:

```markdown
## Jira
[{TICKET-ID}]({JIRA_BASE_URL}/browse/{TICKET-ID})

## Changes
- Bullet list of what was changed and why

### Migrations
- List new/changed migrations (if any)

### Tests
- List new/changed tests (if any)

## How to test
- Steps to verify the changes
```

### 5. Present as copyable block

Show the **title** and **body** separately, each in a fenced code block so the user can copy them:

```
📋 PR Title:
```
{title}
```

📋 PR Body:
```markdown
{body}
```
```

### 6. Feedback

`1. Looks good` / `2. Adjust`

### Rules

- Output in user's language, PR body in **English**
- Show result before further action — never create PR from this command
- Always use PR template. Be concise. Group related changes.
- Mark breaking changes. Highlight things needing reviewer attention.

