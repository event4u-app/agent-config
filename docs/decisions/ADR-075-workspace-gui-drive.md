---
adr: 075
status: accepted
date: 2026-06-08
decision: workspace-gui-drive
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-075 — WorkspacePage drive integration (GUI v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08) — both members converged firmly on the minimal
surface. Makes the drive backend (ADR-069..074) usable from the GUI: the
employee fills a task's inputs, runs it, and sees the host's turn — the
"external-proof" payoff of the phase.

## Context

`src/ui/pages/WorkspacePage.tsx` (Preact + signals) had a "Start session" button
that POSTed `/launch {role, task}` with **no inputs** and showed a banner — so
every real-task launch hit the backend's render-error path. The GUI never
collected inputs, never showed the driven turn, never surfaced drive health.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Input collection | **Inline expander form** under the task — one field per declared input, required marked, `shape` as placeholder. | Least chrome; fits the existing task list. A modal / rail is more surface for no v0 benefit. |
| 2 | Input-spec source | **Inline the spec in `GET /roles/:role/tasks`** (each task gains `inputs` + `skill_hint`); **no** dedicated inspect endpoint. | A dedicated lazy endpoint blocks the form on an RTT and adds a second failure mode; the per-task spec is <500 bytes. Parsed in Node (prompts are plaintext) for display; render/drive stays Python-authoritative. |
| 3 | Result display | Driven turn → assistant **text** inline, **collapsed behind "Show full" past 2000 chars** (+ model/token meta). Each non-driven outcome → a distinct banner. | A 4k-token turn would break the chrome — the collapse is a day-1 guardrail, not post-v0 polish. |
| 4 | Drive-health UI | **Defer a dedicated health panel.** Reflect `host_killed` / `recovered` from the launch response in the banner only. | `GET /drive-health` exists (ADR-073) for a later panel; a health dashboard is not the v0 critical path. |
| 5 | Host selection | **Hard-code `host: 'claude-code'`** for v0; no host picker. | The v0 goal is validating the drive flow end-to-end with one host; a picker is UX debt (host ids ≠ model names) + an N×M test matrix for an unrequested feature. |

**Shape-mismatch safety (council blocker check):** the renderer stringifies any
input value (`str(val)`), so a wrong-typed input never 500s — only a
missing-required input returns the structured `render-error` the banner shows.

## Surface

- `GET /roles/:role/tasks` now returns, per task, `inputs: [{name, required,
  shape}]` + `skill_hint` (read-only display data).
- `WorkspacePage`: selecting a role fetches tasks-with-specs; "Start session"
  expands the inline `TaskForm`; "Run task" POSTs `/launch {role, task, inputs,
  host: 'claude-code'}`; `TurnResult` renders the driven turn (collapsible);
  `bannerFor()` maps every outcome (driven / recovered / host-killed /
  render-error / no-prompt / handoff) to one banner.

## Consequences

- The full render → drive → turn path is now exercisable by an employee in the
  browser — the phase's external-proof goal.
- The tasks endpoint stays one round-trip; no new endpoint, no subprocess
  fan-out (Node parses the plaintext prompt frontmatter for the display spec).
- Multi-host selection and a drive-health panel are deferred with the
  `host: 'claude-code'` default and the `host_killed`/`recovered` banner as the
  forward hooks.

## Alternatives considered

- **Dedicated `/prompts/:name` inspect endpoint** — rejected: RTT block on form
  open + a second failure mode; inlining is trivial payload.
- **Host picker in v0** — rejected (both council members): speculative,
  UX-confusing (host ids), and an N×M test matrix before any user has asked.
- **Render the turn raw with no collapse** — rejected: a long turn breaks the
  layout; the char-collapse is a day-1 guardrail.
- **Drive-health panel now** — deferred: not the v0 critical path; the endpoint
  already exists for a later pass.

## Deferred to v1 (debt)

A host picker (claude-code / codex / gemini / inbox), a drive-health panel fed
by `GET /drive-health`, streaming turn output (v0 is single-turn), and a richer
input-validation surface (typed fields beyond textarea + `shape` hints).

## References

- [`ADR-069`](ADR-069-prompt-renderer.md) / [`ADR-071`](ADR-071-launch-drive-integration.md) / [`ADR-073`](ADR-073-drive-health-kill-switch.md) / [`ADR-074`](ADR-074-drive-kill-switch-auto-recovery.md) — the drive backend this surfaces.
- [`daily-workspace`](../contracts/daily-workspace.md) — the workspace surface contract.
