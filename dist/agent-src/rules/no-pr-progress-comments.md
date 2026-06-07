---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Posting comments on an open PR — refuses unsolicited progress / status / CI-fix narration unless personal.pr_progress_comments is true"
triggers:
  - intent: "post PR comment"
  - intent: "PR status update"
  - intent: "CI fix progress"
  - keyword: "gh pr comment"
  - keyword: "PullRequestComment"
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - meta
---

# No Unsolicited PR Progress Comments

## Iron Law

```
NEVER POST UNSOLICITED PROGRESS / STATUS / CI-FIX COMMENTS ON A PR
WHEN `personal.pr_progress_comments` IS FALSE (DEFAULT).
EXCEPTION: USER-INVOKED FLOWS ALWAYS RUN.
EXCEPTION: USER EXPLICITLY ASKED FOR IT THIS TURN.
```

Reading `.agent-settings.yml`:

- Missing key / not set → treat as `false`.
- `personal.pr_progress_comments: false` (default) → gate fires.
- `personal.pr_progress_comments: true` → gate inert, agent may comment.

## What this gates — and what it does NOT

**Gated** (do not post when the setting is `false`):

- "CI fix iteration #N" status comments narrating what the agent did.
- "Blocked on X" status notices the agent posts unprompted.
- "All checks green now" celebration comments.
- Any `gh pr comment` / `octokit.pulls.createReview` / equivalent the
  agent decides to fire mid-loop without an explicit ask.

**Not gated** (always allowed regardless of the setting):

- The PR body / description in [`/create-pr`](../commands/pr/create.md) and
  in PATCH-after-create strip passes — that text *is* the PR.
- Replies to individual review comments via
  [`/fix:pr-comments`](../commands/fix/pr-comments.md),
  [`/fix:pr-developer-comments`](../commands/fix/pr-developer-comments.md),
  and [`/fix:pr-bot-comments`](../commands/fix/pr-bot-comments.md) —
  the user invoked the command, that is the explicit ask.
- Comments the user explicitly requested this turn ("post a comment
  on PR #244 explaining the workflow-scope block").
- Comments from a slash-command flow the user invoked
  (`/council:pr`, `/code-review --comment`, etc.).

If unsure whether the planned comment qualifies as gated:
**treat it as gated**. The user can flip the setting once if they
want progress narration; a missed unsolicited comment is recoverable,
a noisy PR thread is not.

## What to do instead when the gate fires

State the progress in the **chat reply**, not on the PR. Examples:

- "Fixed the schema lint; force-pushed `b17c4ef8`. Node Tests still
  blocked on the workflow-scope edit (diff in working tree, needs
  maintainer push)."
- "CI cycle 3/3 green except for Node Tests; same blocker as before."

The chat reply reaches the user with the same information. The PR
stays clean for reviewers.

## Failure modes — what counts as a violation

- Posting "CI status update" comments during an autonomous CI-fix loop.
- Re-running `gh pr comment` after a previous unsolicited comment was
  posted (compounding the noise).
- Narrating the diff of the next push in a PR comment — diffs belong
  in commit messages.
- Posting "I noticed you opened this PR — here's my analysis" without
  a `/code-review` invocation.

## Carve-out: surfacing safety-critical info

If the agent uncovers a security / data-loss / production-impact
issue that the reviewer needs to see **before** they read the diff
and posting a chat reply alone risks the message being missed, treat
this as an explicit safety surface and:

1. Post the comment **and** state in the chat reply that the gate was
   bypassed for safety.
2. Cite the rule + the carve-out in the comment body so the reviewer
   knows why the agent broke the default silence.

Routine CI status, refactor progress, and "this might interest you"
notes do **not** clear this carve-out.

## See also

- [`/create-pr`](../commands/pr/create.md) — PR body / description path (not gated).
- [`/fix:pr-comments`](../commands/fix/pr-comments.md) — review-reply path (not gated).
- [`no-attribution-footers`](no-attribution-footers.md) — sibling rule on PR-comment hygiene.
- [`no-decorative-emojis-in-git-surfaces`](no-decorative-emojis-in-git-surfaces.md) — sibling rule gating decorative emojis in any comment that does get posted.
- [`scope-control`](scope-control.md) — git-ops permission gate (PR creation).
- `personal.pr_progress_comments` in `config/agent-settings.template.yml`.
