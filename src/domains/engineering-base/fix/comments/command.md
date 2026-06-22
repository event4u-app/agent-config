---
model_tier: medium
name: fix-comments
pack: engineering-base
tier: 2
visibility: internal
cluster: fix
sub: comments
skills: [code-refactoring, quality-tools, git-workflow]
description: Review the code comments touched by the current branch and simplify, shorten, or remove each one
suggestion:
  eligible: true
  trigger_description: "simplify the comments in my branch, clean up code comments, remove redundant comments from my changes, trim comment noise"
  trigger_context: "a feature branch with code changes pending review"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix comments
## Instructions

Audit every code comment that the current branch added or changed and
apply the smallest edit that makes each one earn its place — simplify,
shorten, or remove. **Comment text only — never touch executable code.**

### 1. Gather the changed comments

- Current branch: `git branch --show-current`. If it is the default
  branch (`main` / `master`) → nothing to review, stop.
- Resolve the base and collect the diff (mirrors `/review-changes`):
  - `git diff --merge-base origin/main..HEAD` — committed changes vs. base
  - `git diff` — unstaged changes on top
- Scope the audit to **comments on lines the branch added or modified**
  (inside the diff hunks). Do **not** audit comments in untouched files
  or untouched regions — that is scope creep (`minimal-safe-diff`).

If both diffs are empty → stop, nothing to review.

### 2. Classify each comment

For every comment in the changed regions, assign one verdict:

| Verdict | When |
|---|---|
| **Remove** | Restates what the code already says (`// increment i`); commented-out code; obvious noise; stale comment that now contradicts the code; a TODO that is already done. |
| **Shorten** | Correct but verbose — multi-line where one line is enough, ceremony, filler. |
| **Simplify** | Right intent, unclear wording — tighten the phrasing without losing meaning. |
| **Keep** | Explains *why* (rationale, gotcha, non-obvious constraint, link to an issue), or is load-bearing per the guard list below. |

The bar: a comment earns its place only when it tells the reader
something the code cannot. Default to **Keep** whenever intent is unclear.

### 3. Never touch — guard list

These look like comments but are load-bearing. Leave them exactly as-is:

- **Tool directives** — PHPDoc that static analysis reads (`@var`,
  `@param`, `@return`, `@template`, `@phpstan-*`, `@psalm-*`);
  `// @ts-expect-error`, `// @ts-ignore`, `// eslint-disable*`;
  `# type: ignore`, `# noqa`, `# pragma`, `# pylint:`; Rector / ECS /
  Biome markers.
- **License / copyright headers** and SPDX identifiers.
- **Public-API doc blocks** that generate documentation, unless the
  comment is plainly wrong.
- `@deprecated`, `@see`, security notes, and any "why" note.
- i18n / translation keys.

When unsure whether a comment is load-bearing → **keep it**.

### 4. Apply the edits

- Edit each comment per its verdict with the smallest possible change.
- Preserve indentation and the file's comment style; match the
  comment's existing language.
- Do **not** reflow, reformat, or re-indent the surrounding code
  (`minimal-safe-diff`).

### 5. Verify

- If any doc-comment or annotation was edited in a typed language, run
  the project's type-checker / linter on the changed files (see
  `quality-tools`) to confirm nothing removed was load-bearing.
- `git diff` — confirm the only changed lines are comment lines.

### Output

A summary table, then the totals:

| File:line | Verdict | Before → After |
|---|---|---|

`Reviewed N · removed X · shortened Y · simplified Z · kept K.`

### Rules

- **Do NOT commit or push.** Only apply local edits.
- **Comments only.** Never alter executable code — only comment text or
  whole-comment removal.
- When a comment's intent is unclear, keep it and note it in the summary.
