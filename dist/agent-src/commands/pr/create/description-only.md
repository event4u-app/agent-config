---
model_tier: medium
name: git-pr-create-description-only
pack: git
replaces: [create-pr-description-only, create-pr:description-only]
visibility: internal
cluster: git-pr-create
sub: description-only
skills: [git-workflow]
description: Generate a PR description as a copyable markdown block — used standalone or by create-pr
argument-hint: "[pr-url | branch]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - git
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

#### 4.0 Resolve the detail level

Read `commands.create_pr.detail_level` from `.agent-settings.yml` (default
`min` when unset). This tier governs **only the explanatory depth of the
Description section** — never which template sections exist, and never
whether a critical callout appears (see 4.1 critical-info-always).

| Tier | Description section content |
|---|---|
| `min` (default) | Title-level summary in 2-3 sentences: *what* changed, *why*, and the user/system impact. No per-file walk, no restating commit subjects, no "how to test". |
| `med` | `min` + grouped logical changes as 3-5 bullets (by concern, not by file) + a one-line tests note (added / none / coverage). |
| `max` | `med` + how-to-test steps + edge cases / trade-offs + one "reviewer guidance" line (what to focus on). ≈ the legacy output. |

`min` is the default because this is a token-cost optimization: a shorter
description costs fewer output tokens on every PR. Keep `min` genuinely
minimal — but never at the expense of the critical-info block below.

#### 4.1 Critical-info-always — tier-independent MUST

```
CRITICAL INFORMATION APPEARS AT EVERY TIER, INCLUDING min.
THE TIER GOVERNS EXPLANATORY DEPTH, NEVER WHETHER A CRITICAL CALLOUT APPEARS.
DROPPING A BREAKING-CHANGE / MIGRATION / SECURITY / ROLLBACK CALLOUT AT min
IS A P0 DEFECT, NOT A TOKEN SAVING.
```

If the diff shows any of the following, a one-line callout for it is included
in the Description **regardless of `detail_level`** (grounded in the diff, not
guessed):

- **Breaking change** — API contract change (new/removed/renamed field, changed
  endpoint or response shape), CLI-arg change, changed env var, or a renamed
  route the frontend depends on. Prefix `⚠️ Breaking:`.
- **Migration required** — DB migration, config migration, or a deployment step.
  Prefix `Migration:`.
- **Security implication** — new permission/scope, auth change, or data-exposure
  surface. Prefix `🔒 Security:`.
- **Non-trivial rollback** — when reverting is not a plain `git revert`. Prefix
  `Rollback:`.

None present → omit the block entirely (do not emit empty "No breaking
changes" filler at `min`).

#### 4.2 Fill the template sections

**ALWAYS** use the PR template (`.github/pull_request_template.md`). Fill in its sections:

- **Jira badge**: Replace `{TICKET-NUMBER}` with the actual ticket ID.
- **Description**: Write it to the resolved tier (4.0) with the critical-info
  block (4.1) always present. Use the Jira ticket description + commit messages
  as input.
- **Type of change**: Check the appropriate checkbox(es) based on the changes.
- **Checklist**: Leave as-is (the developer fills this in).
- **Links**: Replace `{TICKET-NUMBER}` with the actual ticket ID.
- **Screenshots**: Handled by Step 4.4 (default: leave the placeholder / `...`).

If no PR template exists, use this structure — including only the sections the
tier calls for (at `min`, the `## Changes` bullets collapse to the 2-3 sentence
summary and `## How to test` is omitted):

```markdown
## Jira
[{TICKET-ID}]({JIRA_BASE_URL}/browse/{TICKET-ID})

## Description
- 2-3 sentence what/why/impact (min) — grouped bullets (med/max)
- Critical-info callouts (any tier, only if present)

### Migrations
- List new/changed migrations (if any)

### Tests
- List new/changed tests (med/max)

## How to test
- Steps to verify the changes (max)
```

#### 4.3 API response examples (evidence-grounded)

Read `commands.create_pr.api_examples` (default `true`). When `true` **and**
the diff touches an API endpoint, add a fenced request/response example under
the Description.

**Detect an API-endpoint change** (fail-open — no false enrichment when
ambiguous): a changed file matches `commands.create_pr.api_paths` (if set), or
the light heuristic — a route file (`routes/`, `**/api/**`, `*Controller*`,
resource/serializer classes) whose diff adds or changes an endpoint or its
request/response shape. No confident match → skip silently.

**Ground the example in a real source — never invent one:**

```
NEVER FABRICATE A JSON EXAMPLE. AN INVENTED CONTRACT MISLEADS REVIEWERS
AND IS WORSE THAN NONE. EMIT A JSON BLOCK ONLY FROM A REAL SOURCE.
```

Grounding sources, in priority order: the response DTO / API-resource /
serializer class in the diff · an OpenAPI/JSON-schema in the repo · a test
fixture or assertion exercising the endpoint · the actual output of a probe you
ran this session (`curl` / test client). If **none** exists, emit a one-line
pointer instead — `API contract changed — see \`<file>\`` — never a guessed
example. This is [`senior-engineering-discipline`](../rules/senior-engineering-discipline.md)
(never invent an API) applied to the description surface.

Format when grounded:

~~~markdown
### API example (`POST /api/...`)
Request:
```json
{ ...grounded... }
```
Response `201`:
```json
{ ...grounded... }
```
~~~

`api_examples: false` → skip this step entirely.

#### 4.4 Screenshots for frontend changes (capability-gated)

Read `commands.create_pr.screenshots` (default `false`). `false` → skip this
step entirely; leave the template Screenshots placeholder as-is.

When `true`, this is a **capability-gated contract, never a runtime
orchestrator** — the package ships instructions, the host provides the tools:

1. **Frontend-change gate.** Only proceed if the diff touches a frontend
   surface — a changed file matches `commands.create_pr.ui_paths` (if set), or
   the light heuristic (`.vue` / `.tsx` / `.jsx` / `.blade.php` / `.svelte`,
   component/view/page/template dirs, CSS/Tailwind). No match → skip silently.
2. **Capability gate — explicit, never silent.** Screenshots need host
   browser/preview tooling (a Playwright/browser MCP **and** a reachable dev-server
   or preview URL). There is no capability flag to read, so probe cheaply. If the
   tooling or a running preview is **absent**:
   - Leave the template Screenshots placeholder untouched, **and**
   - Emit ONE line in the chat reply: `Screenshots requested (screenshots: true)
     but no browser/preview tooling was reachable — skipped.`
   - **Never** fail, block, or delay PR creation over this.
3. **Capture (when capable).** Capture the current (head) state of each changed
   surface. Before/after (base vs head) with changed-region highlighting is
   **best-effort only** — a base checkout mid-PR is fragile and expensive;
   attempt it only if cheap and safe, otherwise after-only. One screenshot per
   changed surface, each with a one-line caption.
4. **Embedding — honest limits.** The `github-api pulls` write path cannot
   upload image bytes and GitHub markdown does not render `data:` URIs, so an
   agent cannot inline captured bytes into the body via the API. Use, in order:
   (a) a host image-upload capability if one exists (embed the returned URL);
   (b) otherwise save the screenshots to a local path, reference them in the
   Screenshots section, and tell the user to drag them into the PR in the
   GitHub UI. **Never claim an embed that did not happen**
   ([`direct-answers`](../rules/direct-answers.md) Iron Law 2).

Limitations (state them so expectations are set): default off; depends on host
browser tooling + a running preview; before/after + highlighting is best-effort;
byte-embedding into the PR body is not possible via the API.

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
