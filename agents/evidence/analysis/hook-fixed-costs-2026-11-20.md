<!-- evidence-type: analysis -->

# Hook dispatch fixed costs, before and after (2026-11-20)

`road-to-a-hook-system-that-pays-for-what-it-does` 2.5. Pin `2eef08c00b`
against head `46e1d7b4e6` (Phase 2 landed: one YAML copy, environment hardened
once, one feedback write; the compile-cache stub for the direct path was carried).
darwin arm64, Apple M5 Max, node v26.7.0, interleaved, n = 40 per cell after
3 warm-ups. One machine class; the CI runner was not measured.

## Load set (`bench_hook_ab --trace`)

| Event | Pin | Head |
|---|---|---|
| `pre_tool_use` | 72 files from `node_modules` (`yaml`) | nothing outside the bundle |
| `post_tool_use` | `chat_history` chunk + 72 from `node_modules` | `chat_history` chunk |
| `user_prompt_submit` | 4 chunks + 72 from `node_modules` | 4 chunks |
| `stop` | 3 chunks + 72 from `node_modules` | 3 chunks |

## Timing, real workspace (this repository, settings present, feedback on)

| Event | `node -e 0` | Pin p50 | Head p50 | Change |
|---|---|---|---|---|
| `pre_tool_use` (`Read`) | 26.7 | 81.9 | 66.4 | −19 % (−15.5 ms) |
| `post_tool_use` (`Edit`) | 26.5 | 89.6 | 74.3 | −17 % (−15.3 ms) |

## Timing, empty workspace, replay mode (`bench_hook_ab`, feedback writes off)

| Event | `node -e 0` | Pin p50 | Head p50 | Change |
|---|---|---|---|---|
| `pre_tool_use` | 24.8 | 67.3 | 56.6 | −10.8 ms |
| `post_tool_use` | 24.2 | 67.5 | 58.9 | −8.6 ms |
| `user_prompt_submit` | 26.7 | 117.3 | 113.2 | −4.1 ms |
| `stop` | 25.7 | 120.5 | 117.4 | −3.1 ms |

Replay mode skips feedback writes, so it does not show 2.4's gain; the
real-workspace rows do.

## Reading

- Above the bare node start, `pre_tool_use` went from about 55 to 40 ms of own
  work in the real workspace (−28 %).
- AC-3 asked for −20 % at p50 on `pre_tool_use` on the direct path; measured
  −19 %. The part not taken — compile-caching the bundle on the direct path —
  measured 108 → 93 ms in the earlier variant run and is carried to
  `later/road-to-a-hook-system-with-isolated-guards` 0.1. The launcher path
  (`agent-config dispatch:hook`) caches already: p50 70 → 59 ms.
- Earlier variant runs the same day, same machine, a busier load
  (`pre_tool_use`, real workspace): today 125 · one YAML copy 108 · plus entry
  compile cache 93 ms.

Reproduce: `./scripts-run internal/bench/core/bench_hook_ab --variant
pin=<pin-root>/dist/hooks/dispatch.js --variant head=dist/hooks/dispatch.js
--runs 40` (and `--trace`), the pin root built with `git archive 2eef08c00b src
hooks package.json` plus `npm run build:hooks`.
