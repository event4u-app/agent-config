---
adr: 071
status: accepted
date: 2026-06-08
decision: launch-drive-integration
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-071 — Wire the Tier-1 drive loop into `POST /launch` (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08). This is **PR 2** of the drive-loop work
([`ADR-070`](ADR-070-tier1-drive-loop.md) was PR 1 — the executor). The council
heavily stress-tested the failure paths; two facts defused the sharpest
critiques and shaped the final design (see Consequences).

## Context

The pieces existed but were unwired: `workspace_render.py` (ADR-069) renders a
task prompt; `workspace_drive.py` (ADR-070) drives one Tier-1 turn;
`workspace_sessions.py` records encrypted events; `detectHostTier` (ADR-068)
reported `tier1-drive-pending`. `POST /launch {role, task, host}` wrote a
session header and stopped. This ADR makes a Tier-1 launch actually drive a
turn, and degrades cleanly everywhere else.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Where the prompt comes from | **Fat launch** — `POST /launch {role, task, inputs?, host}` resolves task→prompt, renders in-process, drives. | One round-trip is the natural UX; the render *endpoint* stays pure (launch calls the render module, doesn't re-implement it). Render failure → `host.error(render-error)` + `{driven:false}`, **no drive attempt**. |
| 2 | Backwards compatibility | **Additive.** Header always written first; driving only when the task resolves to a prompt AND the host is tier 1. Inputs supplied to a no-prompt task → explicit `{driven:false, reason:"no-prompt-for-task", ignored_inputs:true}`. | The legacy `{role, task, host}` → header contract is unchanged; no silent input drops. |
| 3 | What gets appended | Header (`launcher.input`), then **exactly one** `host.turn` (success) or `host.error` (render / drive failure). | Each launch mints a **fresh** session id → no shared-session append race; "single append" needs no lock in v0. |
| 4 | Degrade matrix | Tier-3 host, or tier-1 drive failure: **best-effort** inbox hand-off when the flag is on (write rendered prompt, append `inbox.handoff`); flag off → header + tier only. | The session record is the source of truth; the inbox is a convenience, so its write is best-effort (try/catch, never fails the response). |
| 5 | Timeout response | **HTTP 200** always, with `{driven:false, error_kind:"timeout"}`; never 202. | The session + error are recorded synchronously; a 202 would imply async continuation that does not exist. |

### Response shape

`POST /launch` always returns 200 with the session header fields + tier, plus:

- success: `{driven:true, turn:{…uniform turn…}}`
- no prompt: `{driven:false, reason:"no-prompt-for-task", ignored_inputs?:true}`
- render error: `{driven:false, error_kind:"render-error", error}`
- tier-3 / drive failure: `{driven:false, error_kind?, error?, handoff?}` (`handoff` present iff the inbox flag was on and the write succeeded)

## Consequences

- **No shared-session race** (council's biggest concern): every launch mints a
  new session id, so two concurrent launches write two sessions, never a
  double-append to one. The "single append" invariant is per-launch and needs
  no lock in v0.
- **No partial-output-on-timeout** (council's second concern): `claude -p
  --output-format json` is non-streaming; on a timeout the subprocess is killed
  with no parseable envelope, so `host.error(timeout)` carries metadata only.
- The session log stays the single source of truth — every outcome (turn,
  render-error, drive-error, handoff) is recorded through the encrypted store
  (ADR-064); the response mirrors what was recorded.
- Driving is opt-in and additive; existing GUI callers that send no inputs and
  hit a no-prompt task keep their header-only behaviour.

## Alternatives considered

- **Thin launch (client renders via `/render`, passes the prompt to launch)** —
  rejected for v0: two round-trips for the common path; the render endpoint
  staying pure already preserves the separation the thin shape was protecting.
- **Separate `POST /launch/:id/drive`** — rejected (ADR-070 decision 4):
  orphaned-session risk with no rollback/dedup in v0.
- **202 on timeout** — rejected: implies async continuation we do not have; the
  error is recorded synchronously, so 200 is honest.
- **Fail the response when the inbox degrade write fails** — rejected: the
  session error is already recorded; the hand-off is a convenience, so its
  failure must not mask a recorded outcome.

## Deferred to v1 (debt)

- Multi-turn / tool execution (inherited from ADR-070).
- `codex` / `gemini` drive configs (the unified `drive()` is ready).
- Pre-flight checks (disk / key validity) + write-ahead recovery for the
  header→turn sequence — v0 relies on best-effort append + the always-present
  header for recovery.
- Drive metrics + a kill-switch flipping tier-1 to inbox-only on a failure-rate
  threshold.

## References

- [`ADR-070`](ADR-070-tier1-drive-loop.md) — the drive executor (PR 1).
- [`ADR-069`](ADR-069-prompt-renderer.md) — the renderer launch calls in-process.
- [`ADR-068`](ADR-068-host-tier-detection.md) — tier detection gating the drive.
- [`ADR-065`](ADR-065-tier3-inbox-handoff-v0.md) — the inbox the degrade path writes to.
- [`ADR-064`](ADR-064-append-jsonl-per-record-encryption.md) — the encrypted session store.
- [`daily-workspace`](../contracts/daily-workspace.md) — `/launch` surface contract.
