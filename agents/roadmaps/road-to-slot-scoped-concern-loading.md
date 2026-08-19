---
complexity: lightweight
status: ready
---

# Road to slot-scoped concern loading — stop every concern taxing every slot

**Goal.** A hook slot pays the load cost of the concerns bound to **that slot**,
not of every concern in the manifest. Today it pays for all of them, so each new
concern raises the latency floor of slots it was never bound to.

## Context — the measurement that opened this

The dispatcher is one precompiled bundle (`dist/hooks/dispatch.js`). Every
concern in it is parsed and initialised on every dispatch, whatever slot fired.
That is invisible until a concern lands, and then it moves every row at once.

Measured 2026-08-19, when `feat/org-telemetry-phase1-emission` merged a
`telemetry-usage` concern bound to **`post_tool_use` only**:

| reading | before | after |
|---|---:|---:|
| CI `main`, `pre_tool_use` p50 | 111-148 ms | **176 ms** |
| local A/B, `pre_tool_use` p50, n=50 | 91.5 ms | **103 ms** |
| same-run control (`node -e 0`) | 26-49 ms | unchanged |

`pre_tool_use` slowed by the same margin as `post_tool_use` despite carrying
none of the new concern, and the control was flat — so the cost is load, not
execution, and not the runner. The bundle grew 16 kb (+1.5 %) for +12.6 % p50.

Two candidate causes were measured and **refuted**: the YAML dependency is lazy
by construction, and `node:crypto` was already bundled before the merge (~4 ms).
Which added module dominates the 11 ms is **not** established — this roadmap does
not need to know, because it removes the coupling rather than the instance.

The immediate consequence is recorded as `b-concern-load-taxes-every-slot` on the
per-turn hook-economy roadmap: the trunk went red on the pre-registered latency
gate and every open PR inherits it.

## Why this is a class, not an instance

The per-turn hook-economy roadmap has already spent two phases attributing
per-event cost to per-concern work and publishing nulls both times. This is the
complementary axis: cost that scales with the **number of concerns installed**
rather than with what any concern does. Left alone it recurs at every future
concern, and the visible symptom each time is a latency cap that looks too tight.

## Phase 0 — Size the prize before changing anything

- [ ] Measure what fraction of one dispatch is module load versus concern
      execution: a dispatcher entry that loads the bundle and exits immediately,
      against the same fixture and `--runs 50`, compared with a normal dispatch.
      `verify:` the load-only cell exists as a number, on the same machine and n
      as the gate.
- [ ] State the ceiling this work can reach. If load is a small share of the
      dispatch, the honest outcome is to close this roadmap and say so —
      see Honest null below.
      `verify:` the share is written into this file as a percentage with its
      measurement command.

## Phase 1 — Choose the mechanism (maintainer decision)

- [ ] Compare the candidates against Phase 0's number and record the pick here.
      Known options: (a) dynamic `import()` per concern so esbuild code-splits
      and only the fired slot's chunks load; (b) one bundle per slot, built from
      the manifest, at the cost of duplicated shared code on disk; (c) a
      manifest-driven generated dispatch table that keeps a single bundle but
      defers module bodies.
      `verify:` one option is named in this file with the reason the other two
      were not picked.
- [ ] Confirm the pick survives the constraint the current design bought:
      single-process dispatch with no per-concern re-spawn. An option that
      reintroduces a spawn per concern is disqualified regardless of its load
      profile — that regression is what the precompiled bundle replaced.
      `verify:` the chosen option is stated to preserve one process per event.

## Phase 2 — Implement for one slot and measure

- [ ] Apply the chosen mechanism to `pre_tool_use` only, leaving every other slot
      on the current path, so the A/B is inside one tree.
      `verify:` `bench_hook_latency --runs 50` shows `pre_tool_use` improved and
      the untouched slots unmoved, on one machine, arms alternated.
- [ ] Confirm behaviour is unchanged: the same concerns fire, in the same order,
      with the same verdicts.
      `verify:` the hook test suite passes with no test changed to accommodate
      the new loading path.

## Phase 3 — Roll out and lock the property

- [ ] Extend to the remaining slots.
      `verify:` a green run measures `pre_tool_use` p50 back inside the 111-148
      window the 175 ms cap was derived from.
- [ ] Add the regression guard that makes the property durable: a check that a
      concern bound to one slot does not appear in another slot's load path.
      `verify:` the check fails on a deliberately mis-bound fixture and passes on
      the real manifest.

## Honest null, stated before any fix

If Phase 0 shows module load is a minor share of dispatch cost, this roadmap
closes with that number published and no mechanism change. The +12.6 % would then
belong to something the load hypothesis does not explain, and the next step would
be the bisect option recorded at `b-concern-load-taxes-every-slot` rather than a
restructure of the bundle.

## Non-goals

- Naming which merged module cost the 11 ms. That is a separate question, cheap,
  and tracked at the blocker named above.
- Touching the latency cap. The cap is not the defect here; it is the instrument
  that surfaced it.
- Reducing what any individual concern does. That axis belongs to the per-turn
  hook-economy roadmap and has its own phases.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Module load turns out to be a small share of dispatch cost | implementation | The whole premise is that load dominates; if it does not, the restructure is a large change for a small return, and the +12.6 % belongs to something this roadmap does not address | Phase 0 measures the share BEFORE any mechanism is chosen, and the Honest null section commits to closing on that number instead of proceeding by momentum | Phase 0 — Size the prize before changing anything |
| 2 | A splitting mechanism reintroduces a per-concern spawn | implementation | Deferring modules by spawning per concern would undo the single-process dispatch the precompiled bundle exists to provide, trading a load cost for a far larger spawn cost — the exact regression the bundle replaced | Phase 1 carries an explicit disqualification: any option that does not preserve one process per event is rejected regardless of its load profile | Phase 1 — Choose the mechanism (maintainer decision) |
| 3 | Lazy loading changes concern order or silently drops a concern | implementation | Deferred module bodies can shift initialisation order, and a concern that fails to load could be skipped rather than reported, which would be an invisible loss of a guard | Phase 2 requires the hook test suite to pass with no test changed to accommodate the new path, and Phase 3 adds a check that fails on a deliberately mis-bound fixture | Phase 2 — Implement for one slot and measure |
