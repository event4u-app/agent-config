---
type: "auto"
tier: "2a"
description: "Running verbose CLI output — git, tests, linters, docker, build tools, artisan, npm, composer. Wrap with rtk; tail/grep fallback"
triggers:
  - keyword: "git"
  - keyword: "phpstan"
  - keyword: "rector"
  - keyword: "phpunit"
  - keyword: "composer"
  - keyword: "npm"
  - keyword: "pnpm"
  - keyword: "yarn"
  - keyword: "eslint"
  - keyword: "tsc"
  - keyword: "vitest"
  - keyword: "jest"
  - keyword: "pytest"
  - keyword: "ruff"
  - keyword: "mypy"
  - keyword: "pyright"
  - keyword: "cargo"
  - keyword: "golangci-lint"
  - keyword: "docker"
  - keyword: "kubectl"
  - keyword: "terraform"
  - phrase: "go test"
  - phrase: "go build"
routes_to:
  - "skill:rtk-output-filtering"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Cli Output Handling

**Iron Law.** Wrap verbose CLI output with `rtk` when installed; fall back to `tail`/`grep` only when missing.

Body migrated to `skill:rtk-output-filtering` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
