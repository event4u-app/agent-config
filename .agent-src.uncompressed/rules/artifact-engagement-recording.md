---
type: "auto"
tier: "mechanical-already"
alwaysApply: false
description: "After a /implement-ticket or /work phase-step (refine/memory/analyze/plan/implement/test/verify/report) or full task — emit one telemetry:record call with consulted+applied ids when enabled"
source: package
triggers:
  - phrase: "/implement-ticket"
  - phrase: "/work"
  - keyword: "telemetry"
routes_to:
  - "contract:artifact-engagement-flow"
---

<!-- cloud_safe: noop -->

# Artifact Engagement Recording

**Iron Law.** After a `/implement-ticket` or `/work` phase-step, emit one
`telemetry:record` call with consulted + applied ids when telemetry is
enabled. Default-off; opt-in via `.agent-settings.yml`. Zero overhead when
disabled.

Body migrated to [`contract:artifact-engagement-flow`](../../docs/contracts/artifact-engagement-flow.md)
(per P4 of `road-to-kernel-and-router.md`). Trigger-set above activates this
routing under the `balanced` and `full` profiles.

The schema, CLI, and storage layer are owned by `scripts/telemetry/` and
the `./agent-config telemetry:record` / `telemetry:status` commands.

## Activation gate — read settings ONCE per task

Before the first phase-step runs, read
`telemetry.artifact_engagement.enabled`. Cache the value (and
`granularity`) for the whole task.

- `enabled: false` or section missing → rule is a **no-op**.
- `enabled: true` → continue with the cadence in the contract.

## Cloud Behavior

The `cloud_safe: noop` marker keeps this rule inert on cloud surfaces
(Claude.ai Web, Skills API). The cloud-bundle pipeline skips it.
