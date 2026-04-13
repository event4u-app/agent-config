---
name: git-workflow
description: "Use when working with Git — branch naming, commit messages, PR conventions, rebasing, or the code review process."
---

# git-workflow

## When to use

Branches, commits, PRs, Git workflow. NOT for: coding (`coder`), review (`code-review`), CI (`github-ci`).

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
   - Quality tools executed (`quality:finalize`)
   - Review requested (Jira + Slack)
   - Tests added/updated or not needed
   - Changes tested by QA/PO/Support (if needed)
5. **Links** — Jira ticket URL.
6. **Screenshots** — if applicable.

### Before opening a PR

1. Run quality tools: `php artisan quality:finalize`.
2. Run tests: `php artisan test`.
3. Rebase onto `main`.
4. Fill in the PR template completely.

## Review: see `code-review` skill. CODEOWNERS, size-based review points, backend reviews for PHP.

## Default: `main`. Merge commits (not squash).

## Finishing: 1. Push+PR (quality→tests→push→`gh pr create`) | 2. Keep as-is | 3. Discard (confirm first).

Never: failing tests, discard without confirmation, push/PR without explicit request.

## NEVER commit/push/merge/rebase/force-push without explicit permission.

## Gotcha: scope-control overrides, subject <72 chars, no rebase on shared branches, stash can lose work.

## Do NOT: commit to main, push without quality tools, PR without template, merge without reviews, force-push shared.
