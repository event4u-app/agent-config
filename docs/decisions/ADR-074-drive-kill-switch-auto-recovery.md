---
adr: 074
status: accepted
date: 2026-06-08
decision: drive-kill-switch-auto-recovery
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-074 — Drive kill-switch auto-cooldown recovery (v1)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08). Implements the auto-recovery that
[`ADR-073`](ADR-073-drive-health-kill-switch.md) explicitly deferred to v1, and
**amends** ADR-073's decision 3 ("manual reset only"): an *auto*-tripped host
now self-recovers via a half-open probe; a *manual* kill stays sticky.

## Context

ADR-073's kill-switch was manual-reset-only — a tripped host stayed inbox-only
until an operator ran `reset`. That is operator toil once the underlying problem
clears. This v1 adds a classic circuit-breaker half-open recovery.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | State model | **Three-state `gate(host)` → closed / open / half_open** (via `killed_at` + cooldown). Cache miss → `closed` (fail open). | The launch path switches on the gate; the boolean `is_killed` becomes a status read. |
| 2 | Probe mechanism | **Reuse the next real launch** as the probe. async / synthetic probe = v2. | This is a **local single-user** workspace, not a high-traffic service — the one user paying a probe's latency ~once per cooldown is acceptable; an async probe runner is disproportionate for v1. The council's UX concern is noted and the feature is flag-gated as the escape hatch. |
| 3 | Success semantics | A success **closes** an *auto*-tripped circuit (un-kills); a *manual* kill is never auto-cleared. Safe because a real drive only runs when closed/half-open. | Auto-recovery without operator toil; manual intent is preserved. |
| 4 | Probe failure | Re-open, restart the cooldown (**fixed**, no back-off in v1) and `trip_count += 1`. **Flapping guard:** at `MAX_AUTO_TRIPS = 3` the host goes **sticky** (manual reset only). | Bounds a misconfigured host probing forever and burning quota. |
| 5 | Cooldown | **Env-tunable** `AGENT_CONFIG_DRIVE_COOLDOWN_SEC` (default **600 s**), global; no per-host override. | A wrong default is an env flip (30 s), not a code deploy; per-host is over-engineering. |
| 6 | Manual kill | **Sticky** (`kill_reason: "manual"`) — never auto-recovers. Only auto-trips (`"auto"`) take the cooldown path. | A manual kill encodes out-of-band knowledge ("broken until I fix it"); auto-healing it would fight the operator. |

**Escape hatch (council: mandatory):** the whole behaviour is behind
`AGENT_CONFIG_DRIVE_AUTO_RECOVERY` (default on; `0/false/off` → ADR-073 v0
manual-only). **Concurrency:** a `probe_started_at` time-lease (`PROBE_LEASE_SEC
= 120`) makes a concurrent launch see `open` instead of firing a second
simultaneous probe — adequate for launch-paced single-user writes; a full
compare-and-swap lock is v2. **Observability:** `record(..., is_probe=True)` +
`last_was_probe` distinguish probe outcomes from normal drives.

## Launch enforcement

`POST /launch` calls `gate(host)` before driving: `open` → skip + inbox
(`host.error(host-killed)`); `half_open` → drive ONE probe, record with
`is_probe`, response carries `recovered: true` on a successful probe; `closed`
→ normal drive. One enforcement point, unchanged from ADR-073.

## Consequences

- An auto-tripped host recovers on its own once the problem clears — no operator
  toil for transient outages.
- A genuinely broken host trips → probes → re-trips up to `MAX_AUTO_TRIPS`, then
  goes sticky so it stops burning probes until an operator intervenes.
- A manual `kill` behaves exactly as before (sticky); the escape-hatch flag
  restores full v0 behaviour.

## Alternatives considered

- **Async / synthetic background probe** (council's preferred UX) — deferred to
  v2: needs a background task runner; disproportionate for a local single-user
  tool where the probe-latency cost lands on at most one user per cooldown.
- **Exponential cooldown back-off** — deferred to v2: fixed cooldown + the
  `MAX_AUTO_TRIPS` sticky guard already bounds flapping.
- **Auto-recovering manual kills** — rejected: a manual kill is an operator
  decision that auto-healing would override.
- **Hard-coded cooldown** — rejected: env-tunability is three lines and turns a
  wrong default into a 30-second fix.

## Deferred to v2 (debt)

Async / synthetic probe (decouple recovery from a user launch), full
compare-and-swap probe lock, per-host cooldown override, exponential back-off,
per-error-kind trip weighting, cache↔session-log reconciliation.

## References

- [`ADR-073`](ADR-073-drive-health-kill-switch.md) — the v0 kill-switch this amends (decision 3).
- [`ADR-070`](ADR-070-tier1-drive-loop.md) / [`ADR-071`](ADR-071-launch-drive-integration.md) — the drive loop + launch enforcement point.
