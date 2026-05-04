---
type: "auto"
alwaysApply: false
description: "After a /implement-ticket or /work phase-step (refine/memory/analyze/plan/implement/test/verify/report) or full task — emit one telemetry:record call with consulted+applied ids when enabled"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/artifact-engagement-recording-mechanics.md
---

<!-- cloud_safe: noop -->

# Artifact Engagement Recording

Records which **skills, rules, commands, guidelines, personas** the agent
actually consulted and applied during a `/implement-ticket` or `/work` run.
Default-off; opt-in via `.agent-settings.yml`. Zero overhead when disabled.

The schema, CLI, and storage layer are owned by
[`scripts/telemetry/`](../../../scripts/telemetry/) and the
`./agent-config telemetry:record` / `telemetry:status` commands. The
recording contract lives in
[`docs/contracts/artifact-engagement-flow.md`](../../docs/contracts/artifact-engagement-flow.md).
This rule says **when** to call the CLI, not how the file is structured.

## Activation gate — read settings ONCE per task, then cache

Before the first `/implement-ticket` or `/work` step runs, read
`telemetry.artifact_engagement.enabled` from `.agent-settings.yml`. Cache
the value (and `granularity`) for the whole task.

- `enabled: false` or section missing → rule is a **no-op**. Do not import
  the script, do not open the log, do not mention recording. Skip the rest
  of this rule.
- `enabled: true` → continue with the cadence below.

Use `./agent-config telemetry:status --format json` if the value is
not already in working memory; the call is read-only and never touches
the log file.

## Cadence — depends on `granularity`

| `granularity` | When to emit | Coalescing |
|---|---|---|
| `task` *(default)* | Once, when the eight-step flow ends (success, blocked, partial — any terminal state) | All consulted/applied artefacts from refine through report merged into a single event |
| `phase-step` | At the close of each phase-step (refine, memory, analyze, plan, implement, test, verify, report) | One event per step; per-step consulted/applied lists only |

Within a single boundary, **dedupe** consulted and applied lists. A skill
consulted three times in the same boundary records once.

## What counts as consulted vs applied

- **`consulted`** — the agent **read** the artefact this boundary: opened
  its `SKILL.md`, scanned its rule body, viewed its frontmatter,
  referenced its guideline, checked its persona contract, dispatched its
  command. Reading does not imply behaviour change.
- **`applied`** — the artefact **influenced the output** this boundary:
  its instructions changed how the agent answered, what code it wrote,
  what tools it ran, or what halt surface it produced. Applied is a
  strict subset of consulted.

When in doubt → record as `consulted` only. Over-recording `applied`
inflates the engagement signal and defeats the purpose.

## Mechanics — CLI invocation, privacy contract, failure handling

The exact `telemetry:record` call shape with all flags, the privacy
contract (what NEVER goes into a record), the failure-mode handling
(do NOT block the user's task), and the "what this rule does NOT do"
catalog live in
[`contexts/communication/rules-auto/artifact-engagement-recording-mechanics.md`](../contexts/communication/rules-auto/artifact-engagement-recording-mechanics.md).

## See also

- [`docs/contracts/artifact-engagement-flow.md`](../../docs/contracts/artifact-engagement-flow.md) — recording contract details
- [`/implement-ticket`](../commands/implement-ticket.md) and [`/work`](../commands/work.md) — boundary points where this rule fires
- [`scripts/telemetry/`](../../../scripts/telemetry/) — engine source
- [`agent-settings`](../templates/agent-settings.md) — `telemetry.artifact_engagement.*` reference
