---
type: "auto"
alwaysApply: false
description: "Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"
source: package
---

# Commit Conventions

All commit messages and squash/merge titles must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Format

- With scope: `<type>(<scope>): <description>`
- Without scope: `<type>: <description>` (omit parentheses when no scope)
- **Always English** — regardless of user's language.
- **Imperative mood** ("add feature", not "added feature").
- **First line max 72 characters.**

## Types

| Type | When |
|---|---|
| `feat` | New user-facing functionality |
| `fix` | Bug fix |
| `refactor` | Code/structure change, no behavior change |
| `docs` | Documentation only |
| `test` | Tests only |
| `chore` | Maintenance (deps, configs, tooling, cleanup) |
| `ci` | CI/CD and workflow changes |
| `style` | Code style (formatting, no logic change) |
| `perf` | Performance improvement |
| `build` | Build tooling / packaging changes |

## Scope

- Use the **Jira ticket ID** as scope when the branch contains one (e.g. `DEV-1234`).
- Otherwise use a short module or area name (e.g. `api`, `auth`, `skills`).
- Scope is optional — only add when it improves clarity.

## Breaking changes

Mark explicitly with `!` after type/scope or `BREAKING CHANGE:` in footer:

```
feat(api)!: rename invoice status values
refactor(auth)!: remove legacy session flow
```

## Commit splitting

If a change mixes unrelated concerns, split into multiple commits.
Do NOT hide bug fixes, CI work, docs, and refactors in one commit.

## Examples

```
feat(DEV-1234): add absence type filter to working time report
fix(DEV-1234): handle null value in equipment import
test(DEV-1234): add component test for working time controller
refactor: extract user sync logic into dedicated service
chore: update PHP quality package to 2.1.0
ci(lint): add skill-lint workflow
docs(roadmap): add phase 3 implementation plan
```

→ Full type selection rules and anti-patterns: see guideline `guidelines/php/git.md`.
