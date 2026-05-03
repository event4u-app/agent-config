---
title: "Phase 6.1 — non-overlap evidence (chat-history-* rules)"
roadmap: agents/roadmaps/road-to-structural-optimization.md
phase: 6.1
stability: beta
locked_at: 2026-05-03
status: closed
verdict: keep_separate
---

# Phase 6.1 — Non-overlap evidence

Companion to [`phase6-trigger-matrix.md`](phase6-trigger-matrix.md).
Where the matrix proves "< 30% Jaccard on all 3 pairs" by tokens,
this document proves the same conclusion **conceptually** —
the three rules are not just lexically distinct, they own three
disjoint gates of the chat-history Iron Law.

## The three-gate decomposition

The chat-history Iron Law has three gates. Each rule owns exactly
one. They cannot be merged without losing the gate boundary —
which is exactly the failure mode that prompted the original split
(see `docs/contracts/adr-chat-history-split.md`).

| Gate | Owner rule | Trigger event | Output | Failure mode caught |
|---|---|---|---|---|
| **1 — Ownership** | `chat-history-ownership` | First turn / file ref / drift detection | `turn-check` runs; foreign/returning prompt rendered | Wrong session writes to wrong user's file (data loss / privacy) |
| **2 — Cadence** | `chat-history-cadence` | Cadence boundary (turn / phase / tool) | `append` is called once with `--first-user-msg` | Crash recovery loses timeline (skipped/batched appends) |
| **3 — Visibility** | `chat-history-visibility` | Final reply about to send | Heartbeat marker pasted verbatim from subprocess stdout, or nothing | Silent drift — file behind, agent thinks healthy |

These three trigger events are **temporally ordered and disjoint**:

```
session-start ──► gate 1 (ownership / handshake)
                   │
                   ▼
boundary ──────► gate 2 (append, gated by gate 1's refusal exit code)
                   │
                   ▼
reply-emit ────► gate 3 (heartbeat — pure observability)
```

A unified rule (Q2=A's original framing) would have to multiplex
all three triggers. That is not a clarity win — it is the **router
shape Q2=A explicitly rejected**, just under a different name.

## Concrete trigger orthogonality — three failure scenarios

**Scenario A — first-turn handshake.** Only gate 1 fires; `append`
must not run yet (no boundary crossed). A unified rule would have
to encode "if first turn AND no boundary, do gate 1 only" — which
is just gate 1 with extra branch logic.

**Scenario B — mid-session phase boundary.** Only gate 2 fires.
Gate 1 already cleared at session start; gate 3 will fire later in
the same reply but is independent of the append. A unified rule
gains nothing — the `append` body is already a single
`scripts/chat_history.py append` call.

**Scenario C — heartbeat-only emit.** Gate 3 fires every turn that
sends a reply, including read-only / clarification turns where
neither gate 1 nor gate 2 fires. A unified rule would have to gate
heartbeat on "always", which is exactly its current standalone
shape.

## The 0-token pair is the strongest evidence

`chat-history-ownership × chat-history-visibility` has **zero**
shared trigger tokens (`Jaccard = 0.000`). Gate 1 (handshake) and
gate 3 (heartbeat marker) fire on different events, do different
work, and have nothing in common except the file they observe. A
unified rule would create a cross-cutting concern where the
codebase currently has none.

## What this means for future phases

- **Phase 2B** can proceed with the full 13-rule list. The
  `chat-history-*` rules stay in scope of Phase 6's territory but
  do not migrate (Phase 0.3 coupling proof + this document
  together close the dependency).
- **Phase 0.1 file-ownership matrix** stays valid for these three
  rules — the gate-per-rule mapping is the matrix entry.
- **Future re-scope.** If a fourth chat-history concern appears
  (e.g. retention, archival, sync), the bar to merge any of the
  existing three is unchanged: pairwise Jaccard ≥ 30% on ≥ 2 of 3
  pairs, measured by `scripts/_one_off_phase6_trigger_jaccard.py`.

## Closing note

The audit is the deliverable. Phase 6 closes with **no rule
changes** — that is the correct outcome when the data supports it
(roadmap A4 fix, R5 finding). Three disjoint gates → three
focused rules → one legible Iron Law surface.
