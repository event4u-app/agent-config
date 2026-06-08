---
adr: 077
status: accepted
date: 2026-06-09
decision: workspace-followup-gui
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-077 — WorkspacePage follow-up affordance (GUI for /continue)

## Status

**Accepted** · 2026-06-09. Closes the GUI debt [`ADR-076`](ADR-076-workspace-multi-turn.md)
explicitly deferred ("the GUI 'Follow up' affordance"). A small, mechanical
reuse of the ADR-075 GUI patterns over the merged `/continue` endpoint — no
council needed (no design fork; the only target is the active session).

## Context

ADR-076 shipped `POST /sessions/:id/continue` (resume the same host session) but
left it unsurfaced — the WorkspacePage could drive a first turn (ADR-075) but
not send a follow-up. This wires that.

## Decision

- After a **driven** turn, `TurnResult` shows a **"Follow up"** textarea +
  "Send follow-up" button. Submit calls `continueTurn(launchResult.id, prompt)`
  → `POST /sessions/:id/continue {prompt}` → replaces the displayed turn with
  the continuation (reusing `TurnResult` + `bannerFor`).
- **Target = the active session** (`launchResult.id`). v0 does not add a
  session-strip "continue any past session" affordance — the natural flow is
  launch → see turn → follow up. Picking an arbitrary historical session to
  resume is deferred.
- The box appears **only when a turn has driven** (`launchResult.driven`); a
  hand-off / render-error / host-killed outcome shows no follow-up (there is no
  host session to continue) — matching the `/continue` 409 guard.
- `followupText` resets on a new launch (a fresh launch starts a fresh
  conversation); it clears on a landed continuation, and is **kept** on a
  failed one so the user can retry.

## Consequences

- The end-to-end multi-turn flow is now visible: launch → turn → follow-up →
  turn, all in the same host session, with the kill-switch + health applying to
  every turn (server-side, ADR-073/076).
- Pure additive reuse — no new endpoint, no server change; `bannerFor` /
  `TurnResult` already handle the continuation response shape (identical to a
  launch result).

## Alternatives considered

- **Continue any session from the strip** — deferred: the active-session flow
  is the v0 critical path; arbitrary-session resume needs a session-detail view
  first.
- **A dedicated continuation ADR section in ADR-076** — chose a thin ADR-077
  instead so the deferred-debt closure has its own audit entry.

## Deferred to v1 (debt)

Continue an arbitrary past session from the session strip; a per-turn
conversation thread view (today the latest turn replaces the prior in the
result pane — the full thread lives in the session JSONL).

## References

- [`ADR-076`](ADR-076-workspace-multi-turn.md) — the `/continue` endpoint this surfaces (and the debt it closes).
- [`ADR-075`](ADR-075-workspace-gui-drive.md) — the GUI drive patterns (`TaskForm` / `TurnResult` / `bannerFor`) reused here.
