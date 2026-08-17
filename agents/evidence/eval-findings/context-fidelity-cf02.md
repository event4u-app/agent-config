# Spike cf02 — memory staleness census on the curated store

**Date:** 2026-08-17
**Roadmap:** [road-to-context-fidelity.md](../../roadmaps/road-to-context-fidelity.md) Phase 0
**Tree:** `9beeb0662` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.233 · model `claude-opus-5[1m]`
**Pre-registered threshold (Phase 2 kill criterion):** a stale ratio **below
10 %** shrinks Phase 2 to stamps only, with the ladder unbuilt and the null
published.

## Verdict up front

**The stale ratio is 21.5 % (23 of 107). The kill criterion does not fire and
the eviction ladder stays justified.**

And the more useful half: the ratio the *existing instrument* reports is
**0.0 %**, and that 0.0 % is an artefact. Had this census read the instrument
instead of the tree, it would have killed Phase 2 on a number that measures
stamping rather than truth.

## Why the shipped instrument reads 0.0 %

`memory_report` prints `staleness-rate=0.0% (0/107)`, and `check_memory` reports
zero findings. Both are correct about what they measure and neither measures
staleness in the sense this roadmap means.

| Fact | Value | Consequence |
|---|---|---|
| Entries carrying `last_validated` | 107 / 107 | The stamp is not missing — it is a `REQUIRED_KEY` (`check_memory.ts:60-68`) |
| Distinct `last_validated` values | **1** — `2026-07-09` | Every entry was stamped on one day. 107 stamps, not 107 verifications |
| Distinct `review_after_days` values | **1** — `365` | One uniform window, applied without regard to volatility |
| Earliest date any entry can read stale | **2027-07-09** | The instrument is structurally silent for another 326 days |
| Commit anchor in the stamp | **absent** | A date cannot be tied to a tree state, so no reader can tell a verified entry from a re-stamped one |
| Store-wide contradiction sweep | **absent** | `check_memory_contradiction` requires `--type --key --body`: it validates one *proposed* entry, not the store |

Two of those rows are the whole finding. A uniform stamp plus a uniform 365-day
window means the age axis cannot distinguish a true entry from a false one, and
the missing commit anchor means it cannot be repaired by reading the dates more
carefully. This is the already-satisfied-test shape: a check that passes because
it cannot fail.

## Method — what was actually done

Because no store-wide contradiction sweep exists, the tree axis was walked by
hand: **all 107 entries**, one per row, each `body` claim checked against the
current tree with a targeted grep or read. Three verdicts, assigned by evidence
rather than by age:

- **still-true** — the load-bearing assertion holds, with a `file:line`.
- **stale** — the tree now contradicts it, with what the tree says instead.
- **unverifiable** — the claim is about an external system, a past event, a host
  behaviour, or a recorded preference, so the tree can neither confirm nor refute
  it. Counted separately rather than folded into either side; folding them into
  "true" would inflate the pass rate and folding them into "stale" would
  manufacture defects.

Three independent walkers were used, one per store, each blind to the others'
results and to this verdict.

## Result

| Store | n | still-true | stale | unverifiable | stale % (of n) |
|---|---:|---:|---:|---:|---:|
| `product-rules.yml` | 66 | 52 | 9 | 5 | 13.6 % |
| `historical-patterns.yml` | 24 | 12 | **11** | 1 | **45.8 %** |
| `incident-learnings.yml` | 17 | 9 | 3 | 5 | 17.6 % |
| **Total** | **107** | **73** | **23** | **11** | **21.5 %** |

Against the verifiable subset alone (107 − 11 = 96), the stale ratio is
**24.0 %**. Both readings clear the 10 % threshold, so the verdict does not
depend on which denominator a reader prefers — stated because a single
denominator would have invited exactly that objection.

**Age axis: 0.0 %. Tree axis: 21.5 %.** Same store, same day, same 107 entries.

## The distribution is the second finding

Staleness is not uniform across the stores, and the spread is large enough to
matter for the ladder's thresholds:

- `historical-patterns` is **45.8 %** stale — three times the `product-rules`
  rate. Its entries are mostly *downstream-surface* notes ("adding X touches
  these N places"), and those decay every time a generator changes. Six of its
  eleven stale rows trace to one event: ADR-201 removed markdown condensation,
  so every entry describing a manual dist write or a `--mark-done` step is now
  wrong.
- `product-rules` is **13.6 %** stale, and its stale rows cluster too: five of
  nine are entries about the `subagents.auto` setting, which
  always-on-orchestration deleted. One removal invalidated five entries.
- `incident-learnings` carries the **highest unverifiable share** (5 of 17,
  29 %) — unsurprising, since an incident is a past event by definition.

**A uniform 365-day window is therefore the wrong shape**, independent of its
length: the volatile store and the stable store get the same treatment, and the
volatile one is the one that decays. That is a finding for Phase 2 step 3, whose
thresholds this census was meant to supply.

## What a single upstream change does to the store

The clustering above is the mechanism worth carrying forward: **staleness
arrives in batches, not per entry.** Two removals (ADR-201's condensation step,
the `subagents.auto` knob) account for **11 of the 23** stale rows. An
age-and-quarantine ladder handles the slow tail; it does not handle a batch, and
a batch is what actually happened here twice.

This is not an argument against the ladder — the 21.5 % justifies it. It is an
argument that contradiction-against-the-tree has to be the *primary* signal and
age the fallback, which is what Phase 2 step 5 already says ("contradiction
outranks retention") and what the missing commit anchor currently makes
impossible to compute.

## Reproduction

Age axis, deterministic:

```
./scripts-run src/scripts/memory_report --format text     # staleness-rate=0.0% (0/107)
./scripts-run src/scripts/check_memory                    # 0 error(s), 0 warning(s), 0 info
grep -h last_validated agents/memory/*.yml | sort | uniq -c   # 107 × 2026-07-09
grep -h review_after_days agents/memory/*.yml | sort | uniq -c # 107 × 365
```

Tree axis: **not reproducible by a command** — that is the point of the missing
sweep. It was a per-entry read, and re-running it means re-reading. The per-entry
verdict tables live in this run's session transcript; the counts above are the
census.

## What this does not show

- **It is one observer's classification.** Three walkers each read their own
  store; no entry was double-classified, so the inter-rater agreement is
  unmeasured. A borderline `still-true` / `unverifiable` call could move a few
  rows. It cannot plausibly move 23 rows to below 11, which is what the verdict
  would need to flip.
- Nothing here says a stale entry ever misled a session. The harm is inferred
  from the content, not observed in behaviour — the same boundary cf03 states.
- The intake store (`agents/memory/intake/`) is out of scope: `learning_sidecar`
  already decays it on a 30-day half-life and never promotes into the curated
  files, which is a deliberate council condition, not a gap.
