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

Mark with `!` or `BREAKING CHANGE:` footer:

```
feat(api)!: rename invoice status values
refactor(auth)!: remove legacy session flow
```

## Commit splitting

Mixed concerns → split into multiple commits. Don't hide unrelated changes in one.

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

→ Type selection rules, anti-patterns, decision checklist: `docs/guidelines/php/git.md`
