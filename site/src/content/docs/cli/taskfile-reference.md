---
title: Taskfile Reference
description: The headline maintainer tasks; the full battery lives in Taskfile.yml and taskfiles/.
---

Maintainers run [go-task](https://taskfile.dev) from the repo root. The headline
entrypoints:

| Task | Purpose |
|---|---|
| `task ci` | Run the full local CI chain (must pass before push) |
| `task ci-strict` | Same, WARN→ERROR (release-tag gate) |
| `task sync` | Regenerate `dist/agent-src/` + `.augment/`; refresh counts/settings |
| `task generate-tools` | Regenerate `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md` |
| `task lint-skills` | Lint all skills and rules |
| `task test` | Full test surface (bash integration + TS vitest) |
| `task release` | End-to-end release with auto-detected version bump |
| `task roadmap-progress` | Regenerate the roadmap dashboard |
| `task cost` | Capture the active session's token cost |

The full battery — dozens of `lint-*`, `check-*`, `validate-*`, `generate-*`,
`bench:*`, and `mcp:*` gates — is grouped across
[`Taskfile.yml`](https://github.com/event4u-app/agent-config/blob/main/Taskfile.yml)
and
[`taskfiles/`](https://github.com/event4u-app/agent-config/tree/main/taskfiles)
(`content.yml`, `ci-fast.yml`, `engine.yml`, `release.yml`, `mcp.yml`,
`dev.yml`, `bench-ab.yml`, `value.yml`). Run `task --list` for the complete set.
