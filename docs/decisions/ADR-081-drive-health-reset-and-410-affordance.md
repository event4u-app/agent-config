---
adr: 081
status: accepted
date: 2026-06-09
decision: drive-health-reset-and-410-affordance
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-081 — Drive-health reset endpoint + 410 follow-up affordance

## Status

**Accepted** · 2026-06-09. Closes two deferred GUI items: the reset button
[`ADR-078`](ADR-078-drive-health-panel.md) deferred ("reset stays a CLI op …
a GUI reset button needs a new state-mutating endpoint → deferred") and the
410 affordance [`ADR-080`](ADR-080-host-session-expired-410.md) deferred ("a
GUI 'start a fresh conversation' one-click on 410"). Mechanical — no council.

## Context

The kill-switch panel (ADR-078) was read-only; clearing a paused host meant the
CLI. And a `/continue` 410 (ADR-080) only set a banner — the follow-up box
stayed, inviting a retry that would 410 again.

## Decision

1. **`POST /api/v1/workspace/drive-health/:host/reset`** → `workspace_drive_health.py
   reset` → returns the reset state. The operator escape hatch for a paused
   host (and the *only* path for a sticky **manual** kill, which auto-recovery
   never clears). An invalid host id → 400 (CLI charset/root guard).
2. **Reset button** in the health panel, shown **only on a killed host**; click
   → reset → re-fetch `/drive-health` → the row clears.
3. **410 affordance:** when `/continue` returns 410 (host session expired), the
   GUI sets a `sessionGone` flag → the follow-up form is **replaced** by
   "Host session expired — pick a task above to start a new conversation."
   `sessionGone` resets on the next launch.

## Consequences

- A paused host can be cleared from the browser — completing the kill-switch
  UX (auto-recovery for transient trips, one-click reset for the rest +
  sticky manual kills).
- A 410 no longer leaves a dead follow-up box: the user is routed to start a
  fresh conversation instead of retrying into another 410.
- Reset is a low-risk local-cache mutation (clears `workspace/health/<host>.json`
  flags); no model/data/infra surface, so no threat-model gate.

## Alternatives considered

- **Keep reset CLI-only** — rejected now: with the panel surfacing paused hosts,
  a reset there is the obvious completion; the endpoint is a thin CLI wrapper.
- **410 → just a banner (keep the form)** — rejected: invites a retry that
  410s again; replacing the form is the honest dead-end signal.
- **A one-click "re-launch same task" on 410** — deferred: needs to remember
  the originating task + inputs; the "pick a task above" pointer is enough for
  v1.

## Deferred to v1+ (debt)

A one-click re-launch (same role/task/inputs) on 410; a manual "pause this host"
button (the inverse of reset) if operators want to force a host off; live
polling so a reset / recovery elsewhere reflects without a reload.

## References

- [`ADR-078`](ADR-078-drive-health-panel.md) — the read-only panel this makes actionable.
- [`ADR-080`](ADR-080-host-session-expired-410.md) — the 410 this gives a GUI affordance.
- [`ADR-073`](ADR-073-drive-health-kill-switch.md) / [`ADR-074`](ADR-074-drive-kill-switch-auto-recovery.md) — the kill-switch + `reset` semantics.
