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
load_context:
  - "contexts/contracts/artifact-engagement-flow.md"
---

<!-- cloud_safe: noop -->

# Artifact Engagement Recording

**Iron Law.** After a `/implement-ticket` or `/work` phase-step, emit one
`telemetry:record` call with consulted + applied ids when telemetry is
enabled. Default-off; opt-in via `.agent-settings.yml`. Zero overhead when
disabled. Recording contract + privacy floor:
[`contexts/contracts/artifact-engagement-flow.md`](../contexts/contracts/artifact-engagement-flow.md).

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
