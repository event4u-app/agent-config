---
name: jira-ticket
skills: [laravel]
description: Read Jira ticket from branch name, analyze linked Sentry issues, implement feature or fix bug
disable-model-invocation: true
---

# jira-ticket

## Instructions

### 1. Extract ticket ID from branch name

- Run `git branch --show-current` to get the current branch name.
- Extract the Jira ticket ID from the branch name (e.g. `fix/DEV-4673-some-description` → `DEV-4673`).
- If no ticket ID is found in the branch name, or the ticket cannot be found in Jira, **ask the user** for the ticket number or a direct Jira link. Do not guess or proceed without a valid ticket.

### 2. Fetch the Jira ticket

- Use the Jira API to fetch the ticket: `GET /issue/{ticketId}`
- Read and understand:
  - **Summary** and **description** — what needs to be done?
  - **Issue type** — Bug, Feature, Task, etc.
  - **Priority** and **status**
  - **Comments** — often contain additional context, decisions, or reproduction steps.
  - **Linked issues** — may reference related work.

### 3. Check for Sentry links

- Scan the ticket description and comments for Sentry URLs (e.g. `https://*.sentry.io/issues/*`).
- If Sentry links are found:
  - Fetch the Sentry issue details using `get_issue_details` with the URL.
  - Analyze the stacktrace, error message, and affected code.
  - Check tag distributions (browser, environment, URL) if relevant.
  - This gives you the real-world error context to understand the bug.

### 4. Analyze the codebase

- Use `codebase-retrieval` to find the relevant code based on what the ticket describes.
- Read the affected files and understand the current behavior.
- If it's a bug: reproduce the logic mentally by following the code path from the Sentry stacktrace or ticket description.
- If it's a feature: understand the existing architecture and where the new code should go.

### 5. Plan the implementation

- Create a task list with the planned changes.
- For bugs: identify the root cause and plan the fix.
- For features: break down into subtasks.
- Present the plan to the user and **ask for confirmation before making changes**.

### 6. Implement

- Apply the changes following all project coding standards (see AGENTS.md).
- Use `Math` helper for calculations, proper type hints, `declare(strict_types=1)` in new files, etc.
- Write the code as if a senior developer would review it.

### 7. Verify

- Run `php -l` on all modified files.
- If the change is testable, suggest writing or running tests.

### Rules

- **Do NOT commit or push.** Only apply local changes.
- **Always ask before implementing** — present the plan first.
- If the ticket is unclear or missing information, ask the user for clarification.
- If the Sentry issue reveals a different/bigger problem than the ticket describes, flag it.

## See also

- [`role-contracts`](../guidelines/agent-infra/role-contracts.md#developer) — Developer mode output contract (Goal / Plan / Changes / Tests / Open questions)
