---
complexity: lightweight
status: draft
parent_roadmap: harvest-small-enhancements
---

# Roadmap: Bench head-to-head + pass^k/pass@k reliability metrics

> **Status: draft (trigger-gated).** Spawned from
> `road-to-harvest-small-enhancements` Phase 4b. The original instruction —
> "fold into the discipline-axis benchmark work" — is **semantically nonsense**
> (council 2026-06-15): that roadmap is **archived**. An archived roadmap is a
> kill signal, not a placeholder. So this work is deferred behind an explicit
> re-open trigger, not silently folded into a dead roadmap. Hidden from the
> dashboard until flipped to `ready`.

## Trigger (flip to `ready` when this holds)

The **discipline-axis benchmark** work is **re-opened** — i.e.
`agents/roadmaps/archive/road-to-discipline-axis-benchmark.md` is restored to an
active roadmap (or a successor benchmark roadmap is created). Building metrics on
top of an archived harness is building on sand; un-archive the harness first.

## Phase 1 — Reliability metrics (only when the benchmark is live)

- [ ] Add **agent-X-vs-Y head-to-head** comparison to the bench harness (same
      task, two agents/configs, paired result).
- [ ] Add **pass^k / pass@k** reliability metrics (consistency across k runs, not
      just a single pass) to the harness output.

## Provenance

- Parent: `road-to-harvest-small-enhancements.md` Phase 4b (Source-E ADAPT —
  reliability-metric discipline).
- Owner harness: `agents/roadmaps/archive/road-to-discipline-axis-benchmark.md`
  (archived — must be re-opened before this can run).
- Council: claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15.
