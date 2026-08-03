---
complexity: structural
status: ready
---

# Road to hook latency repair — pay for the bundle, not the CLI

> **Source:** operator performance report (2026-08-02, local transcript
> `agents/tmp.old/performance-and-rules.txt`): sessions up to ~10x slower than
> bare-host, attributed largely to hook dispatch overhead. Council disposition
> 2026-08-03 (claude-sonnet-4-5 + gpt-4o, 2 rounds, unanimous): split the
> latency repair from the routing work and ship it first — it closes a
> recorded internal failure, has zero lock conflicts, and no dependencies.
>
> **Recorded failure (verified against HEAD 2026-08-03):** `hooks/hooks.json`
> invokes `agent-config dispatch:hook` (the CLI wrapper) for every event.
> `bench_hook_latency.ts` measures `node dist/hooks/dispatch.js` (the bundle).
> Measured on a warm-cache container: bundle path ~107–168 ms/event; CLI path
> ~450–500 ms/event — ~370 ms of that is eager top-level imports in
> `src/cli/main.ts` (commander, `runMcpServer`, `runUiServe`, `runSettings`,
> `buildHelp`, …) that execute BEFORE the `dispatch:hook` hot-path check. The
> hot-path comment ("pays nothing but the bundle import") is a wiring-truth
> error: it skips the bash delegation, not the CLI boot. Per tool call
> (Pre + Post) consumers pay ~0.9–1.0 s; a 30-tool-call task pays ~30 s of
> pure dispatch overhead. The p95 150 ms CI gate passes while consumers pay
> 3–4x the budget — **the latency budget gates the wrong path.**

## Goal

The hook path costs what its budget says it costs, measured on the path
consumers actually invoke. Target unchanged from the shipped budget
(`src/config/hook-latency-budget.json`): p95 ≤ 150 ms pre_tool_use on CI
hardware — now binding on the real invocation path.

## Locks honored

- **Honest-null consequence of `hook-latency-budget.json` stays verbatim:** if
  the budget is still missed after all levers, hooks go default-off with a
  published known cost. No rescue daemon, no budget relaxation.
- **No-runtime-boundary contract untouched:** every lever below is
  per-invocation; the SessionStart throttle is an mtime file, not a daemon
  (deleting it changes *when* a probe re-runs, never *what* is answerable).

## Phase 1 — measure the real path (before any fix lands)

- [ ] `bench_hook_latency.ts` gains a `--via-cli` mode that spawns
      `node dist/cli/agent-config.js dispatch:hook …` exactly as
      `hooks/hooks.json` does (including the project-shim probe). Record the
      current numbers as the committed baseline BEFORE Phase 2 lands.
      *Verify:* baseline entry in the budget history names path, hardware
      class, and per-event p50/p95.
- [ ] Flip the CI latency gate to the `--via-cli` measurement (the budget
      target itself is unchanged).
      *Verify:* gate red on the unfixed CLI path — the gate must demonstrate
      it CAN fail on today's numbers before Phase 2 turns it green.

## Phase 2 — the three levers

- [ ] **Primary:** `hooks/hooks.json` (and every platform trampoline) invokes
      the bundle directly — `node <pkg>/dist/hooks/dispatch.js …` — with the
      existing CLI route kept as fallback when the bundle is absent. Measured
      headroom: ~450–500 ms → ~110 ms per event (≈4x), zero behavior change
      (the CLI hot path already imports the same bundle).
      *Verify:* `--via-cli`-equivalent bench on the new invocation ≤ budget;
      fallback path exercised by a test with the bundle removed.
- [ ] **Secondary (independent value for every CLI invocation):** move the
      `dispatch:hook` check into a minimal entry module ABOVE the eager import
      block, or convert `main.ts`'s command imports to dynamic imports.
      *Verify:* `node dist/cli/agent-config.js dispatch:hook` within 1.5x of
      the bare bundle call.
- [ ] Fix the wiring-truth comment in `src/cli/main.ts` — the comment states
      what is measured, not what is hoped.
      *Verify:* comment names the measured cost and the bench that pins it.
- [ ] **SessionStart fan-out:** `profile-staleness`, `wrapper-freshness`,
      `surface-probe` gain a daily throttle file under
      `agents/runtime/state/` (mtime check; a skipped probe re-runs tomorrow).
      Session start drops from 10 to 7 effective concerns on throttled days.
      *Verify:* second same-day session skips the three probes; next-day
      session runs them; no state semantics beyond the mtime.

## Phase 3 — close the loop

- [ ] Re-run the Phase 1 bench; the CI gate stays flipped to the real path.
      *Verify:* p95 ≤ 150 ms pre_tool_use via `--via-cli`; per-tool-call
      overhead (Pre + Post) ≤ 350 ms p95.
- [ ] Publish the before/after numbers in `docs/CLAIMS.md` (the hook-overhead
      claim becomes emitter-backed, same discipline as the 9.14 count work).
      *Verify:* claim row cites the bench script + committed baseline.
- [ ] **Honest null:** budget still missed after all three levers → the
      pre-committed consequence in `hook-latency-budget.json` applies verbatim
      (hooks default-off + published known cost).

## Success criteria (pre-registered)

- Real-path hook latency: p95 ≤ 150 ms pre_tool_use on CI hardware, measured
  via `--via-cli`.
- Per-tool-call overhead (Pre + Post) ≤ 350 ms p95.
- The CI gate demonstrably fails on the pre-fix path (no gate that cannot
  fail).
- Zero new processes, daemons, or state stores beyond the mtime throttle file.
