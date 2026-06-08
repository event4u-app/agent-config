---
adr: 072
status: accepted
date: 2026-06-08
decision: codex-gemini-drive-configs
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-072 — Codex + Gemini drive configs

## Status

**Accepted** · 2026-06-08. Implementation follow-up to
[`ADR-070`](ADR-070-tier1-drive-loop.md), which shipped the unified drive loop
with the `claude-code` config and left `codex` / `gemini` as v1 debt. This is a
**mechanical extension**, not a new design decision: the unified `drive()` is
unchanged; each host adds a `build_args` + envelope parser. No AI-council round
was needed — the only unknowns were the two CLIs' envelope shapes, which are
**facts to verify, not trade-offs to debate** (per `think-before-action`).

## Context

`workspace_drive.py` (ADR-070) drives one Tier-1 turn through a per-host config.
All three Tier-1 hosts (Claude Code / Codex / Gemini — ADR-023) are now CLI-
present; the launch integration (ADR-071) already drives any `effective_tier==1`
host, so adding the two configs lights up codex / gemini end-to-end with **no
Node change**.

## Decision

Add `codex` and `gemini` to `HOST_CONFIGS`, refactoring the per-host hook from
`normalise(dict)` to `parse(stdout)` so a host can own a multi-line stream
(codex) rather than a single JSON object.

**Envelope shapes — verified, not guessed:**

| Host | Invocation | Shape | Text key | Usage | Session |
|---|---|---|---|---|---|
| `claude-code` | `claude -p <p> --output-format json` | single JSON | `result` | `usage.{input,output}_tokens` | `session_id` |
| `codex` | `codex exec --json <p>` | **NDJSON** event stream | last `item.completed` → `item.content[].text` | `turn.completed.usage` | `session.created.session_id` |
| `gemini` | `gemini -p <p> --output-format json` | single JSON | `response` | `stats.models.<model>.tokens` (model name dynamic) | `session_id` |

- **Codex** shape is reused verbatim from the actively-used
  `ai_council.clients.OpenAICliClient` parser (`item.completed` /
  `turn.completed` / `session.created`); unknown events are skipped, event
  order is tolerated. Missing assistant text → fail-closed (`bad-envelope`).
- **Gemini** shape was confirmed by a live `gemini -p … --output-format json`
  probe (2026-06-08): top-level `response` + `session_id`, token usage nested
  under `stats.models.<dynamic-model>.tokens` (take the first model entry
  best-effort; `output ≈ total − prompt`). Missing `response` → fail-closed.
- **Tool calls** stay opaque (recorded, never executed) — same as ADR-070.

## Consequences

- A workspace launch (ADR-071) against `host: "codex"` or `host: "gemini"` now
  drives a real turn when the CLI is on PATH; no other code path changes.
- The drift-detection posture from ADR-070 extends to all three hosts: an
  opt-in contract test per host (skipped when the CLI is absent) catches a
  vendor-side envelope rename the moment it runs where the CLI is present.
- The `parse(stdout)` refactor is backwards-compatible: the claude config's
  behaviour and the uniform turn shape are unchanged.

## Alternatives considered

- **Guess the gemini envelope from the contract prose** — rejected: the exact
  keys (`response`, nested `stats.models`) are not documented in-repo; a live
  probe is cheap and removes the guess (`think-before-action`).
- **Per-host `drive_*` functions** — rejected again (ADR-070 decision 3): the
  variance is CLI flags + envelope parsing, both already captured by the config
  table; control flow stays single.
- **Pass `--model` to codex / gemini** — deferred: the drive loop uses each
  host's default model in v0; model selection is a later concern.

## Deferred to v1 (debt)

Inherited from ADR-070: multi-turn / tool execution, drive metrics +
kill-switch, error-taxonomy refinement. Plus: explicit model selection per
host, and a normalised cross-host `usage` schema (codex/claude expose
input/output tokens directly; gemini is derived).

## References

- [`ADR-070`](ADR-070-tier1-drive-loop.md) — the unified drive loop (claude-code config).
- [`ADR-071`](ADR-071-launch-drive-integration.md) — the launch integration that drives any tier-1 host.
- [`ADR-023`](ADR-023-host-agent-protocol.md) — the three Tier-1 hosts.
- [`host-agent-protocol`](../contracts/host-agent-protocol.md) — envelope-as-contract + fail-closed posture.
- `src/scripts/ai_council/clients.py` — the proven claude / codex CLI envelope parsers reused here.
