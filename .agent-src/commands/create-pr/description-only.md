---
name: create-pr:description-only
tier: 1
cluster: create-pr
sub: description-only
skills: [git-workflow]
description: Generate a PR description as a copyable markdown block — used standalone or by create-pr
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "write a PR description, draft the PR text"
  trigger_context: "PR exists or branch ready for review without description"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /create-pr:description-only

> **Carve-out:** this command's *purpose* is the copyable preview of
> the PR description. It therefore **ignores**
> `verbosity.preview_artifacts` and `commands.create_pr.preview_description`
> — both flags govern only the bare `/create-pr` flow's preview-and-
> adjust loop. Removing the preview here would make the command a
> no-op. Do not "fix" this; the suppression flags only apply when the
> PR is actually being created.

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

### 2. Gather context — **one parallel tool-call block**

The four primary fetches below are **independent** and **must** be
dispatched in a single parallel tool-call block, not serially. Serial
reads here add 3+ round-trips per PR for zero benefit.

```
parallel:
  1. Jira API           — GET /issue/{ticketId}   (skip when no ticket ID)
  2. git diff           — git diff origin/{default}..HEAD --stat
  3. git log            — git log origin/{default}..HEAD --format="%s"
  4. view PR template   — .github/pull_request_template.md
```

After the block returns:

- **Jira ticket**: ticket ID is extracted from the branch name
  (e.g. `fix/DEV-4673-description` → `DEV-4673`) **before** the
  parallel block. No ticket → skip fetch 1 silently; ask the user
  for a number only after the block, and only if needed.
- **PR template missing** → fall back to the structure in § 4.
- **Read key changed files** (migrations, new classes, modified
  services, route/config changes) — second parallel block, keyed
  off the diff summary. Group all file reads in one block.
- **Check roadmap/agent docs** that describe the feature intent
  (if they exist) — fold into the second block.

Anti-pattern (do **not** do this):

```
turn 1: fetch Jira
turn 2: git diff
turn 3: git log
turn 4: view template
turn 5: view file A
turn 6: view file B
```

That's 6 round-trips for what should be 2.

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
