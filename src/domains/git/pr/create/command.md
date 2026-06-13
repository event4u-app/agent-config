---
model_tier: medium
name: git-pr-create
disable-model-invocation: true
pack: git
intent: "Open a pull request with a generated description and stripped attribution footers"
routes_to: [git-workflow]
replaces: [create-pr]
tier: 1
visibility: advanced
cluster: git-pr-create
skills: [git-workflow]
description: Create a GitHub PR with structured description from Jira ticket and code changes
suggestion:
  eligible: true
  trigger_description: "open a PR, create a pull request, make a PR for this branch"
  trigger_context: "branch is ahead of base and not yet on a PR"
workspaces:
  - agent-config-maintainer
packs:
  - git
---

# /git-pr-create

Top-level entry point for the `/create-pr` family. Bare `/create-pr`
runs the full create-PR flow described below. The `:description-only`
sub-command produces a copyable PR description without creating the PR.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/create-pr` (bare) | this file (`## Default flow`) | Full flow — generate description, push, create PR |
| `/create-pr:description-only` | `commands/pr/create/description-only.md` | Generate the PR description as a copyable markdown block, no PR creation |

## Dispatch

1. Parse the user's argument: `/create-pr[:<sub>] [args]`.
2. Bare `/create-pr` → run the `## Default flow` below verbatim.
3. `/create-pr:description-only` → load
   `commands/pr/create/description-only.md` and follow its
   `## Instructions` section verbatim.
4. Unknown sub-command → print the table above and ask which one.

## Default flow

Uses `/create-pr:description-only` to generate the PR content, then creates the PR via GitHub API.

### 1. Check prerequisites

- Verify the current branch is NOT the default branch (`main` / `master`).
- Run `git status` — warn if there are uncommitted changes.
- Run `git log origin/{default}..HEAD --oneline` to verify there are commits to push.
- If the branch has not been pushed yet, ask the user (in their language) whether to push.

### 1b. Freshness gate — MANDATORY before opening any PR

The branch may have diverged from its target base while you were
working. A PR opened against a stale base creates merge conflicts the
moment another PR lands first — the exact failure that motivates this
gate.

Run, in order:

1. `git fetch origin {target-base} --quiet` (default: `main`).
2. `git rev-list --count HEAD..origin/{target-base}` — number of
   commits HEAD is **behind** the base.
3. `gh pr list --state open --base {target-base} --limit 20 --json number,headRefName,files`
   — open PRs targeting the same base.

**Decision matrix:**

| Behind | Overlapping open PR touches same files? | Action |
|---|---|---|
| `0` | — | Proceed to Step 2 |
| `1–N` | No | Surface the count, ask: rebase / merge-main / proceed-anyway / cancel |
| `1–N` | **Yes** | STOP — surface the overlapping PR number, ask: stack on top of it / wait for it to land / proceed-anyway-and-accept-conflicts / cancel |

Never improvise the base or silently proceed when the branch is behind
and overlap exists. The 10-second fetch beats hours of rebase
reconciliation after the parent PR lands.

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

### 3. Create the PR (draft-vs-ready, verbosity-gated)

- **Head branch**: EXACT output of `git branch --show-current` from step 1.
- **Base branch**: default branch (`main` / `master`).

**Behavior change vs. legacy:** with `verbosity.routine_confirmations:
false` (default), `/create-pr` creates the PR as draft silently. Override
per-invocation with `:ready` / `:final` / `:draft`. Restore the prompt
by flipping `routine_confirmations: true`. See
[`docs/customization.md` § Verbosity](../../docs/customization.md#verbosity).

Resolve `"draft"` (first match wins):

1. `:ready` / `:final` arg → `false`.
2. `:draft` arg → `true`.
3. `routine_confirmations: true` → ask `1. draft / 2. ready`.
4. Default → `true` (silent draft).

#### 3a. Tool selection — single-call mandate

```
POST THE PR WITH ONE github-api CALL.
NEVER COMPOSE THE BODY THROUGH SHELL, PYTHON, OR TEMP FILES.
```

Use the `github-api` tool **directly** with the markdown body in the
JSON `data` field. The body is a regular JSON string — escaping is the
tool's job, not yours.

```
github-api
  method: POST
  path:   /repos/{owner}/{repo}/pulls
  data:   { "title": "...", "body": "<markdown>", "head": "<branch>",
            "base": "main", "draft": <bool> }
```

**Hard prohibitions** (each one cost 3+ extra tool calls in past runs):

- ❌ `python3 -c "import urllib..."` / `python3 - <<PY ... PY` heredocs
  to serialize the body or POST it.
- ❌ `save-file PR_BODY.md` → read back → `curl -d @PR_BODY.md`.
- ❌ `gh pr create --body-file …` shelling out when `github-api` is
  available in this surface.
- ❌ Splitting `title` and `body` into two API calls (create + PATCH).

The body may contain any Markdown — code fences, tables, multi-line
HTML, emoji. Do **not** preprocess, escape, or strip newlines before
handing it to `github-api`.

If the surface genuinely lacks `github-api` (rare), fall back to
`gh pr create --title "..." --body-file <(echo -n "<body>")` as a
**single** shell call, never the python-urllib path.

#### 3b. Submit

Create the PR with the approved title/body and the resolved `draft`.

**Verify after `draft: false`** — the GitHub REST API sometimes ignores
the flag:

```bash
gh pr view {number} --json isDraft --jq '.isDraft'
# returns true → gh pr ready {number}
```

**Silent-draft postscript** (rule 4) → see step 4b.

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
3. **No match → done.** Skip steps 4–5; the body is already clean.
   This is the common path and **must not** spend a verify-GET.
4. Match found → remove the footer(s) together with surrounding
   `---` separators and trailing whitespace, then:
   ```
   PATCH /repos/{owner}/{repo}/pulls/{number}
   { "body": "<cleaned body>" }
   ```
   Re-fetch the body **once** to verify the strip stuck. If a
   pattern reappears (server re-injection), repeat the PATCH once;
   if it still reappears, surface the issue to the user and stop
   (do not enter a strip/PATCH loop).
5. Briefly note in the reply how many footers were removed (omit
   the line entirely when nothing was stripped — silence is the
   expected path, not "no footers found").

#### 4b. Show the PR URL (verbosity-gated)

Per `verbosity.post_action_reports` (default `minimal`):

- `off` → nothing.
- `minimal` → `→ #N opened: <url>`. Append `→ created as draft — run
  \`gh pr ready N\` to flip` when silent-draft (rule 4); omit on ready.
- `full` → multi-line: PR number, URL, draft state, base/head, ready-reminder.

#### 4c. Jira transition (only when transitioned)

Linked ticket + `routine_confirmations: true` → ask `1. Yes / 2. No`.
Default (`false`) → skip silently. **Only emit a transition line when
an actual Jira API call succeeded** — never announce "skipped".

#### 4d. Settings short-circuit — single read per run

`verbosity.routine_confirmations`, `verbosity.post_action_reports`, and
`commands.create_pr.preview_description` are read **once** at the top
of the run and cached for the whole `/create-pr` invocation. Do **not**
re-read `.agent-settings.yml` in 4b / 4c — both branches resolve from
the cached values from step 1.

When all three resolve to their silent defaults (`false` / `minimal` /
`false`), steps 4b–4c collapse to the single `→ #N opened: <url>` line
from 4b and a silent 4c. No extra file reads, no "checking settings…"
narration, no confirmation prompts.

### Rules

- **Always use the PR template** from `.github/pull_request_template.md`.
- **Preview is opt-in** — `commands.create_pr.preview_description` (default `false`). `/create-pr:description-only` always previews.
- **Push the branch first** if needed (with permission).
- **No attribution footers** — see [`no-attribution-footers`](../rules/no-attribution-footers.md); strip-pass at 4a defends against tool injection.
- Only create the PR — never merge.
- Only commit or push with explicit permission.
