---
name: git-workflow
description: "Use when working with Git — branch naming, commit messages, PR conventions, rebasing, or the code review process."
source: package
---

# git-workflow

## When to use

Use this skill when creating branches, writing commit messages, preparing PRs, or following the team's Git workflow.


Do NOT use when:
- Code writing or review (use `coder` or `code-review` skill)
- CI/CD pipeline changes (use `github-ci` skill)

## Branch naming

Based on observed patterns in the repository:

```
{type}/{ticket}/{description}

Examples:
feat/DEV-5967/delete-material-delivery-bill
fix/admin-permission-removal
chore/enhance-import-logging
chore/optimize-create-working-times-endpoint-refactor
refactor/DEV-1234/improve-service-layer
```

### Types

| Prefix | When to use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Maintenance, cleanup, tooling |
| `refactor/` | Code refactoring |
| `docs/` | Documentation only |
| `test/` | Test additions or changes |

### Rules

- Include the **Jira ticket ID** when available: `feat/DEV-1234/description`.
- Use **kebab-case** for the description.
- Keep it short but descriptive.

## Commit messages

### Format

```
{type}: {description}

Examples:
feat: add material delivery bill deletion
fix: remove admin permissions without logout
chore: enhance customer software import logging
refactor(DEV-5967): override
```

### Conventional commits

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, tooling |
| `refactor` | Code refactoring |
| `docs` | Documentation |
| `test` | Tests |
| `ci` | CI/CD changes |

### Rules

- Use lowercase for the type prefix.
- Use imperative mood: "add feature" not "added feature".
- Include ticket ID in scope when relevant: `refactor(DEV-5967): description`.
- Keep the first line under 72 characters.

## Pull requests

### PR template

The project uses a PR template (`.github/pull_request_template.md`) with:

1. **Jira ticket link** — badge linking to the ticket.
2. **Description** — what changed and why.
3. **Type of change** — bug fix, refactoring, new feature, breaking change, docs.
4. **Checklist:**
   - Documentation added/updated or not needed
   - Rebased onto main
   - Quality pipeline executed (PHPStan + Rector + ECS)
   - Review requested (Jira + Slack)
   - Tests added/updated or not needed
   - Changes tested by QA/PO/Support (if needed)
5. **Links** — Jira ticket URL.
6. **Screenshots** — if applicable.

### Before opening a PR

1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill).
2. Run tests: `php artisan test`.
3. Rebase onto `main`.
4. Fill in the PR template completely.

## Code review

See `code-review` skill for the points-based review gate system.

Key points:
- PRs require team reviews based on `CODEOWNERS`.
- Review points are based on PR size (LOC).
- Backend team reviews are required for PHP changes.

## Default branch

- **`main`** is the default/production branch.
- All feature branches are created from and merged into `main`.
- Merge strategy: merge commits (not squash) based on observed patterns.

## Finishing a branch

When implementation is complete and all tests pass, present the user with clear options:

```
Work complete. What would you like to do?

1. Push and create a Pull Request
2. Keep the branch as-is (I'll handle it later)
3. Discard this work
```

### Option 1: Push and create PR

1. Run quality pipeline: PHPStan → Rector → ECS → PHPStan (see `quality-tools` skill).
2. Run tests: `php artisan test`.
3. Push branch: `git push -u origin <branch>`.
4. Create PR with `gh pr create` using the PR template.

### Option 2: Keep as-is

Report: "Branch `<name>` preserved locally." — do nothing else.

### Option 3: Discard

**Confirm first** — list what will be deleted (branch name, commit count).
Wait for explicit "discard" confirmation. Then:
```bash
git checkout main
git branch -D <feature-branch>
```

### Rules

- **Never** proceed with a failing test suite.
- **Never** discard without typed confirmation.
- **Never** push or create PRs without explicit user request.

## Agent rules

- **NEVER commit, push, or merge** unless explicitly asked by the user.
- **NEVER rebase or force-push** without explicit permission.
- When in doubt, ask first.


## Auto-trigger keywords

- Git workflow
- branch naming
- commit message
- PR convention

## Gotcha

- Never commit, push, or merge without explicit user permission — scope-control rule overrides everything.
- The model tends to create overly long commit messages — keep the subject line under 72 chars.
- Don't rebase branches that others are working on — always ask first.
- `git stash` can lose work silently if you forget to `stash pop` — prefer committing WIP instead.

## Do NOT

- Do NOT commit directly to `main`.
- Do NOT push without running quality tools first.
- Do NOT create PRs without filling in the template.
- Do NOT merge without required reviews.
- Do NOT force-push to shared branches.
