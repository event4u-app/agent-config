<!-- evidence-type: analysis -->

# Does a second agent earn its spawn where every arm fails? (2026-11-06)

**Roadmap step:** `road-to-proof-where-the-owner-sees-it` 1.7.
**Pre-registration:** `internal/bench/headroom-17-PREREG.md` (original text plus
two amendments, both committed before the sweep's first paid call).
**Report:** `internal/bench/reports/ab-v2/2026-11-06T10-58-24Z-ab-v2-paired.json`
(gitignored). The evidence bundle is stored as
`bench-evidence/2026-11-06T10-58-24Z-ab-v2-paired` under the user-global
agent-config directory. `bench_evidence_store verify` checked it: 4 files hash-verified, re-scored offline, reference
reproduced.
**Reader:** `./scripts-run src/scripts/bench_headroom_17_report <report.json>`.
**Host:** `claude-sonnet-4-6`, container isolation, base profile `package`, 6 tasks
× 3 arms × 8 seeds = 144 runs.

## Verdict — no rung. The primary result is a null at this size, and arm C fails its safety bar.

| Bar (pre-registered) | Required | Measured | |
|---|---|---|---|
| C beats B, all six tasks | one-sided sign test, α 0.05 | 7 vs 5 discordant, **p = 0.387** | not detected |
| C beats B on the headroom cluster | needed for a rung | 5 vs 5, p = 0.623 | no |
| C beats B on the hold-out | needed for a rung | 2 vs 0, p = 0.25 | not detected |
| C false-positive rate | ≤ 25 % | **19 / 48 = 39.6 %** | **fail** |
| Net value C vs B, per run | > 0 | **−$0.067** | negative |

No ladder `test` rung is proposed. The capability result is **"not detected at this
size"**, not "no effect". With 48 pairs the run had 80 % power only for a
discordance of about 0.15. The observed net discordance is (7 − 5) / 48 ≈ 0.04. The
safety failure does not depend on power. Arm C's own tests reject the correct
fix in two runs out of five.

Arm D did not run: its 3.2a gate failed, which is Amendment 1. D stays open.

## Capability per task (hidden verifier, budget stop and errored runs count as fail)

| Task | Cluster | A | B | C |
|---|---|---|---|---|
| `capH-debug-08` | headroom | 1/8 | **5/8** | 0/8 |
| `hdrH-done-01` | headroom | 0/8 | 0/8 | **5/8** |
| `hdrL-multistep-01` | headroom | 0/8 | 0/8 (1 errored) | 0/8 (2 errored) |
| `hdhB-boundary-01` | hold-out | 0/8 | 0/8 | 2/8 |
| `hdhI-invalidation-01` | hold-out | 0/8 | 0/8 | 0/8 |
| `hdhS-sentinel-01` | hold-out | 0/8 | 0/8 | 0/8 (1 errored) |
| **Total** | | **1/48** | **5/48** | **7/48** |

The two headroom wins cancel out. One effort step more (B) solves the debugging
task and C does not. C solves the definition-of-done task and B does not. That
looks like a task-shape effect, not a general lift. It is also the reason a pooled
sign test cannot separate the two arms.

Descriptive comparisons, not part of any bar: B vs A 4–0 (p = 0.0625). C vs A 7–1
(p = 0.035). The C vs A difference is real but irrelevant here. The registered
question is whether C beats the same-compute arm, and against B it does not.

## Arm C false positives — the safety endpoint

A false positive is a generated test file that fails on the pristine fixture
with the reference patch applied. Each was replayed outside the harness
after the run:

| Task | FP | What the tests asserted that the reference contradicts |
|---|---|---|
| `hdrL-multistep-01` | 8/8 | `--limit 0` returns no records. The task README says `0` means unlimited. |
| `hdhS-sentinel-01` | 7/8 | the old error text `maxItems must be at least 1` for `-1`. The reference changes it to `must be 0 or more`. |
| `hdhI-invalidation-01` | 3/8 | that the array returned by `getRoles` is isolated from later mutation. The reference does not promise that. |
| `hdhB-boundary-01` | 1/8 | `hasNext` false on a partial last page |
| `capH-debug-08`, `hdrH-done-01` | 0/16 | — |

**Sensitivity:** the `hdhS` count rests on an error message the requirement does
not fix. The smoke run already showed this, and the sealed hold-out was not
changed after it. Without that task the rate is 12 / 40 = 30 %, still over the
ceiling. The verdict does not depend on it.

The failure mode is consistent across tasks. The tester writes tests from the
requirement and is blind to constraints stated elsewhere (a README, an
established error message). The author then implements against those wrong
tests, and C's passes come only on tasks where the tests happened to agree with
the hidden verifier.

## Cost (priced from `internal/bench/pricing.yaml`, Sonnet 4.6 row sourced 2026-11-04)

Every run is priced, errored runs included, with all steps summed:

| Arm | n | errored | p50 / run | p95 / run |
|---|---|---|---|---|
| A | 48 | 0 | $0.238 | $0.626 |
| B | 48 | 1 | $0.270 | $0.687 |
| C | 48 | 3 | $0.589 | $1.361 |

**Net value of C vs B (D4):** `p_catch · D − C_extra − r_FP · C_FP`, where:

- `p_catch` = 7/48: pairs where C passes and B does not.
- `D` = 10 × A's p50 = $2.378.
- `C_extra` = C p50 − B p50 = $0.319.
- `r_FP` = 0.396.
- `C_FP` = A's p50 = $0.238.

That gives 0.146 · 2.378 − 0.319 − 0.396 · 0.238 = **−$0.067 per run**. This is
generous to C: it credits C's gross catches and ignores the 5 pairs that B wins and C loses.

## Spend

| Item | USD |
|---|---|
| Harness smoke (`2026-11-06T07-56-10Z`, not analysed) | 1.94 |
| 1.7 sweep | 65.47 |
| **1.7 total, against the $150 release** | **67.41** |
| 3.2a slim-reviewer comparison (its own gate, `road-to-token-economy-dispatch-followup`) | 18.13 |

The sweep came in at about half of the $134 the pre-registration expected. Per-run cost fell
well below the smoke's per-run figure on most tasks.

## Hold-out seal

Recomputed after the run in `internal/bench/ab/`, unchanged from the pre-registration:

```
hdhB-boundary-01      1d08dc39d6d8f44aa243f1babdbfe0b5f84978a5aac61404f95b3d179e106116
hdhI-invalidation-01  cd4ece4c92a8e1087698e8604f842bcdf8524b1b8abdeaacb478f38c7e88d39f
hdhS-sentinel-01      c92967da5c04770155810606bc3b3f39bc2876a22105f15b27fc0569f4c35713
```

## Deviations

- The reader's p50/p95 and net-value lines were added after the sweep, as code
  for endpoints the pre-registration already defined. No endpoint, bar or
  definition changed. Cost percentiles keep errored runs, because a budget stop spent its budget. The
  existing `cost_by_arm` mean excludes them. Both are reported.

## What this does and does not settle

- **Settled for this setup:** a harness-driven test-first step with a requirement-only
  tester does not pay on Sonnet 4.6 over one effort step more. Its tests break
  the safety bar.
- **Not settled:** arm D (reviewer), a tester that sees the repository's
  documentation, and lifts below a discordance of about 0.15.
- **Revisit-if:** a tester prompt or harness that gives the tester the workspace's
  stated constraints (README, existing messages) gets its own pre-registration, or a
  reviewer passes 3.2a and D runs on this corpus.
