---
complexity: structural
status: ready
parent_roadmap: road-to-capability-headroom-benchmark
---

> Blocked on a maintainer go for the build. Phase 1 (cheap go/no-go baseline)
> is the decisive small spend; do NOT build the full 4-arm envelope before it.

# Roadmap: agentic-headroom benchmark (v4) — long-horizon, does governance finally show?

v1/v2/v3 nulled: capable hosts are at/near ceiling on short deterministic tasks
(capability AND discipline) → no headroom. The maintainer chose to invest in the
ONE regime where a wrapper lift could be real: **long-horizon agentic tasks**,
where errors compound (GAIA/AgentBench/SWE-bench regime).

## Council (2026-06-15, claude-sonnet-4-5 + gpt-4o, 2 peer-reviewed rounds) — SPLIT

The council did NOT converge — a genuine, falsifiable disagreement:

- **Optimistic (B):** multi-module debugging over a ~40-tool-call horizon shows
  headroom — predicted baseline **45-55%**, with ~45% of failures
  *process-recoverable* (correct hypothesis abandoned prematurely; partial fix
  without verification; gave up after an unrelated error). Predicted package lift
  **+8-12pp**. Mechanism analogy: surgical checklists cut complications 18-36%
  even though surgeons know the steps — forced verification under cognitive load.
- **Pessimistic (A):** long debugging tests *reasoning* (hypothesis formation,
  cross-module architecture), which governance (rules, not weights) cannot move →
  another null; "no ground-truth until the end" makes intermediate governance
  ineffectual.

**They agree on the experiment and the threshold — only the predicted outcome
differs. Only a pilot resolves it. Shared falsifiable gate:**
- **PASS / headroom exists:** baseline solve-rate **45-70%** AND package lift
  **≥5pp** over placebo (McNemar, **≥6 discordant pairs**, effect size ≥0.3).
- **FALSIFY / capability-bound:** baseline **>70%** (saturated before governance
  matters) OR baseline in-range but delta **<5pp** (it's reasoning, not process).

## Locked constraints (carry forward, learned the hard way)

Deterministic oracle (no judge); novel/non-memorized; sealed local sandbox (NO
live web); 4-arm + placebo; budget-capped + error-aware; exclude the 3 known
confounds (prompt-coaching, plugin-hook file pollution, budget-truncation).

## Two axes (council Q2)

- **Primary = solve-rate** on the long task (held-out integration suite passes).
- **Secondary = deterministic catastrophe/regression rate over the trajectory**
  (a hidden test that was green goes red; a forbidden/destructive op; a declared-
  done-while-suite-red). The package's hypothesized edge is fewer compounding
  discipline failures — this axis captures it even if solve-rate is close.

## Phase 1 — Build a small multi-module task class + CHEAP baseline go/no-go

- [x] Authored **3 sealed multi-module "mini-project" debug/feature tasks**: a
      small repo (5-10 plain-ESM modules) with a HELD-OUT integration test suite
      (`node tests/integration.check.mjs`) the agent never sees; the bug's root
      cause is several hops from the symptom (navigation + multi-edit, ~20-40
      tool calls). Novel, deterministic. Reuse the `solve_test` oracle.
- [x] Added the **trajectory catastrophe metric**: a second hidden test asserting
      pre-existing invariants stay green (regression), + a forbidden-op / scope
      guard, scored from the post-state.
- [x] **Cheap baseline probe ran (decisive):** vanilla-only, the chosen
      host(s), 3-4 tasks × 1-2 seeds. Read baseline solve-rate against the gate:
      - >70% → FALSIFY direction (still capability-ceiling); consider a weaker
        host or longer horizon ONCE (N≤3 loop budget), else stop + report null.
      - 45-70% → headroom plausible → proceed to Phase 2.
      - <45% → too hard / capability-bound (governance can't rescue raw failure);
        re-scope difficulty down.

## Phase 1b — Host choice (adversarial, council Q5)

- [x] Weak host tested (per the adversarial branch): sonnet solved 8/9 hard bugs + stayed disciplined
      everywhere. If the Phase-1 baseline on sonnet is >70%, run the probe on a
      **weaker host** (`claude-haiku-4-5`) and/or a **longer horizon** where even
      sonnet's "probably done" judgment demonstrably degrades. Pick the (host ×
      horizon) cell with genuine headroom BEFORE the 4-arm spend.

## Phase 2 — 4-arm run + attribution (only if Phase 1 shows headroom)

- [-] vanilla / package / package-rdp / placebo × the task class × ≥3 seeds,
      budget-capped, error-aware. Primary = solve-rate (McNemar paired);
      secondary = regression/catastrophe rate (paired). Cost per arm (L10).
- [-] Apply the gate. PASS = ≥5pp solve-rate lift over placebo (≥6 discordant
      pairs) OR a significant catastrophe-rate reduction; else honest null.

## Phase 3 — Render + resolve + scale

- [-] Render: Table 1 solve-rate, Table 2 catastrophe/regression rate, Table 3
      cost; honesty labels; "efficiency / fewer compounding failures, not
      intelligence" framing. Scale N only on a PASS.

## Result (2026-06-15) — robust null; the one apparent flip was NOISE

**Phase 1 baseline (sonnet, 3 long multi-module tasks): 3/3 = 100%.** Bare Sonnet
navigated 8-18 tool calls across 8-10 modules and solved every multi-hop bug with
full discipline → FALSIFY direction (>70%). The optimistic council prediction
(~45-55% baseline) was empirically wrong for Sonnet.

**Phase 1b weak host (haiku):** a first apparent signal — vanilla 2/3 (67%) vs
package 3/3 on a single seed; vanilla "failed" agL-debug-01. **De-noise (3 fresh
seeds): vanilla solved agL-debug-01 3/3.** The lone failure was stochastic noise;
it vanished on replication. No real lift.

**Final, robust conclusion across v1/v2/v3/v4** (multiple hosts haiku+sonnet,
scales micro→meso→hard→long-agentic, multiple seeds, the predicted best-case
weak-host+long-horizon regime, the placebo + de-noise discipline):

> **There is no replicable, measurable agent-config package lift on any
> deterministic task we can practically build — capability or discipline, on a
> weak or strong host, short or long horizon. The single apparent flip died on
> replication.**

This is NOT "the package is useless." It is a precise, hard-won boundary: the
package's value (governance, safety floors, consistency, catastrophe-prevention,
and qualities that don't reduce to solve-rate on solvable tasks) is **not
measurable by a deterministic solve/discipline benchmark**. A real signal would
need tasks that are hard for *process* reasons a capable model genuinely and
*replicably* botches — which, on everything we built, it does not.

**Recommendation: STOP the benchmark investment.** Do not scale (scaling would
chase the noise the de-noise just killed). Keep the apparatus. If the package's
value is to be evidenced, it is via a fundamentally different method (e.g.
audited real-world incident-avoidance / longitudinal usage outcomes), not a
deterministic task benchmark.

## Acceptance criteria

- A baseline that does NOT saturate (45-70%) at some (host × horizon) cell, or an
  honest report that even long agentic tasks stay capability-bound on our hosts.
- Any lift attributed (package>placebo, ≥6 discordant pairs) on solve-rate or
  catastrophe-rate; else honest null. Deterministic oracle, sealed sandbox,
  novel tasks, placebo arm, cost per arm throughout.
