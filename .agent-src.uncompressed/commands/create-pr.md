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

Run `/create-pr:description-only` Steps 1–4 to generate the PR title and body.
This handles: Jira ticket extraction, diff analysis, commit messages, **PR template filling**.

**CRITICAL**: The PR body MUST use the project's PR template (`.github/pull_request_template.md`).
Read the template file and fill in its sections. If the template does not exist, use the
fallback structure defined in `/create-pr:description-only`. NEVER invent a custom body structure.

**Preview gate** — read `commands.create_pr.preview_description` from
`.agent-settings.yml` (default `false` when unset):

- `false` (default): skip Steps 5–6 of `/create-pr:description-only` (the
  copyable preview block + adjust loop). Use the generated title and body
  directly in Step 3 below. This saves agent tokens by avoiding a full
  re-render of the description in chat. The user can still edit the PR
  body in the GitHub UI after creation.
- `true`: run Steps 5–6 of `/create-pr:description-only` — present the
  title and body as copyable blocks and ask for adjustments before
  proceeding. The user reviews and adjusts the content in that step.

### 2b. Council review — explicitly excluded

`/create-pr` does **not** prompt for council review, even when
`ai_council.enabled: true`. Invoking the PR command is an explicit
delivery action; interrupting it with a billable opt-in question is
out of scope.

Users who want a council pass on the diff run `/council diff:<base>..<head>`
**before** `/create-pr`. Do not re-add the prompt here without an explicit
user request.

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

#### 4a. Strip attribution footers (mandatory)

Some `github-api` tool surfaces append attribution server-side after
the agent has sent a clean body. Per
[`no-attribution-footers`](../rules/no-attribution-footers.md), every
PR body must be re-checked and stripped after every write.

Run this strip-pass **after PR creation and after every body PATCH**:

1. Re-fetch the PR body:
   ```
   GET /repos/{owner}/{repo}/pulls/{number}
   ```
2. Search the body (case-insensitive) for any of:
   - `Generated with [Augment Code]` / `🤖 Generated with`
   - `Pull Request opened by [Augment Code]`
   - `Co-authored by Augment Code`
   - Any `augmentcode.com` link the user did not ask for
3. If any pattern is present, remove it together with surrounding
   `---` separators and trailing whitespace, then:
   ```
   PATCH /repos/{owner}/{repo}/pulls/{number}
   { "body": "<cleaned body>" }
   ```
4. Re-fetch the body once more to verify the strip stuck. If a
   pattern reappears (server re-injection), repeat steps 2–4 once;
   if it still reappears, surface the issue to the user and stop
   (do not enter a strip/PATCH loop).
5. Briefly note in the reply how many footers were removed (or
   "no footers found" if clean).

#### 4b. Show the PR URL

#### 4c. Jira transition

If a Jira ticket was linked, ask:
```
> Transition Jira ticket {TICKET-ID} to "In Review"?
>
> 1. Yes — update status
> 2. No — leave as-is
```

### Rules

- **Always use the PR template** from `.github/pull_request_template.md` — read it, fill its sections.
- **Preview before creating is opt-in** — controlled by `commands.create_pr.preview_description` in `.agent-settings.yml` (default `false`). When `false`, the bare `/create-pr` flow uses the generated description directly without a chat preview to save tokens. When `true`, the title and body are previewed and the user can adjust before creation. `/create-pr:description-only` always previews — that is its sole purpose.
- **Push the branch first** if it hasn't been pushed (with user permission).
- **Never add attribution footers to the body** — see [`no-attribution-footers`](../rules/no-attribution-footers.md). The agent does not self-credit; the strip-pass in step 4a defends against tool-injected footers.
- Only create the PR — never merge it.
- Only commit or push with explicit user permission.
