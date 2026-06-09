---
adr: 083
status: accepted
date: 2026-06-09
decision: session-thread-and-arbitrary-continuation
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-083 — Session thread view + arbitrary continuation

## Status

**Accepted** · 2026-06-09. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-09). Ships in two PRs (council sequencing): **PR-1**
the server record (this ADR + the `/continue` follow-up record); **PR-2** the
GUI (clickable session strip + thread view + continuation target). Closes the
last substantive ADR-075 deferral.

## Context

The workspace shows only the **latest** turn and only continues the **active**
session. Two gaps: no full **thread** (each turn replaces the prior), and no
**arbitrary continuation** (a past session in the strip isn't clickable).

**Load-bearing log fact:** the session JSONL records `launcher.input` (opening
task + inputs) + one `host.turn` per assistant reply — but the **user's
follow-up prompts were not recorded**, so a thread would show replies without
the questions that produced them.

## Decision

| # | Question | Verdict |
|---|---|---|
| 1 | Record follow-up prompts? | **Yes** — `/continue` appends a `launcher.input` with `followup: true` carrying the `prompt`, **before** driving (so the question survives a failed turn). **Reuse** `launcher.input` (no new record kind). |
| 2/4 | Thread render | The result area renders the log as ordered blocks: opening task, then interleaved user (`launcher.input followup`) + assistant (`host.turn`) + error (`host.error`) blocks; reuse the 2000-char collapse. |
| 3 | Continuation target | A selected session's id is the `/continue` target; 409 / 410 surface as before. |
| 5 | State | **One "current session"** drives both the thread and the follow-up box; launching sets it to the new session, selecting a strip session sets it to that one. |

**Privacy (council's hardest pushback — shared sessions):** defused by a fact —
the workspace is **per-user / local** (`daily-workspace` § State scope: "Per-user.
Local-only. One workspace per OS user. No multi-tenant view"). The follow-up
prompt is the same user's text at the same encrypt-at-rest tier as every other
record; recording it expands **no** privacy surface. (If the workspace ever
gains multi-user session sharing, follow-up-prompt classification must be
revisited — flagged here.)

**Old sessions** (pre-recording) have no follow-up records → the thread shows
the opening task + assistant turns, degrading gracefully (no crash, no
placeholder noise).

No feature flag: the record is additive + low-risk; rollback is a revert.

## Consequences

- A real thread (question → answer → question → answer) for sessions created
  after PR-1; reply-only for older ones.
- Any past session is continuable from the strip — the workspace becomes a
  browseable, resumable conversation history, not just a launch pad.
- One server record append per follow-up; the GUI keys the thread + follow-up
  off a single current-session id.

## Alternatives considered

- **New `launcher.followup` record kind** — rejected: schema proliferation; a
  `followup: true` field on `launcher.input` is enough.
- **Assistant-turns-only thread (no recording)** — rejected: a thread without
  the questions is confusing; the record is one cheap append.
- **Two parallel result components (active vs selected)** — rejected: the
  council's one-current-session model is cleaner; the thread view subsumes the
  single-turn display.

## Deferred to v1+ (debt)

Idempotency on rapid double-submits (v0 has no retry semantics); progressive /
streamed loading for very long session logs; a multi-user-sharing revisit of
follow-up-prompt classification (only if session sharing is ever added).

## References

- [`ADR-076`](ADR-076-workspace-multi-turn.md) — `/continue` this records into.
- [`ADR-075`](ADR-075-workspace-gui-drive.md) / [`ADR-082`](ADR-082-410-one-click-relaunch.md) — the GUI result area the thread view subsumes.
- [`daily-workspace`](../contracts/daily-workspace.md) § State scope — the per-user/local fact that defuses the privacy concern.
