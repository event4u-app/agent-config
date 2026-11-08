<!-- evidence-type: analysis -->

# agent-switch link — whole-hook latency (2026-11-08)

Step 7.2 of `agents/roadmaps/road-to-a-link-with-agent-switch.md`: what the
switch question costs on the two hook paths it runs on, with agent-switch
answering, failing, hanging, resting (backed off by 7.1) and absent.

## Setup

- Harness: `agents/evidence/analysis/agent-switch-link-latency.mjs`, run as
  `npx tsx agents/evidence/analysis/agent-switch-link-latency.mjs 20` after
  `npm run build:hooks`, at the tree of `feat/agent-switch-link-hardening`
  (Phase 7.1/7.3/7.5 in place).
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
| absent | quiet | 20 | 0.6 / 0.9 | 112.8 / 141.4 |
| absent | raise | 20 | 1.8 / 2.6 | 125.9 / 176.9 |
| absent | relay | 20 | 9.9 / 10.9 | 131.5 / 155.3 |
| absent | stop | 20 | 11.7 / 13.6 | 131.5 / 158.2 |
| answering | quiet | 20 | 0.5 / 0.8 | 116.6 / 139.3 |
| answering | raise | 20 | 214.0 / 224.0 | 347.6 / 360.3 |
| answering | relay | 20 | 171.7 / 203.6 | 299.6 / 338.6 |
| answering | stop | 20 | 165.0 / 180.2 | 294.8 / 312.0 |
| failing | quiet | 20 | 0.6 / 0.8 | 130.5 / 142.7 |
| failing | raise | 20 | 214.0 / 274.9 | 346.4 / 397.3 |
| failing | relay | 20 | 176.1 / 192.0 | 302.5 / 320.9 |
| failing | stop | 20 | 180.9 / 201.1 | 312.1 / 345.3 |
| hanging | quiet | 5 | 0.5 / 0.8 | 108.2 / 134.3 |
| hanging | raise | 5 | 5171.9 / 5199.8 | 5312.9 / 5327.0 |
| hanging | relay | 5 | 5013.8 / 5019.1 | 5147.5 / 5515.1 |
| hanging | stop | 5 | 5016.4 / 5019.1 | 5152.4 / 5171.6 |
| resting | quiet | 20 | 0.6 / 1.0 | 108.2 / 138.3 |
| resting | raise | 20 | 0.8 / 1.5 | 105.7 / 149.3 |
| resting | relay | 20 | 0.9 / 2.1 | 120.3 / 145.8 |
| resting | stop | 20 | 2.7 / 3.4 | 118.4 / 153.0 |

## What the readings say

- **The ordinary prompt pays nothing.** With no hot window and no request,
  `quota-notice` stays under 1 ms whatever the link does: the link is not
  spawned at all.
- **An open request costs one Node start-up per prompt and per Stop.** About
  170 ms p50 / 200 ms p95 for `switch show`, about 215 ms for a raise (two
  calls). This is paid only while this session has a request open, which is
  from a hot window until the request is decided, expires or the record ages
  out (7.5).
- **A failing link costs the same as an answering one**: a fast non-zero exit
  is not a stall.
- **A hanging link costs the full 5 s bound per call.** 7.1 caps it: prompt and
  Stop calls share one streak, so a session pays at most three of them
  (≈ 15 s in total) before the link rests until the next reset; resting costs
  ≤ 3.4 ms p95, the same as an absent link.
- **Absent costs ≤ 14 ms**, the chunk load and the record read.

What this does not show: the cost on a slower machine class (the CI runner
measured 1.1–3.6× slower than this class per concern in
`src/config/hook-latency-budget.json`), or with the real agent-switch, whose
start-up is its own and is not measured here.

## Rollback criterion

Turn the question off by default (`AGENT_CONFIG_NO_SWITCH_QUESTION=1` as the
shipped default, step 7.6) or revert, when any of these is observed:

1. A session pays more than three 5 s link stalls before the link rests — the
   back-off is not holding.
2. `quota-notice` with a request open measures above 500 ms p95 on this machine
   class with this harness — the per-prompt cost has more than doubled.
3. The `quota_notice` chunk outgrows its ceiling in
   `src/config/hook-bundle-budget.json` again without a reviewed raise.
