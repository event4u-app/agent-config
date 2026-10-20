<!-- evidence-type: analysis -->

# Ratification review — a hook concern in a conditional chunk (round 3)

Rounds 1 and 2 timed out at 300 s on both seats with no text. This one is
short; read the files yourself if you need more.

Branch `drain/update-installs-safe-20261020`. Three gated files:
`src/scripts/hooks/dispatch_hook.ts`, `src/config/hook-bundle-budget.json`,
`src/scripts/hook_manifest.yaml`.

`src/scripts/chat_history.ts` was 121 KB of a dispatch bundle every hook event
loads, and is bound on `session_start` only. It moved into
`dist/hooks/chat_history.chunk.cjs`. `_run_concern` now resolves
`CONCERN_REGISTRY[script] ?? loadLazyConcern(script)`; `null` falls through to
the pre-existing spawn path. The budget file gains a `chunks` entry
(ceiling 232,000, measured 209,890); `max_bytes` is unchanged and no
`raise_log` entry is added. `hooks/hook_stdin.ts` moves the per-concern stdin
override to `globalThis` under `Symbol.for(...)`, because a chunk is a second
module graph and the dispatcher's override was invisible to it.

The manifest gains two concerns in the same change. `update-notice` on
`session_start` (fail-open, advisory, notification): file reads only, no
network, day-throttled, it stages an update candidate on one session start and
may activate it on a LATER one via `upgrade --unattended`, only when no other
session is live. `update-auto-invite` on `stop` (fail-open, advisory,
notification): it returns before reading anything while
`agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md` carries
`ring-0-exit: no`, which it does today; when open it asks once, after a turn
that ended on a verified success, never under CI, a non-TTY, headless,
`--json` or a subagent run, and it never writes the `update.mode` setting.

A two-provider council chose the chunk mechanism on 2026-10-18 for the egress
engine. This is the first time it is applied to a concern.

Verdict, from `ratified` / `confirmed-non-expanding` / `refused` /
`non-convergent`. Say what you checked.

1. Does any of it expand the authority of the agent, the hook system or a
   concern?
2. Is a missing or mis-digested chunk a latency cost only, given the spawn
   path behind it?
3. Does a process-global stdin override let one concern see another's envelope?
4. Do the two new concerns expand what a hook may do? `update-notice` can
   reach an install path (it spawns `upgrade --unattended`, which re-runs every
   gate and holds its own lock) and `update-auto-invite` can put a question in
   front of a user. Is either of those a capability a `fail_closed: false`,
   `severity: advisory` concern should have, and is the ring-0 file an adequate
   gate on the second?
