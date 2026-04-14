---
type: "auto"
alwaysApply: false
description: "Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"
source: package
---

# Commit Conventions

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Format

Valid formats:

- With scope: `<type>(<scope>): <description>`
- Without scope: `<type>: <description>` (omit parentheses when no scope is used)

- **Commit messages are always in English** — regardless of the user's language.
- **Description in imperative mood** ("add feature", not "added feature").
- **First line max 72 characters.**

## Types

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change (no new feature, no bug fix) |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, configs, tooling) |
| `style` | Code style (formatting, no logic change) |
| `perf` | Performance improvement |

## Scope

- Use the **Jira ticket ID** as scope when the branch contains one (e.g. `DEV-1234`).
- Otherwise use a short module or area name.
- Scope is optional but recommended.

## Examples

```
feat(DEV-1234): add absence type filter to working time report
fix(DEV-1234): handle null value in equipment import
test(DEV-1234): add component test for working time controller
refactor: extract user sync logic into dedicated service
chore: update PHP quality package to 2.1.0
```
