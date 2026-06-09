---
adr: 078
status: accepted
date: 2026-06-09
decision: drive-health-panel
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-078 — WorkspacePage drive-health panel (read-only)

## Status

**Accepted** · 2026-06-09. Closes the GUI debt deferred by
[`ADR-073`](ADR-073-drive-health-kill-switch.md) ("a dedicated health panel")
and [`ADR-075`](ADR-075-workspace-gui-drive.md) (deferred the drive-health UI).
Small mechanical reuse — consumes the existing `GET /drive-health` (ADR-073);
no server change, no council (read-only display of existing data).

## Context

The kill-switch (ADR-073/074) trips a host to inbox-only after repeated drive
failures and auto-recovers it on a cooldown probe. `GET /drive-health` exposes
that state, but the GUI only reflected `host_killed` / `recovered` transiently
in a launch banner — an operator had no standing view of *which* host is paused
and *why*.

## Decision

- A read-only **Host health** panel in the workspace rail, fed by the existing
  `GET /drive-health` (fetched in `load()`, **non-critical**: a failed health
  fetch never blocks the page — it falls back to an empty snapshot).
- Surfaces **only unhealthy hosts** (killed, or with a non-zero failure
  streak); the common all-healthy case shows a one-line "All hosts healthy."
- Per host: state (`paused — auto-recovering` for an auto-trip, `paused
  (manual)` for a manual kill, `degraded` for a streak without a trip), the
  failure streak, and the last error kind.
- **No reset action in v0** — reset stays a CLI op (`workspace_drive_health.py
  reset`); auto-cooldown (ADR-074) handles the common recovery, so a GUI reset
  button (which would need a new state-mutating endpoint) is deferred.

## Consequences

- An operator can see at a glance why a host isn't driving and whether it is
  auto-recovering — the observability the kill-switch councils asked for.
- Purely additive + non-critical: no server change, and a health-endpoint
  failure degrades to "All hosts healthy" rather than breaking the workspace.

## Alternatives considered

- **A reset button in the panel** — deferred: needs a new POST endpoint
  (state mutation); auto-recovery covers the common case, so v0 stays
  read-only.
- **Always list every host (including healthy)** — rejected: noise; the panel
  earns its space only when something is wrong.
- **Poll `/drive-health` on an interval** — deferred: a load-time snapshot +
  the launch banner's live `host_killed`/`recovered` cover v0; live polling is
  a later refinement.

## Deferred to v1 (debt)

A GUI reset button (+ its endpoint), live polling / refresh, and a full
per-host history view (totals, trip count over time).

## References

- [`ADR-073`](ADR-073-drive-health-kill-switch.md) / [`ADR-074`](ADR-074-drive-kill-switch-auto-recovery.md) — the kill-switch + `GET /drive-health` this surfaces.
- [`ADR-075`](ADR-075-workspace-gui-drive.md) — the GUI rail + patterns reused.
