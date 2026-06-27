---
type: "auto"
tier: "mechanical-already"
alwaysApply: false
description: "After a /implement-ticket or /work phase-step or full task — emit one telemetry:record call"
triggers:
  - phrase: "/implement-ticket"
  - phrase: "/work"
  - keyword: "telemetry"
routes_to:
  - "contract:artifact-engagement-flow"
load_context:
  - "../contexts/contracts/artifact-engagement-flow.md"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

## PII-exclusion-by-construction

The `telemetry:record` event carries **only** artifact ids (consulted /
applied) + structural counters — its type has **no field capable of holding
free-form content, prompt text, file bodies, or identifiers**. Privacy is a
property of the schema shape, not a scrubbing pass that could fail. Never widen
the event with a `payload` / `notes` / `extra: any` field. Same principle
`domain-safety-pii` § Surface 2 applies to logs.

## Activation gate — read settings ONCE per task

Before the first phase-step runs, read
`telemetry.artifact_engagement.enabled`. Cache the value (and
`granularity`) for the whole task.

- `enabled: false` or section missing → rule is a **no-op**.
- `enabled: true` → continue with the cadence in the contract.

## Cloud Behavior

The `cloud_safe: noop` marker keeps this rule inert on cloud surfaces
(Claude.ai Web, Skills API). The cloud-bundle pipeline skips it.
