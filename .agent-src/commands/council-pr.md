---
name: council-pr
cluster: council
sub: pr
skills: [ai-council]
description: Pull a GitHub PR via gh CLI and run the council on the diff with a PR-specific neutrality preamble — read-only by default; comment posting is opt-in.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "council on PR #N, external review of pull request, second opinion on a PR"
  trigger_context: "user has a PR number / URL and wants an external review before approve/merge"
superseded_by: council pr
deprecated_in: "1.17.0"
---

> ⚠️  /council-pr is deprecated; use /council pr instead.
> This shim is retained for one release cycle (1.17.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# council-pr

## Instructions

Specialised council mode for **GitHub PRs**. Wraps `/council diff:<base>..<head>`
with a PR-aware neutrality preamble (the `pr` mode) and an opt-in
"post a comment summary on the PR" step at the end.

### 1. Resolve the PR target

The user invoked `/council-pr <number>` or `/council-pr <url>`. If
neither was supplied, ask (one question per turn, per
`ask-when-uncertain`):

> Which PR should the council review?
>
> 1. PR number on the current repo (e.g. `#123`)
> 2. Full GitHub URL
> 3. Cancel

### 2. Pull PR metadata via gh CLI

Run:

```bash
gh pr view <number> --json number,title,body,headRefName,baseRefName,author,url
```

Capture: title, body, head ref, base ref. The **PR title + body** is
the user's `original_ask` for the handoff preamble — verbatim, after
`_strip_host_identity()` cleansing in `prompts.py`. Do **not** add the
agent's framing.

### 3. Fetch the diff range locally

```bash
git fetch origin <base>:<base>
git fetch origin <head>:<head>
```

Compute the diff range as `origin/<base>..origin/<head>` (or the local
refs if already fetched).

### 4. Run /council with the pr mode preamble

Invoke `/council diff:<base>..<head>` with:

- `original_ask` = PR title + body (capped per
  `bundler.size_guard`; warn if truncated).
- The neutrality preamble uses the `pr` mode addendum from
  `scripts/ai_council/prompts.py` — focuses members on
  PR-specific risks (shipping risk, reviewer fatigue, scope creep)
  on top of the generic diff focus (correctness, security, tests,
  maintainability).

The cost gate from `/council` Step 3 still applies. Council is
billable; suppress the question only when the resolved members are
all-manual.

### 5. Render the report

Use the standard stacked + Convergence/Divergence layout from
`/council` Step 6. Add a one-line PR header at the top:

```
## Council on PR #<number> — <title>

Base: <base> · Head: <head> · Author: <author>
```

### 6. Offer to post a comment summary (opt-in)

After the report renders, ask (in the user's language):

> 1. Post a one-paragraph summary as a PR comment? (read-only otherwise)
> 2. Skip — keep the council output local

If picked **1**:

- Build a short summary: convergent points, divergent points, suggested
  actions. Keep it ≤ 800 chars.
- Run `gh pr comment <number> --body "<summary>"`.
- **Never** request changes, approve, or merge — comment only.

Suppress the comment offer when `personal.autonomy: on` (posting to a
public PR is a write operation that should always be explicit).

### Hard floor (restated)

`/council-pr` produces **text** and (on user opt-in) a **single PR
comment**. It does **NOT**:

- Approve, request changes, or merge a PR.
- Edit project files.
- Open new issues or PRs.
- Post comments without explicit user opt-in.

## Failure modes

- **`gh` not installed / not authed** → state the install command
  (`brew install gh && gh auth login`) and stop.
- **PR is closed / merged** → ask whether to proceed (council on a
  closed PR is fine for retrospectives) or cancel.
- **Diff too large** → bundler raises `BundleTooLarge`; suggest
  `/council files:<paths>` for a narrower review.

## See also

- `/council` — base orchestration entry point.
- `ai-council` skill — neutrality guidelines.
- `/review-changes` — internal four-judge variant for local diffs.
