<!-- evidence-type: analysis -->

# MCP fingerprint slot measurement — recorded null

**Date:** 2026-08-23. **For:** `road-to-mcp-runtime-integrity` step 1.2 and AC-2.
**Outcome:** the measurement this file was specified to carry **cannot be taken**, and
this is the record of why rather than a substitute for it.

Step 1.2 requires three numbers: *"the measured added p95, the composite value it was
measured against, and the armed `p50_ci` it was compared to."* The third does not exist.

## The null, in four parts

**Unavailable capability.** An armed per-turn composite ceiling.
`src/config/hook-latency-budget.json` carries `per_turn_composite` with
`observe_only: true` and `p50_ci: null`, and the arming step it depended on —
`A2.1` of `road-to-per-turn-hook-economy-carry` — was itself closed as an honest null on
this same date: `check_composite_arming` reports **n = 0**, no reading store exists, and CI
never commits readings back so it cannot fill inside one change. The dependency did not
merely fail to arrive; it was measured and found structurally out of reach for now.

**Affected claims.** Nothing in this repository establishes that a pre-use fingerprint
lookup fits the `pre_tool_use` slot. So the slot decision is **not made**, no fingerprint
concern is bound to any hook slot, and — stated plainly, as the roadmap's council required
— **rug-pull protection remains absent and the protection level is zero.**

**Evidence boundary.** What *is* built and proven: the fingerprint store, the digest, the
mismatch/unchanged/first-sighting outcomes, and their tests
(`tests/scripts/mcp_tool_fingerprint.test.ts`, 12 cases, each behaviour sabotage-proven).
What is measured elsewhere and bears on this: `pre_tool_use` reads p50 ≈ 53 ms in this
worktree against a `p95_ci: 175` budget, and the slot is dominated by dispatcher spawn and
bundle load rather than by concern work — which is exactly why the roadmap's Risk 3 refuses
to infer that a nominally O(1) hash lookup fits. Nominal cost predicts nothing about the
reading, and this file does not pretend otherwise.

**Reopening condition.** `check_composite_arming` reports armable (≥ 10 readings from ≥ 2
distinct CI runner sessions), the ceiling is armed with a number, and then step 1.2 is taken
as written: measure the added p95 of a fingerprint lookup in `pre_tool_use` against the
armed ceiling and record all three numbers here. A number that misses the armed ceiling
routes to `b-per-turn-composite-ceiling`, never to a budget change.

## What was NOT done, deliberately

No `post_tool_use` and no session-start fingerprint variant ships. The roadmap's
`## The no-silent-downgrade rule` forbids it without an owner-recorded trade-off, and the
reason is the threat rather than the latency: for a tool with irreversible side effects, a
mismatch detected after first execution is a post-mortem, not a control. The store built for
step 1.1 is bound to **no hook slot at all**, and its module header says so, so wiring it
into one later is a visible decision rather than a default.
