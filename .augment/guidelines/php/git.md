# Git & Version Control Guidelines

> Project-specific Git conventions. Branch naming, commit messages, PR workflow.

**Related Skills:** `git-workflow`, `code-review`
**Related Rules:** `no-commit.md`

## Branch Naming

```
{type}/{ticket-id}/{short-description}
```

| Type | When |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `hotfix/` | Urgent production fix |
| `chore/` | Maintenance, refactoring, tooling |
| `docs/` | Documentation changes |
| `test/` | Test additions/changes |

### Examples

```
feat/DEV-1234/user-notification-preferences
fix/DEV-5678/null-pointer-in-import
chore/refactor-agent-setup
hotfix/DEV-999/critical-payment-bug
```

### Rules

- Always include the Jira ticket ID when one exists
- Use kebab-case for the description part
- Keep branch names short but descriptive

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change (no new feature, no bug fix) |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, configs, tooling) |
| `style` | Code style (formatting, no logic change) |
| `perf` | Performance improvement |

### Examples

```bash
feat(DEV-2133): send email to customer when product is shipped
fix(import): handle null values in equipment JSON
refactor: extract user sync logic into dedicated service
```

### Rules

- Scope is optional but recommended (Jira ticket ID or module name)
- Description in imperative mood ("add feature", not "added feature")
- Keep the first line under 72 characters

## Pull Requests

- PR title follows commit message format: `feat(DEV-1234): short description`
- Fill in the PR template (checklist, description, testing notes)
- Link the Jira ticket in the PR description
- Ensure all quality gates pass before requesting review

