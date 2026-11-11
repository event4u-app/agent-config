<!-- evidence-type: analysis -->

# agent-switch link — whole-hook latency (2026-11-08)

Step 7.2 of `agents/roadmaps/road-to-a-link-with-agent-switch.md`: what the
switch question costs on the two hook paths it runs on, with agent-switch
answering, failing, hanging, resting (backed off by 7.1) and absent.

## Setup

- Harness: `agents/evidence/analysis/agent-switch-link-latency.mjs`, run as
  `npx tsx agents/evidence/analysis/agent-switch-link-latency.mjs 20` after
  `npm run build:hooks`, at the tree of `feat/agent-switch-link-hardening`
  (Phase 7.1/7.3/7.5 in place, with the council round 1 fixes). The changes after
  round 1 touched only the Stop path's record bookkeeping (the checkpoint is now
  written while the record lock is held) and the back-off accounting, added no
  agent-switch call, and were not re-measured.
- Each sample is one `node dist/hooks/dispatch.js --platform claude --event …`
  in a fresh HOME / `EVENT4U_CONFIG_HOME` / PATH, so the built bundle and its
  lazily-loaded `quota_notice` chunk run exactly as on a host.
- *concern ms* is the dispatcher's own per-concern timing
  (`AGENT_CONFIG_HOOK_TIMINGS`): `quota-notice` on `user_prompt_submit`,
  `session-eol` on `stop`. *whole dispatch ms* is spawn to exit of the
  dispatcher process, every concern bound on that event included.
- agent-switch is the test fixture `tests/scripts/fixtures/fake_agent_switch.mjs`
  behind a shell wrapper: a Node process, like the real CLI, so a call costs
  one Node start-up. *failing* = every `switch` verb exits 1; *hanging* = every
  `switch` verb sleeps past the 5 s call bound; *resting* = three failing
  prompts first, then the measured one; *absent* = no `agent-switch` on PATH.
- Shapes: *quiet* — no hot window and no request (the ordinary prompt);
  *raise* — a hot window and no request yet (`link status` + `switch request`);
  *relay* — a request open (`switch show`); *stop* — an approved request at
  Stop (`switch show`, then a checkpoint attempt outside a claimed run).
- Machine: Apple M5 Max, Node v26.7.0, darwin. n = 20 per cell, 5 for
  *hanging*. One run; no second machine class.

## Readings

| link | shape | n | concern ms p50 / p95 | whole dispatch ms p50 / p95 |
|---|---|---|---|---|
| absent | quiet | 20 | 0.8 / 0.9 | 106.1 / 123.9 |
| absent | raise | 20 | 1.9 / 2.1 | 110.5 / 112.0 |
| absent | relay | 20 | 10.0 / 10.7 | 117.1 / 118.6 |
| absent | stop | 20 | 11.5 / 12.0 | 116.0 / 118.6 |
| answering | quiet | 20 | 0.8 / 0.9 | 99.8 / 108.7 |
| answering | raise | 20 | 217.4 / 322.8 | 329.9 / 431.4 |
| answering | relay | 20 | 168.0 / 188.9 | 277.8 / 306.5 |
| answering | stop | 20 | 184.6 / 208.1 | 302.0 / 357.7 |
| failing | quiet | 20 | 0.8 / 0.9 | 101.6 / 103.5 |
| failing | raise | 20 | 214.8 / 219.2 | 322.8 / 331.2 |
| failing | relay | 20 | 179.6 / 216.8 | 289.7 / 327.5 |
| failing | stop | 20 | 188.3 / 201.2 | 298.0 / 310.6 |
| hanging | quiet | 5 | 0.8 / 0.8 | 99.9 / 104.7 |
| hanging | raise | 5 | 5190.4 / 5317.0 | 5317.0 / 5436.7 |
| hanging | relay | 5 | 5017.9 / 5018.7 | 5148.8 / 5151.9 |
| hanging | stop | 5 | 5018.1 / 5023.9 | 5154.4 / 5176.7 |
| resting | quiet | 20 | 0.7 / 0.9 | 94.0 / 95.5 |
| resting | raise | 20 | 1.0 / 1.7 | 97.4 / 146.0 |
| resting | relay | 20 | 1.4 / 1.9 | 142.1 / 162.7 |
| resting | stop | 20 | 2.5 / 2.9 | 109.4 / 115.5 |

## What the readings say

- **The ordinary prompt pays nothing.** With no hot window and no request,
  `quota-notice` stays under 1 ms whatever the link does: the link is not
  spawned at all.
- **An open request costs one Node start-up per prompt and per Stop.** About
  170–185 ms p50 / 190–210 ms p95 for `switch show`, about 215 ms p50 for a
  raise (two calls). This is paid only while this session has a request open, which is
  from a hot window until the request is decided, expires or the record ages
  out (7.5).
- **A failing link costs the same as an answering one**: a fast non-zero exit
  is not a stall.
- **A hanging link costs the full 5 s bound per call.** 7.1 caps it: prompt and
  Stop calls share one streak, so a session pays at most three of them
  (≈ 15 s in total), plus one per hook already past the check, before the
  link rests until the next reset; resting costs ≤ 2.9 ms p95, the same as
  an absent link.
- **Absent costs ≤ 12 ms**, the chunk load and the record read.

What this does not show: the cost on a slower machine class (the CI runner
measured 1.1–3.6× slower than this class per concern in
`src/config/hook-latency-budget.json`), or with the real agent-switch, whose
start-up is its own and is not measured here.

## Rollback criterion

The question ships opt-in (`AGENT_CONFIG_SWITCH_QUESTION=1`, step 7.6), so
these readings apply to sessions that turned it on. Withdraw the opt-in from
the documentation or revert the change when any of these is observed:

1. A session pays more than three 5 s link stalls, plus one for each hook that
   was already past the resting check, before the link rests — the back-off
   is not holding.
2. With agent-switch **answering**, `quota-notice` or `session-eol` with a
   request open measures above 500 ms p95 on this machine class with this
   harness — the per-call cost has more than doubled. (A hanging link is
   bounded by criterion 1, not by this one.)
3. A run checkpoint owed for an approved or finished move is never written
   while the session runs on (the record was dropped or replaced first), or
   an older snapshot replaces a newer one.
4. The same relayed line or resting notice is shown twice for one request.
5. A record or back-off update is skipped because its lock could not be had
   within the 250 ms the lock waits — seen as a repeated line or a missing
   checkpoint above, since a skipped update is not logged.
6. The back-off cannot be kept (an unwritable state directory) on a machine
   that pays link stalls — the link never rests there.
7. The `quota_notice` chunk outgrows its ceiling in
   `src/config/hook-bundle-budget.json` again without a reviewed raise.
   Since 8.4 (2026-11-10) the link is its own chunk, `switch_link`; the criterion
   applies to that chunk's ceiling, to `quota_notice`'s, lowered to 29,900 B,
   and to the chunk group `agent-switch-link-opted-in` (60,100 B together).
8. With the opt-in on, the switch question never appears on a hot window, or a
   checkpoint stays owed across Stops, while `agent-switch` answers — the
   `switch_link` chunk is not loading (missing, mis-digested, or another call
   surface).
9. Around an install or a rollback, a resumed run's checkpoint is older than
   one already written for it, or an owed checkpoint stays unwritten while
   `<record>.lock` or a ticket under `switch/` names a process that is not a
   hook of this package; or the link writes nothing for longer than fifteen
   minutes after an install because the drain does not end. Procedure,
   including the lock cleanup a rollback to 20.2.0 needs:
   `docs/contracts/agent-switch-link.md` § Install and rollback.
