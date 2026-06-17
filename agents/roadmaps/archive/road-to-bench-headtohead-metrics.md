---
complexity: lightweight
status: ready
parent_roadmap: harvest-small-enhancements
---

# Roadmap: Bench head-to-head + pass^k/pass@k reliability metrics

> **Active (2026-06-16).** Spawned from `road-to-harvest-small-enhancements`
> Phase 4b. The draft gate assumed the discipline-axis benchmark was archived
> **as a kill** ("building on sand"). On inspection it is archived **as
> complete** (24/24 done) — the v2 harness is built and live; its code is in the
> repo (`taskfiles/bench-ab.yml`, `src/scripts/bench_ab_v2_stats.py`,
> `internal/bench/`). The gate is therefore satisfied by reality: this layer
> extends an existing, complete harness — no un-archive needed.

## Status — harness is built (gate satisfied)

The **discipline-axis benchmark** (v2) is **complete**, archived as done at
`agents/roadmaps/archive/road-to-discipline-axis-benchmark.md`; its harness code
is live in the repo. This roadmap adds head-to-head + reliability metrics on top
of that built harness.

## Phase 1 — Reliability metrics (only when the benchmark is live)

- [x] Add **agent-X-vs-Y head-to-head** comparison to the bench harness (same
      task, two agents/configs, paired result). — `head_to_head()` in
      `src/scripts/bench_ab_v2_stats.py`: per arm-pair paired W/L/T on capability
      + mean discipline Δ; wired into `--json`, `--markdown`, and plaintext.
- [x] Add **pass^k / pass@k** reliability metrics (consistency across k runs, not
      just a single pass) to the harness output. — `reliability()`: per-arm
      pass@k (≥1 of k) + pass^k (all k) over non-errored seed-runs; verified on a
      real saturated report + a synthetic variance fixture.

## Provenance

- Parent: `road-to-harvest-small-enhancements.md` Phase 4b (Source-E ADAPT —
  reliability-metric discipline).
- Owner harness: `agents/roadmaps/archive/road-to-discipline-axis-benchmark.md`
  (archived as **complete** — the harness is built; this layer extends it).
- Council: claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15.
