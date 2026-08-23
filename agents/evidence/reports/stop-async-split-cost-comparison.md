<!-- evidence-type: analysis -->

# Stop async split — cost versus saving

**Measured:** 2026-08-23. **Machine:** one, `darwin-arm64`, Node v24. **Method:**
`./scripts-run src/scripts/bench_hook_latency`, n=50 per run, 3 runs per arm, p50 read per
run. **Produced for:** `road-to-per-turn-hook-economy-carry` step B1.0, which exists
because both council seats of 2026-08-22 independently recorded that no cost-versus-saving
figure for this split existed.

This artefact decides nothing. It supplies the two figures
`b-async-split-cancellation` was written to be answered with.

## Figure 1 — the wall clock the async-capable concerns actually cost

Measured by arm substitution on the `claude` `stop` list in
`src/scripts/hook_manifest.yaml:958`, rebuilding the dispatcher bundle between arms and
restoring the manifest afterwards (`git diff --stat` clean).

| Arm | `stop` concern list | p50 per run (ms) | p50 taken |
|---|---|---|---|
| A — as shipped | all 12 | 83 · 84 · 84 | **84 ms** |
| B — sync-required only | `end-review-nudge`, `turn-end-gate`, `session-eol` | 81 · 81 · 81 | **81 ms** |
| C — dispatcher floor | `[]` (empty) | 62 · 63 · 65 | **63 ms** |
| control | `node -e 0`, no dispatcher | 20 · 20 · 21 | **20 ms** |

Derived, by subtraction:

| Quantity | ms | How |
|---|---|---|
| Dispatcher fixed cost (spawn + 1.1 MB bundle load + dispatch machinery) | **43** | C − control |
| All 12 concerns' own work | **21** | A − C |
| The 3 sync-required concerns' work | **18** | B − C |
| **Everything the split could move off the critical path** | **3** | A − B |

**The saving is ≤ 3 ms per turn, and strictly less than 3 ms.** The 3 ms figure covers
*nine* concerns, not eight: `run-continuation` sits inside it and is not on the
async-capable list (see the correction below), so the eight concerns the split targets
cost some fraction of 3 ms that this method cannot separate further without per-concern
instrumentation that does not exist.

Against the registered per-turn composite — `(pre + post) × 10 + ups + stop` = **1186 ms**
p50 on the same machine, same session — a 3 ms saving is **0.25 %**. The slot is dominated
by the 43 ms dispatcher fixed cost, which the split does not touch: an async group is a
*second* dispatcher invocation, so backgrounding eight concerns removes 3 ms of concern
work from the critical path and adds a second 43 ms spawn off it.

## Figure 2 — the prerequisite cost, as a diff estimate

| Prereq | Surface | Estimate | Risk class named by the roadmap |
|---|---|---|---|
| B1.1 (P1) | `build_claude_hook_matrix` + `claude_hook_matrix_parity.test.ts` + a decision record | 2 source, 1 test, 1 ADR | Changes the type carried into **every** claude consumer's `settings.json` |
| B1.2 (P2) | `turn_end_gate_hook` completion-claim read + interleaving test with a sabotage arm | 1 source, 1 test | **Correctness** — the race can flip the turn-end gate to ALLOW |
| B1.3 (P3/P4 audit) | `dispatch-issues.jsonl` locking, the `rule-trips.json` read inside the lock, `summary.json` per-invocation cap, plus `bcbb0380b` | ~3 files, 1 test per mechanism | One of the four is **corruption-capable**, not merely lossy |
| B2.1 | dispatcher subset filter + manifest field | 2 source, 1 test | May not ship alone |
| B2.2 (P5) | live host session with the split config | not producible in this repository | Capability-gated on the host owner |

Five prerequisites, three touching safety or correctness surfaces, one not producible here
at all — for ≤ 0.25 % of the turn-end wall clock.

## Correction: the classification is stale by one concern

The roadmap states *"Eleven concerns bind `stop` on claude"* and enumerates 3 + 8. The
manifest at this commit carries **twelve** (`hook_manifest.yaml:958`): `run-continuation`
was added after that classification was written and is on neither list. It is recorded
here rather than silently folded into either arm, and it is why Figure 1's 3 ms is an
upper bound on the eight rather than their measured cost.

## Scope boundary

Every reading is from **one machine**. The figures establish the *order of magnitude* of
the saving — single-digit milliseconds against a four-digit composite — which is what the
decision turns on; they do not establish a cross-machine p50. A second machine would move
the 84/81/63 triple, and would not plausibly move 3 ms into a range that competes with
five prerequisites.
