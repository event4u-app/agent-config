---
adr: 082
status: superseded
date: 2026-06-09
decision: 410-one-click-relaunch
supersedes: —
superseded_by: 206
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-082 — One-click re-launch on a 410 (expired host session)

> **Superseded by [ADR-206](ADR-206-drive-loop-era-disposition.md)** (2026-08-03).
> Drive-loop-era batch disposition: this decision no longer governs — the host
> now provides the drive loop's capabilities natively (subagents, sessions,
> hooks, background tasks). The shipped code is frozen (beta-internal,
> dev-mode-gated), not deleted; removal is a separate decision. See ADR-206.

## Status

**Accepted** · 2026-06-09. Closes the deferral in
[`ADR-081`](ADR-081-drive-health-reset-and-410-affordance.md) ("a one-click
re-launch (same role/task/inputs) on 410"). GUI-only, mechanical — no council,
no server change.

## Context

ADR-080/081 made `/continue` answer 410 on an expired host session and replaced
the follow-up form with a "pick a task above to start a new conversation" note.
That pointer made the user re-pick the role, re-open the task, and re-type the
inputs — friction for what is just "run the same thing in a fresh session."

## Decision

- `launch()` remembers the originating `{ role, task, inputs }` in a
  `lastLaunch` signal.
- The 410 affordance renders a **"Start a new conversation"** button when
  `lastLaunch` is set; clicking it re-invokes `launch(role, task, inputs)` — a
  fresh session with the same parameters (and the current host pick). It falls
  back to the "pick a task above" pointer only when there is no remembered
  launch.

## Consequences

- A user whose host session expired re-runs the same task in one click, instead
  of re-entering everything.
- Re-launch goes through the normal `launch()` path — same kill-switch gate,
  health recording, and `sessionGone` reset; the new turn replaces the expired
  one in the result pane.
- No new endpoint and no server change — `lastLaunch` is GUI state.

## Alternatives considered

- **Re-pick manually (the ADR-081 pointer)** — kept as the fallback when no
  prior launch is remembered, but the button is the common case.
- **Persist `lastLaunch` across reloads** — unnecessary: a 410 is acted on in
  the same session it occurred; cross-reload memory adds no value.

## References

- [`ADR-081`](ADR-081-drive-health-reset-and-410-affordance.md) — the 410 affordance this completes.
- [`ADR-080`](ADR-080-host-session-expired-410.md) — the 410 itself.
- [`ADR-075`](ADR-075-workspace-gui-drive.md) — the `launch()` flow re-invoked.
