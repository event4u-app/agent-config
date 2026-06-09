---
adr: 084
status: accepted
date: 2026-06-09
decision: drive-health-refresh-on-drive
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-084 — Refresh drive-health after every drive

## Status

**Accepted** · 2026-06-09. Addresses the "live health" polish deferred by
[`ADR-078`](ADR-078-drive-health-panel.md) (the panel was a load-time snapshot).
Trivial, GUI-only — no council, no server change.

## Context

The drive-health panel (ADR-078) fetched once on page load and after a manual
reset (ADR-081). But a host trips / auto-recovers **as a side effect of a
drive** — so during a session the panel could show stale state (e.g. a host that
just tripped on the last launch still shows healthy until a reload).

## Decision

Re-fetch `GET /drive-health` after every `launch` and `continue` (a small
`refreshHealth()` helper, reused by the reset path). **Refresh-on-drive**, not
`setInterval` polling: health only changes on a drive the user just initiated,
so polling would be wasted requests + a timer to manage; refreshing exactly when
state can change is sufficient and cheaper. Non-critical — a failed refresh
leaves the panel as-is (same fail-open posture as the initial load).

## Consequences

- The panel reflects a host tripping / recovering immediately after the drive
  that caused it, with no reload.
- No timer, no background polling, no new endpoint — one extra GET per drive.

## Alternatives considered

- **`setInterval` polling** — rejected: health is event-driven (only a drive
  changes it); polling burns requests for a local single-user tool and adds a
  timer lifecycle to manage.
- **Server push / SSE** — over-engineered for a local single-user panel.

## References

- [`ADR-078`](ADR-078-drive-health-panel.md) — the panel this keeps fresh.
- [`ADR-081`](ADR-081-drive-health-reset-and-410-affordance.md) — the reset path the `refreshHealth()` helper is shared with.
