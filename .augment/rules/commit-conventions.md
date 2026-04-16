---
type: "auto"
alwaysApply: false
description: "Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"
source: package
---

# Commit Conventions

All commit messages and squash/merge titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Format

- With scope: `<type>(<scope>): <description>`
- Without scope: `<type>: <description>`
- Always English. Imperative mood. Max 72 chars first line.

## Types

| Type | When |
|---|---|
| `feat` | New user-facing functionality |
| `fix` | Bug fix |
| `refactor` | Structure change, no behavior change |
| `docs` | Documentation only |
| `test` | Tests only |
| `chore` | Maintenance, deps, cleanup |
| `ci` | CI/CD, workflows |
| `style` | Formatting only |
| `perf` | Performance improvement |
| `build` | Build tooling, packaging |

## Scope

- Jira ticket ID when branch has one: `DEV-1234`
- Otherwise short area name: `api`, `auth`, `skills`
- Optional — only add when it improves clarity.

## Breaking changes

Mark with `!` or `BREAKING CHANGE:` footer: `feat(api)!: rename status values`

## Commit splitting

Mixed concerns → split into multiple commits. Don't hide unrelated changes in one.

## Examples

```
feat(DEV-1234): add absence type filter to working time report
fix(DEV-1234): handle null value in equipment import
refactor: extract user sync logic into dedicated service
ci(lint): add skill-lint workflow
```

→ Type selection rules, anti-patterns, decision checklist: `guidelines/php/git.md`
