<!-- evidence-type: analysis -->

# Pre-registration — the capped pilot against S4

**Roadmap:** `road-to-a-pilot-benchmark-against-s4` steps 1.1–1.4.
**Written:** 2026-10-25, before the pilot run.
**Hash:** this file's sha256 is recorded in the commit message that lands it; the
result lands in a LATER commit, so the ordering is in the history.

**Disclosure.** The harness was exercised twice before this file was committed,
as a shakedown of the new `neighbour` arm on one task (`trapE-scope-01`, seed 0,
all three arms). The first attempt hit the account's spend limit and produced no
data; the second ran clean at $0.11. Neither run is the pilot and neither is
reported as its result.

## What is being tested

Whether this package (`package`) beats the S4 package (`neighbour`), and whether
either beats no package (`vanilla`), on two committed task classes, one host,
paired by task and seed.

## Arms — 1.1

| Arm | What the host loads |
|---|---|
| `vanilla` | no package: `--setting-sources project,local` |
| `package` | this package as installed on the host, hooks included |
| `neighbour` | S4 at commit `e49479937753c8aca5a09aa76dbe2eea1b68f187`, loaded for the run only via `--plugin-dir`, with `--setting-sources project,local` and `--strict-mcp-config` |

**S4 runs with its own hooks OFF**, and every data store it would write points
into a per-run temp directory. The supply-chain intake found that its hooks, at
every profile, write and prune under the user's home, inject state from earlier
sessions into later ones, and start their own model calls. Running them would
contaminate the benchmark and the machine. So the `neighbour` arm measures S4's
skills, agents, commands and rules, not its hooks. This limit is stated with
every result below and is not a finding about S4's hooks.

## Task classes — 1.2

From `internal/bench/corpora/ab-trackb-v2.yaml`, no task written for this pilot.
Both classes run through the same runner, `bench_ab_v2_run`. That replaces the
roadmap's second corpus, `defect-finding.yaml`, which has its own harness with
no neighbour arm.

- **Scope discipline** (5 tasks): `trapE-scope-01`, `trapE-scope-02`,
  `trapE-scope-03`, `trapE-scope-meso-01`, `trapE-scope-laravel-01`.
- **Debugging capability** (9 tasks): `capH-debug-01` … `capH-debug-09`.

## Host, n, metrics, decision rule — 1.3

- **Host:** `claude-haiku-4-5`, one model pinned for every arm. The earlier
  strong-host run sat at ceiling for both arms (`docs/benchmark.md`), so a weak
  host is the one where a difference can show. Results hold for this host only.
- **n:** 3 seeds per task → 15 pairs (scope) and 27 pairs (debug) per arm;
  126 runs in total.
- **Primary metric per class:** scope → `discipline_score`; debug →
  `capability_pass` (0/1).
- **Secondary, reported, decides nothing:** `capability_pass` on scope, tokens
  per run.
- **Comparisons:** (P) `package` vs `neighbour` — primary, one per class;
  (S) `package` vs `vanilla` and `neighbour` vs `vanilla` — secondary.
- **Decision rule:** `decidePairedVerdict` (`src/scripts/_lib/paired_verdict.ts`)
  over per-pair deltas, ties dropped, α = 0.05, the exact sign test's derived
  floor of 5 discordant pairs. The two primary comparisons are Holm-corrected
  (`holmSignificant`). A comparison under the floor is reported as
  `underpowered`, never as a null.
- **No composite score.** Quality, cost (tokens) and the safety limit above are
  reported separately.
- **Errored runs** count as harness errors, not data, and are listed by cause.
  If more than 10 % of runs error, the pilot is reported as not read.

## Cost — 1.4

The shakedown measured $0.11 for three runs on this host. 126 runs at the
heavier arm's cost (about $0.08 a run) estimate to about **$10**. Hard bounds
regardless of the estimate: `--budget 1.0` per run, `--max-usd 148` for the
sweep — under the owner's cap of $150 even if every run hit its own cap.
