---
name: create-pr-description
skills: [git-workflow]
description: Generate a PR description as a copyable markdown block — used standalone or by create-pr
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "write a PR description, draft the PR text"
  trigger_context: "PR exists or branch ready for review without description"
superseded_by: create-pr --description-only
deprecated_in: "1.17.0"
---

> ⚠️  /create-pr-description is deprecated; use /create-pr --description-only instead.
> This shim is retained for one release cycle (1.17.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# create-pr-description

## Input

The user may or may not provide a PR URL or branch name.

## Instructions

### 1. Detect PR / Branch

1. If the user provides a GitHub PR URL → use that PR to get the changed files via API.
2. If no URL → **auto-detect:**
   - Get current branch (`git branch --show-current`).
   - Search for an open PR on that branch via GitHub API
     (`GET /repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=open`).
   - If exactly one PR found → use it (get files via `/pulls/{number}/files`).
   - If no PR found → use `git diff origin/{default}..HEAD --stat` for the branch diff.
3. **Never** reuse a PR number from earlier in the conversation.

### 2. Gather context

- **Jira ticket**: Extract ticket ID from branch name (e.g. `fix/DEV-4673-description` → `DEV-4673`).
  - If found → fetch via Jira API (`GET /issue/{ticketId}`).
  - If not found → ask the user for a ticket number. Proceed without if none.
- **Diff summary**: `git diff origin/{default}..HEAD --stat` for changed files.
- **Commit messages**: `git log origin/{default}..HEAD --format="%s"` for what was done.
- **PR template**: **MUST** read `.github/pull_request_template.md`. This is mandatory, not optional.
- **Read key changed files** to understand what was done — look for migrations, new classes,
  modified services, route changes, config changes.
- **Check roadmap/agent docs** that describe the feature intent (if they exist).

### 3. Build the PR title

- Format: `{TICKET-ID}: {summary}` (e.g. `DEV-4673: Fix absence working time calculation`).
- Use the Jira ticket summary if available, otherwise derive from commits.
- If no ticket: use the most descriptive commit message or ask the user.

### 4. Build the PR body

**ALWAYS** use the PR template (`.github/pull_request_template.md`). Fill in its sections:

- **Jira badge**: Replace `{TICKET-NUMBER}` with the actual ticket ID.
- **Description**: Summarize the changes in 2-5 sentences. Explain *what* changed and *why*.
  Use the Jira ticket description and commit messages as input.
- **Type of change**: Check the appropriate checkbox(es) based on the changes.
- **Checklist**: Leave as-is (the developer fills this in).
- **Links**: Replace `{TICKET-NUMBER}` with the actual ticket ID.
- **Screenshots**: Leave as `...` unless the user provides screenshots.

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

### 6. Ask for feedback

Ask with numbered options:

```
> 1. Looks good — done
> 2. Adjust — I'll tell you what to change
```


### Rules

- **All output in the user's language** — but the PR body itself is in **English**.
- **Always show the result before any further action** — never create a PR directly from this command.
- **Always use the PR template** — read `.github/pull_request_template.md` and fill its sections. NEVER invent a custom structure.
- **Be concise** in the description — no filler text, no restating the ticket title as a sentence.
- **Group related changes** in the description — don't list every file, list logical changes.
- **Mark breaking changes** clearly if the diff shows API contract changes (new/removed fields,
  changed endpoints, changed response structure).
- **Mention file/class names** where helpful, but don't list every single file.
- **Highlight things reviewers should pay attention to** — complex logic, edge cases, trade-offs.
