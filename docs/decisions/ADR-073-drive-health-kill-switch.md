---
adr: 073
status: accepted
date: 2026-06-08
decision: drive-health-kill-switch
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-073 — Drive health + kill-switch (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08). Closes the observability + kill-switch gap the
drive-loop councils (ADR-070/071/072) repeatedly flagged: there was no way to
see "this host keeps timing out" and no automatic degrade when a host CLI goes
bad.

## Context

Every Tier-1 drive (ADR-070/071/072) writes one session record — `host.turn`
(success) or `host.error` (`error_kind` ∈ timeout / cli-missing / nonzero-exit
/ bad-envelope / …). That store is the **canonical** history, but it is
encrypted and per-session; the kill-switch needs a *cheap, frequent* read on
every launch ("is this host healthy enough to drive?"). Scanning session files
per launch is the wrong shape.

## Decision

Add `workspace_drive_health.py`: a tiny per-host **cache** counter at
`<writeRoot>/workspace/health/<host>.json`, plus a kill-switch.

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Metrics source | **Dedicated counter file, as a cache.** Session log stays canonical; a missing / unreadable cache **fails open** (host treated as healthy). Minimal schema (`consecutive_failures`, `killed`, lifetime totals, last outcome) — no histograms. | The kill-switch needs O(1) reads; deriving from encrypted session scans per launch is wrong. The cache never fabricates a kill. |
| 2 | Kill-switch trigger | **Auto + manual.** Auto-trips at **5 consecutive failures**; a manual `kill` forces it. | A consecutive-failure streak is simpler than windowing math; 5 lets transient blips self-heal while a broken CLI trips fast. |
| 3 | State + reset | On-disk per host; **manual reset only** in v0. A success resets the *streak* but not a tripped `killed` flag. | Auto-cooldown / probe-drive risks flapping with no data on real failure modes yet — that is a v1 feature. |
| 4 | Enforcement | **Single point in `POST /launch`**: before driving a tier-1 host, consult health; killed → skip the drive, append `host.error(host-killed)`, degrade to the inbox (same path as a drive failure). Never mutates the detected tier. | One synchronous fallback, not a tier mutation a poller has to observe. |
| 5 | Surface | CLI (`record` / `status` / `kill` / `reset`) + a `host_killed` flag on the launch response **+ a read-only `GET /api/v1/workspace/drive-health`**. | The GUI needs health data; without the endpoint it would read the JSON file directly and bypass the surface. The endpoint is ~10 lines reading the same data the CLI does. |

**Concurrency:** writes are atomic (temp file + `os.replace`) so a concurrent
reader never sees a partial file. The read-modify-write increment is best-effort
under true concurrency (a lost increment is acceptable — the session log is
canonical); drives are launch-paced in v0, so contention is rare.

## Consequences

- A host that fails 5 drives in a row auto-routes its launches to the Tier-3
  inbox until an operator runs `reset` — a broken host CLI no longer burns turn
  after turn.
- `GET /drive-health` gives the GUI (and an operator) a per-host snapshot
  without reading the canonical (encrypted) session log.
- The cache is non-authoritative: deleting `workspace/health/` resets the
  kill-switch state with no data loss (the session log retains the history).

## Alternatives considered

- **Derive metrics from session records on demand** — rejected as the primary
  source: O(sessions) encrypted scans on every launch. (It remains the
  canonical reconciliation source for a future v1 audit.)
- **Auto-cooldown + probe-drive recovery** — deferred to v1: no data yet on
  whether hosts flap; manual reset is the conservative v0 choice.
- **Failure-rate window instead of a streak** — deferred: windowing math is
  v0 over-engineering; a consecutive-streak is enough to catch a dead CLI.
- **No HTTP endpoint (CLI only)** — rejected (council): the GUI would read the
  file directly and bypass the surface; the endpoint is cheap.

## Deferred to v1 (debt)

Auto-cooldown + probe-drive recovery, failure-rate windows, per-error-kind
weighting (a `bad-envelope` may warrant a faster trip than a transient
`timeout`), and reconciliation of the cache against the canonical session log.

## References

- [`ADR-070`](ADR-070-tier1-drive-loop.md) / [`ADR-071`](ADR-071-launch-drive-integration.md) / [`ADR-072`](ADR-072-codex-gemini-drive-configs.md) — the drive loop this instruments.
- [`ADR-064`](ADR-064-append-jsonl-per-record-encryption.md) — the canonical encrypted session store.
- [`daily-workspace`](../contracts/daily-workspace.md) — workspace surface (lists `/drive-health`).
