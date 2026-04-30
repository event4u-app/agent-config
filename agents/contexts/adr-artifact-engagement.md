# ADR — Artefact-Engagement Telemetry

> **Status:** Decided · Phases 1–6 shipped, Phase 7 docs in progress · 2026-04-30
> **Context:** [`artifact-engagement-flow.md`](artifact-engagement-flow.md) ·
> [`road-to-artifact-engagement-telemetry.md`](../roadmaps/road-to-artifact-engagement-telemetry.md)
> **Recording rule:** [`artifact-engagement-recording`](../../.agent-src.uncompressed/rules/artifact-engagement-recording.md)
> **Orthogonal to:** R1 (`adr-work-engine-rename.md`) and R2
> (`adr-prompt-driven-execution.md`) — the engine boundary is read-only
> from this layer.

## Decision

Ship a maintainer-targeted, **default-off**, local-only measurement layer
that records which **skills, rules, commands, and guidelines** the agent
actually consults and applies during a `/implement-ticket` or `/work` run.
Output is a JSONL log under the project root; reports are produced by
`./agent-config telemetry:report` and bucketed into Essential / Useful /
Retirement Candidates by quartile of the applied/consulted ratio.

The system is bound by a **redaction floor** at every write *and* every
export: artefact ids must be repository-internal identifiers — paths,
extensions, control characters, and whitespace are forbidden and rejected
with a structured `EngagementSchemaError` (exit 1 / 2 in CLI scripts).

## Why this was a real question

Three concrete pressures converged:

1. **Skill drift.** The package ships 125 skills, 50 rules, 75 commands.
   Lint catches structural rot; nothing measured *engagement*. We had no
   evidence-based way to retire stale artefacts or sharpen weak triggers.
2. **Trigger-quality eval feedback** (`agents/docs/trigger-evals-poc-findings.md`)
   showed eval-style synthetic prompts could not distinguish "consulted
   but ignored" from "applied" — only runtime telemetry can.
3. **R1/R2 stability gate.** The `work_engine` dispatcher is byte-stable
   under the Golden-Transcript harness. Any feature that touches the
   engine has to be observable from outside the dispatcher, not threaded
   through it — telemetry has to live at the agent boundary, not in the
   directives.

Three alternatives were rejected:

- **Engine-side counters.** Rejected: pollutes byte-stable directive
  contracts, defeats the GT harness, and ties measurement to the Python
  module instead of the agent's actual decision surface.
- **Trigger-eval expansion only.** Rejected: synthetic prompts cannot
  observe what the agent *applies*, only what the trigger language
  matches. The applied/consulted gap is the whole point.
- **Cloud-side opt-in metrics.** Rejected: cross-project sharing creates
  leak surface; consumers must never see prompts; maintainers must
  control the data without touching infrastructure.

## Default-off doctrine

The whole feature performs **zero file IO** when
`telemetry.artifact_engagement.enabled` is unset or `false`. The CLI
scripts return `0` silently before parsing payloads, before constructing
schema objects, before opening log paths. The recording rule
(`artifact-engagement-recording`) is a no-op under the gate. This is
non-negotiable: any future enhancement that breaks the silent-exit path
is a regression.

Consumers see no prompts, no settings additions, no onboarding step. The
`/onboard` command emits a one-screen *hint* (Step 9) describing the
feature; that hint is informational only and never asks a question.

## Privacy and redaction contract

Recorded fields are explicit:

- `task_id` — repository-internal identifier (e.g. `ticket-AET-PHASE5`).
- `boundary_kind` — `task` | `phase-step` | `tool-call`.
- `consulted` / `applied` — `kind: [id…]` maps where each id is a
  repository-internal artefact name.
- `ts` — UTC ISO-8601.
- `tokens_estimate` — optional, integer.

Every id passes through `check_id_redaction`:

- No path separators (`/`, `\`).
- No file extensions (`.py`, `.md`, …) — the dotted form is forbidden.
- No control characters or whitespace.
- Non-empty after strip.

The same gate runs on **write** (boundary recorder) and on **export**
(report renderer in JSON and Markdown), so a tampered or legacy log
cannot leak through reports. Violations raise `EngagementSchemaError`
and exit `1`.

Hand-audit recipe for maintainers:
[`agents/contexts/artifact-engagement-flow.md`](artifact-engagement-flow.md#privacy-and-redaction-contract).

## Schema versioning and deprecation horizon

`schema_version: 1` is the only currently-shipped version. The aggregator
silently skips lines whose `schema_version` it does not recognize and
counts them under `skipped_lines` in the report header. This makes
backwards-compatible additions safe (new optional fields are ignored by
old aggregators); breaking changes require a `schema_version: 2` bump
and a deprecation note in `CHANGELOG.md`.

Logs are local-only and not part of the package contract — there is no
upgrade path for consumer-side log data. Maintainers wipe their
`output.path` before running on a new schema version.

## Consequences

**Positive.** Maintainers gain a measured engagement signal; the
default-off doctrine isolates blast radius to opt-in cohorts; the
redaction floor makes the log shareable in low-trust contexts (PR
attachments, issue comments) without leaking project structure; the
reporter is byte-stable across logs because the renderer re-validates.

**Negative.** Two write/export gates duplicate the redaction logic
intentionally — defence-in-depth at the cost of one extra validator call
per event. Acceptable: redaction violations are rare, and the export
gate prevents legacy-log foot-guns.

**Open.** A 2-week dogfooding window across multiple roadmaps (Phase 6
Step 4, deferred) is needed before the buckets earn weight in
maintainer retirement decisions. Until then, the report is a *signal*,
not a verdict.

## See also

- [`artifact-engagement-flow.md`](artifact-engagement-flow.md) — flow + privacy contract
- [`artifact-engagement-recording`](../../.agent-src.uncompressed/rules/artifact-engagement-recording.md) — when the agent records
- [`road-to-artifact-engagement-telemetry.md`](../roadmaps/road-to-artifact-engagement-telemetry.md) — phased delivery
- [`adr-work-engine-rename.md`](adr-work-engine-rename.md) — engine boundary this telemetry sits outside of
- [`adr-prompt-driven-execution.md`](adr-prompt-driven-execution.md) — `/work` entrypoint that emits events
