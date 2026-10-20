<!-- evidence-type: analysis -->

# Ratification review — a hook concern in a conditional chunk (round 3)

Rounds 1 and 2 timed out at 300 s on both seats with no text. This one is
short; read the files yourself if you need more.

Branch `drain/update-installs-safe-20261020`. Gated files:
`src/scripts/hooks/dispatch_hook.ts`, `src/config/hook-bundle-budget.json`.

`src/scripts/chat_history.ts` was 121 KB of a dispatch bundle every hook event
loads, and is bound on `session_start` only. It moved into
`dist/hooks/chat_history.chunk.cjs`. `_run_concern` now resolves
`CONCERN_REGISTRY[script] ?? loadLazyConcern(script)`; `null` falls through to
the pre-existing spawn path. The budget file gains a `chunks` entry
(ceiling 232,000, measured 209,890); `max_bytes` is unchanged and no
`raise_log` entry is added. `hooks/hook_stdin.ts` moves the per-concern stdin
override to `globalThis` under `Symbol.for(...)`, because a chunk is a second
module graph and the dispatcher's override was invisible to it.

A two-provider council chose this mechanism on 2026-10-18 for the egress
engine. This is the first time it is applied to a concern.

Verdict, from `ratified` / `confirmed-non-expanding` / `refused` /
`non-convergent`. Say what you checked.

1. Does any of it expand the authority of the agent, the hook system or a
   concern?
2. Is a missing or mis-digested chunk a latency cost only, given the spawn
   path behind it?
3. Does a process-global stdin override let one concern see another's envelope?
