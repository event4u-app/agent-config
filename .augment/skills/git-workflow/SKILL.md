---
name: git-workflow
description: "Use when working with Git — branch naming, commit messages, PR conventions, rebasing, or the code review process."
source: package
---

# git-workflow

## When to use

Use when preparing PRs, finishing branches, or following the team's Git workflow.

Do NOT use when:
- Code writing or review (use `coder` or `code-review` skill)
- CI/CD pipeline changes (use `github-ci` skill)

## Conventions

→ See guideline `php/git.md` for branch naming, commit message format, PR conventions.
→ See `commit-conventions` rule (always loaded) for commit format.

## Procedure: Before opening a PR

1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill).
2. Run tests: `php artisan test`.
3. Rebase onto `main`.
4. Fill in PR template completely.

## Procedure: Finish a branch

When implementation is complete and all tests pass:

```
Work complete. What would you like to do?

1. Push and create a Pull Request
2. Keep the branch as-is (I'll handle it later)
3. Discard this work
```

### Option 1: Push and create PR

1. Run quality pipeline + tests.
2. `git push -u origin <branch>`.
3. `gh pr create` using PR template.

### Option 2: Keep as-is

Report: "Branch `<name>` preserved locally." — do nothing.

### Option 3: Discard

**Confirm first** — list branch name and commit count.
Wait for explicit confirmation. Then:
```bash
git checkout main
git branch -D <feature-branch>
```

## PR template

The project uses `.github/pull_request_template.md`:
1. Jira ticket link (badge)
2. Description — what and why
3. Type of change
4. Checklist (docs, rebase, quality, review, tests, QA)
5. Links + screenshots

## Default branch

- `main` is default/production branch.
- Merge strategy: merge commits (not squash).

## Output format

1. Commits following conventional commit format
2. PR description with structured sections (if creating PR)

## Gotcha

- Never commit/push/merge without explicit user permission.
- Keep subject line under 72 chars.
- Don't rebase shared branches.
- `git stash` can lose work — prefer WIP commits.

## Do NOT

- Do NOT commit directly to `main`.
- Do NOT push without running quality tools first.
- Do NOT force-push to shared branches.

## Auto-trigger keywords

- Git workflow
- branch naming
- commit message
- PR convention
