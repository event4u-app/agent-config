---
name: create-pr
cluster: create-pr
skills: [git-workflow]
description: Create a GitHub PR with structured description from Jira ticket and code changes
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "open a PR, create a pull request, make a PR for this branch"
  trigger_context: "branch is ahead of base and not yet on a PR"
---

# /create-pr

Top-level entry point for the `/create-pr` family. Bare `/create-pr`
runs the full create-PR flow described below. The `:description-only`
sub-command produces a copyable PR description without creating the PR.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/create-pr` (bare) | this file (`## Default flow`) | Full flow — generate description, push, create PR |
| `/create-pr:description-only` | `commands/create-pr/description-only.md` | Generate the PR description as a copyable markdown block, no PR creation |

## Dispatch

1. Parse the user's argument: `/create-pr[:<sub>] [args]`.
2. Bare `/create-pr` → run the `## Default flow` below verbatim.
3. `/create-pr:description-only` → load
   `commands/create-pr/description-only.md` and follow its
   `## Instructions` section verbatim.
4. Unknown sub-command → print the table above and ask which one.

## Default flow

Uses `/create-pr:description-only` to generate the PR content, then creates the PR via GitHub API.

### 1. Check prerequisites

- Verify the current branch is NOT the default branch (`main` / `master`).
- Run `git status` — warn if there are uncommitted changes.
- Run `git log origin/{default}..HEAD --oneline` to verify there are commits to push.
- If the branch has not been pushed yet, ask the user (in their language) whether to push.

### 2. Generate PR content

Run `/create-pr:description-only` to generate the PR title and body.
This handles: Jira ticket extraction, diff analysis, commit messages, **PR template filling**.

**CRITICAL**: The PR body MUST use the project's PR template (`.github/pull_request_template.md`).
Read the template file and fill in its sections. If the template does not exist, use the
fallback structure defined in `/create-pr:description-only`. NEVER invent a custom body structure.

The user reviews and adjusts the content in that step.

### 2b. Offer council review (B2 hook)

If `.agent-settings.yml` has `ai_council.enabled: true` **and** at least
one member is enabled, ask (in the user's language):

> 1. Run the council on this diff before opening the PR? (billable)
> 2. Skip council review

Suppress when `personal.autonomy: on` (council is billable; autonomy
must not silently spend — see `road-to-ai-council.md` Decision 3).

If picked **1**:

- Compute the diff range — `origin/<default>..HEAD` from step 1.
- Run `/council diff:<base>..<head>` with `original_ask` set to the
  PR title from step 2 (the user's framing of the change).
- Surface findings to the user before step 3. **Do not** auto-edit
  the PR body or block PR creation — output is advisory.
- Optional: offer to append a one-paragraph "Council notes" section
  to the PR description for reviewer transparency. Default: skip.

If picked **2** → continue.

### 3. Create the PR

Once the user approves the content from step 2:

- **Head branch**: Use the EXACT output of `git branch --show-current` from step 1.
  **NEVER** reuse a branch name from earlier in the conversation — always use the fresh value.
- **Base branch**: Default branch (`main` / `master`).
- Ask the user:
  ```
  > 1. Create as draft
  > 2. Create as ready for review
  ```
- Create the PR via GitHub API with the approved title and body.
- **CRITICAL**: Set the `draft` parameter based on the user's choice:
  - Option 1 → `"draft": true`
  - Option 2 → `"draft": false`
  - Do NOT default to draft. The user's choice is the ONLY factor.
- **After creating with `draft: false`**: The GitHub REST API sometimes ignores
  `draft: false` and creates a draft anyway. Always verify by running:
  ```bash
  gh pr view {number} --json isDraft --jq '.isDraft'
  ```
  If it returns `true`, fix it immediately:
  ```bash
  gh pr ready {number}
  ```

### 4. After creation

- Show the PR URL.
- If a Jira ticket was linked, ask:
  ```
  > Transition Jira ticket {TICKET-ID} to "In Review"?
  >
  > 1. Yes — update status
  > 2. No — leave as-is
  ```

### Rules

- **Always use the PR template** from `.github/pull_request_template.md` — read it, fill its sections.
- **Always show the PR content before creating it** — never create blindly.
- **Push the branch first** if it hasn't been pushed (with user permission).
- Only create the PR — never merge it.
- Only commit or push with explicit user permission.
