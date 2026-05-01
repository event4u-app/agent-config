---
type: "auto"
alwaysApply: false
description: "After completing a /implement-ticket or /work phase-step (refine, memory, analyze, plan, implement, test, verify, report) or full task — emit one telemetry:record call with consulted+applied artefact ids when telemetry.artifact_engagement.enabled is true"
source: package
---

<!-- cloud_safe: noop -->

# Artifact Engagement Recording

Records which **skills, rules, commands, guidelines, personas** the agent
actually consulted and applied during a `/implement-ticket` or `/work` run.
Default-off; opt-in via `.agent-settings.yml`. Zero overhead when disabled.

The schema, CLI, and storage layer are owned by
[`scripts/telemetry/`](../../../scripts/telemetry/) and the
`./agent-config telemetry:record` / `telemetry:status` commands shipped
in Phase 1+2 of the
[`road-to-artifact-engagement-telemetry`](../../../agents/roadmaps/road-to-artifact-engagement-telemetry.md)
roadmap. This rule says **when** to call the CLI, not how the file is
structured.

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

## What to record — id-only, no payload

```bash
./agent-config telemetry:record \
  --task-id "$TASK_ID" \
  --boundary task \
  --consulted skills:php-coder \
  --consulted skills:eloquent \
  --consulted rules:scope-control \
  --applied skills:php-coder \
  --applied rules:scope-control
```

- `--task-id` — the ticket key (`PROJ-123`) for `/implement-ticket`, or a
  short opaque slug derived from the prompt for `/work`. **Never** a
  branch name, a file path, or a free-text title.
- `--boundary` — `task` or `phase-step`, matching the cadence above.
- `--consulted <kind>:<id>` — repeat per artefact. `<kind>` is one of
  `skills`, `rules`, `commands`, `guidelines`, `personas`.
- `--applied <kind>:<id>` — repeat per artefact actually applied.
- Exit `0` always when disabled (silent). Exit `1` on schema validation
  failure (rule must NOT swallow this — surface to the user). Exit `2`
  on IO failure.

## Privacy contract — what NEVER goes into a record

The CLI rejects most violations on the input boundary, but the agent must
not even attempt these:

- ❌  File paths (`src/Foo.php`, `tests/...`) — id fields are
  artefact identifiers only.
- ❌  Source code, prompt text, ticket body, AC text.
- ❌  Branch names, commit shas, PR numbers, URLs.
- ❌  Secrets, env vars, credentials, customer data.
- ❌  Free-text strings longer than 200 chars (CLI enforces; agent must
  not generate).

When in doubt → **don't record**. A missing event is cheap; a leaked
prompt is not.

## Failure modes — DO NOT block the user's task

- Schema rejection (CLI exit `1`) → log the message internally, continue
  the user's task. Do **not** halt the dispatch loop.
- IO failure (CLI exit `2`) → same. The telemetry is **observation**, not
  a delivery requirement.
- Settings malformed → already handled by the CLI: it falls back to
  disabled and exits `0`. Agent treats it as "disabled this task".

The only error the agent surfaces is when the user explicitly asked for
recording (`telemetry:status` confirms enabled) but no event reached the
log — that is a real bug, not a swallowed error.

## What this rule does NOT do

- Run when `enabled: false` (cost floor is zero — see
  [`tests/telemetry/test_cost_floor.py`](../../../tests/telemetry/test_cost_floor.py)).
- Track the agent's tool calls, file reads, or token spend — that is
  out of scope, see the roadmap's "out-of-scope" section.
- Decide retirement. Phase 4's aggregator + report renderer are the only
  consumers that may interpret the JSONL.
- Run on cloud surfaces (Claude.ai Web, Skills API). The
  `cloud_safe: noop` marker keeps it inert there.

## See also

- [`road-to-artifact-engagement-telemetry`](../../../agents/roadmaps/road-to-artifact-engagement-telemetry.md) — phase contract
- [`agents/contexts/artifact-engagement-flow.md`](../../../agents/contexts/artifact-engagement-flow.md) — recording contract details
- [`/implement-ticket`](../commands/implement-ticket.md) and [`/work`](../commands/work.md) — boundary points where this rule fires
- [`scripts/telemetry/`](../../../scripts/telemetry/) — engine source
- [`agent-settings`](../templates/agent-settings.md) — `telemetry.artifact_engagement.*` reference
