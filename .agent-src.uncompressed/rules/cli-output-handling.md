---
type: "auto"
tier: "2a"
description: "Running verbose CLI output — git, tests, linters, docker, build tools, artisan, npm, composer. Wrap with rtk; tail/grep fallback"
source: package
triggers:
  - keyword: "git"
  - keyword: "phpstan"
  - keyword: "rector"
  - keyword: "phpunit"
  - keyword: "composer"
routes_to:
  - "skill:rtk-output-filtering"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Cli Output Handling

**Iron Law.** Wrap verbose CLI output with `rtk` when installed; fall back to `tail`/`grep` only when missing.

Body migrated to `skill:rtk-output-filtering` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
