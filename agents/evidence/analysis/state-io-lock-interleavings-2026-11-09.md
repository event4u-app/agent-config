<!-- evidence-type: analysis -->
# `state_io` lock — interleavings that admit two holders, 2026-11-09

For `road-to-verified-stale-lock-reclaim` step 1.1. Harness:
`tests/scripts/state_io_lock_interleavings.test.ts`, run against the real
`update_text_under_lock` on `main@2fffa1498b` with `blocking: false`.

## How the harness schedules without timing

Every `openSync` / `statSync` / `rmSync` on the `.held` companion is an
injection point, before and after the call, plus one point inside the critical
section. At a chosen point of caller A, caller B runs whole and synchronously;
B may carry an injection point that runs caller C. A second family covers the
one ordering nesting cannot express on its own: B runs at A's point, and inside
B's critical section the remove A was about to make lands, after which C tries
to acquire. Two callers inside the critical section at once is a violation.
The abandoned guard is a real file aged `2 × LOCK_STALE_MS` with `utimes`.

## Result

| Mode | Schedules | Violations |
|---|---:|---|
| non-strict (four callers today) | every A point × every B point, plus the deferred-remove family | `A@4 rm-lands-in-B → B+C` |
| strict (session pins) | the same | none |

`A@4` is the point before A's stale-break `rmSync`: A has judged the guard
stale, B breaks the same guard, acquires and holds; A's remove then deletes B's
fresh guard, and C acquires beside B. This is the stat-then-remove window the
roadmap names.

A second scenario, pinned in the same file: A holds and is paused past the
stale threshold; at A's release B breaks A's aged guard and holds; A's pending
remove lands inside B's critical section and C acquires beside B. Non-strict:
two holders. Strict: B never breaks, so one holder.

## What this does and does not show

- It shows the window is real in the shipped code and that the strict path
  (never break a guard) closes it, at the cost risk 2 of the roadmap names: a
  dead holder blocks its callers.
- It does not cover the other four sites (`language_mirror_hook`,
  `egress_session_table`, `budget_guard`, `project_registry`); Phase 2 extends
  the harness to each before its fix, as the roadmap's closing condition asks.
- It explores one nesting depth of three callers. A violation needing four
  callers would not appear here.
