---
trigger: model_decision
description: Running CLI commands that produce verbose output — git, tests, linters, docker, build tools, artisan, npm, composer. Wrap with rtk; tail/grep fallback
globs: 
---

# Cli Output Handling

**Iron Law.** Wrap verbose CLI output with `rtk` when installed; fall back to `tail`/`grep` only when missing.

Body migrated to `skill:rtk-output-filtering` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
