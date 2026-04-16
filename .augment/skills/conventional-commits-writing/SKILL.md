---
name: conventional-commits-writing
description: "Use when generating, reviewing, or correcting Conventional Commit messages or squash merge titles."
source: package
---

# conventional-commits-writing

## When to use

- Generating commit message from staged changes
- Generating squash merge title from PR
- Deciding correct type for a change
- Reviewing/correcting commit messages
- Splitting vague changes into multiple commits

NOT: explaining standard (reference rule), git workflow (use `git-workflow`)

## Procedure: Generate

1. **Intent** — feat/fix/refactor/docs/test/ci/chore/perf/build/style. Classify by intent, not file type.
2. **Mixed concerns?** — split into multiple commits or choose dominant net effect for squash title.
3. **Scope** — Jira ID or area name. Only if it adds clarity.
4. **Description** — intent, not implementation. Imperative. Max 72 chars. No generic filler.
5. **Breaking?** — add `!` or `BREAKING CHANGE:` footer:

```
feat(api)!: rename invoice status values
```

6. **Validate** — type matches intent? scope useful? not hiding multiple concerns?

## Procedure: Review

Parse → check type vs diff → check scope → check description clarity → suggest corrections.

## Procedure: Squash merge title

Read all PR commits → identify net effect → write single Conventional Commit summarizing it.

## Output

1. Recommended message(s)
2. Brief type rationale
3. Split suggestion if needed

## Gotcha

- Model overuses `chore`/`refactor` — classify by intent, not effort
- File type ≠ commit type (`.md` change can be `feat`)
- `refactor` = NO behavior change — if behavior changes, use `feat`/`fix`
- Squash title = net effect, not internal details

## Do NOT

- Do NOT use vague messages: `update stuff`, `fix bug`, `changes`
- Do NOT use `refactor` for bug fixes
- Do NOT use `chore` for meaningful behavior changes
- Do NOT hide multiple unrelated concerns in one message
- Do NOT omit breaking-change markers when compatibility changes

## References

- Rule: `commit-conventions` — format, types, scope
- Guideline: `guidelines/php/git.md` — selection rules, anti-patterns, checklist
- Command: `/commit` — uses this skill
