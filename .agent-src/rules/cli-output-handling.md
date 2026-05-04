---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Running CLI commands that produce verbose output — git, tests, linters, docker, build tools, artisan, npm, composer. Wrap with rtk when installed; tail/grep is fallback."
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/cli-output-handling-mechanics.md
---

# Development Efficiency

Loaded for code, tests, quality tools, CLI, analysis. Communication / response style → always-loaded `token-efficiency`.

## Iron Law — rtk first, tail/grep fallback

```
IF `rtk` IS INSTALLED, WRAP VERBOSE COMMANDS WITH rtk.
USE tail / grep / cat ONLY AS FALLBACK WHEN rtk HAS NO MATCHING SUBCOMMAND.
NEVER PIPE A STILL-RUNNING LONG COMMAND THROUGH tail — IT BUFFERS TO EOF.
```

Detection: `rtk_installed: true` in `.agent-settings.yml`, or `which rtk`
exits 0. Caching the result for the session is fine.

| Verbose command | Use | Fallback (no rtk) |
|---|---|---|
| CI-style suites, full test runs | `rtk err <cmd>` — only errors/warnings | redirect → tail → grep |
| Unit tests | `rtk test <cmd>` — only failures | redirect → tail → grep |
| `git status`/`log`/`diff` | `rtk git <subcmd>` | plain |
| `gh pr list`, `gh run view` | `rtk gh <subcmd>` | plain |
| Generic noisy command | `rtk summary <cmd>` or `rtk err <cmd>` | redirect → tail |

For the full rtk subcommand catalog and project-local filter setup → see
the `rtk-output-filtering` skill.

## Lookup material — see mechanics

Codebase-navigation tips, the redirect-summarize-target fallback
pattern (with the three-step `tail`/`grep` recipe), the general rules
(exit code first, summary line, targeted `grep`, read-once-act-move-on,
iterative fixing), and the CLI-over-MCP catalog all live in
[`contexts/communication/rules-auto/cli-output-handling-mechanics.md`](../contexts/communication/rules-auto/cli-output-handling-mechanics.md).
Pull it whenever a verbose command is about to run without an `rtk`
match.

## Exceptions

- **Small output** (< 30 lines): Read directly, no redirect needed.
- **Debugging**: OK to read more context around the specific error.
- **User asks** for full output: Show it.
