---
name: conventional-commits-writing
description: "Use when writing commit messages or squash-merge titles — `feat:`, `fix:`, `chore:`, scopes, breaking changes — even when the user just says 'commit this' without naming Conventional Commits."
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - engineering
packs:
  - engineering-base
---

# conventional-commits-writing

## When to use

Use this skill when:

- Generating a commit message from staged changes
- Generating a squash merge title from a PR
- Deciding the correct Conventional Commit type for a change
- Reviewing whether a commit message is correct
- Splitting one vague change into multiple commit messages

Do NOT use when:

- Only explaining the Conventional Commits standard (just reference the rule)
- The message is already correct and does not need review
- Following the Git workflow (use `git-workflow` skill)

## Procedure: Generate commit message

### 1. Identify the actual intent

Determine whether the change is:

- New behavior → `feat`
- Bug fix → `fix`
- Structural cleanup → `refactor`
- Docs only → `docs`
- Tests only → `test`
- CI/build/tooling → `ci` or `build`
- Maintenance → `chore`
- Performance → `perf`
- Formatting only → `style`

Classify by **user-visible or system-relevant intent**, not by file type alone.

### 2. Detect mixed concerns

Check whether the change includes more than one unrelated concern.

If yes:

- Suggest splitting into multiple commits
- Or choose the dominant net effect for squash merge title

### 3. Choose scope

Add a scope only if it improves clarity:

- Jira ticket ID: `DEV-1234`
- Module/area: `api`, `auth`, `skills`, `rules`, `ci`

### 4. Write the description

- State the intent clearly
- Avoid generic filler (`update stuff`, `fix things`)
- Stay concise — max 72 chars total for first line
- Imperative mood: "add", "fix", "remove" — not "added", "fixed", "removed"

### 5. Check for breaking change

If compatibility is broken, add `!` after type/scope:

```
feat(api)!: rename invoice status values
```

Or add `BREAKING CHANGE:` in the commit body/footer.

### 6. Validate

- Type matches intent?
- Scope is useful (not noise)?
- Description is specific (not generic)?
- Not hiding multiple unrelated changes?
- Breaking changes are marked?

## Procedure: Review existing commit message

1. Parse the message into type, scope, description
2. Check type accuracy against the actual diff
3. Check scope usefulness
4. Check description clarity and specificity
5. Suggest corrections if any check fails

## Procedure: Generate squash merge title

1. Read all commits in the PR
2. Identify the **net effect** — what does the PR accomplish overall?
3. Write a single Conventional Commit message summarizing the net effect
4. Do not list every internal commit — summarize

## Output format

1. Recommended commit message(s)
2. Brief rationale for type choice
3. Split suggestion if the change should be multiple commits

## Gotcha

- The model tends to overuse `chore` and `refactor` — classify by intent, not by effort
- File type alone does not determine commit type (e.g. a `.md` change can be `feat` if it's a new feature doc)
- Squash merge titles should describe the net effect, not every internal detail
- `refactor` means NO behavior change — if behavior changes, use `feat` or `fix`

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every commit message you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the subject states the
  change in 50 chars; no scaffolding ("This commit will…").
- Per the post-action summary suppression, the body lists changed
  surfaces in bullets — no closing paragraph re-summarizing them.
- Per the cheap-question check, never propose a `feat` vs. `chore`
  numbered choice when the type is decidable from the diff.

**Pre-save self-check:**
1. Does the subject line carry filler ("various improvements",
   "general updates")?
2. Does the body re-narrate the diff instead of stating intent?
3. Are co-author / attribution footers present without explicit user
   request (per
   [`no-attribution-footers`](../../rules/no-attribution-footers.md))?
4. Is the type / scope chosen from the diff, not from the asker's
   framing?

## Do NOT

- Do NOT use vague messages: `update stuff`, `fix bug`, `changes`
- Do NOT use `refactor` for bug fixes
- Do NOT use `chore` for meaningful behavior changes
- Do NOT hide multiple unrelated concerns in one message
- Do NOT omit breaking-change markers when compatibility changes

## References

- Rule: `commit-conventions` — base format, types, scope, examples
- Guideline: `docs/guidelines/php/git.md` — type selection rules, anti-patterns, decision checklist
- Command: `/commit` — uses this skill for message generation
