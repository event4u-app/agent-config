<!-- evidence-type: analysis -->

# Benchmark coverage — what is measured, and who owns the rest (2026-11-04)

An **index of owners and newest readings, not a result.** Read at `9ed90dbe85`
for round `inbox-2026-11-bn`, which asked "what do we still have to
benchmark?". Status vocabulary:

- `measured-live` — a paid or live run exists and is reported;
- `pilot` — a live run exists but is small, underpowered or one-machine;
- `built-not-run` — a harness or pre-registration exists, no live run;
- `not-measured` — neither.

Every ab-v2 discipline reading predates the 2026-10-28 oracle repair
(`docs/benchmark.md` § Task validity) and is not re-scored; the re-run waits
on `stubs/road-to-a-rerun-on-the-repaired-scorer` (owner question OQ-64).
Families M01–M16 follow the source's numbering.

| ID | Family | Newest reading | Status | Measurement owner |
|---|---|---|---|---|
| M01 | `/work`, `/implement-ticket`, dispatcher completion | none found | not-measured | none found (owner search: `grep -rliE 'implement-ticket\|dispatcher'` over active, later, stubs) |
| M02 | Cross-file impact, map / code graph | `docs/benchmark.md` § Map task set (built, not yet run); code graph vs grep v2 in-repo (2026-08-29, zero winning classes) | built-not-run | `road-to-a-map-that-holds-on-the-real-repo` Phase 5; `stubs/road-to-code-graph-benchmark-rerun` |
| M03 | Long-horizon work, compaction, resumability | none found | not-measured | none found |
| M04 | Memory, second brain, ADR revision | § Second-brain recall delta and retrieval precision (24-entry store) | pilot | none found for stale-ADR / supersession judgment |
| M05 | Review, council, team | § adversarial-verification-council (honest null); § Defect-finding team vs self vs council (ceiling-limited null) | measured-live | `stubs/road-to-council-topology-benchmark-execution`; `later/road-to-council-topology-evidence-followups` |
| M06 | Safety guards under indirection | § Governance invariants under indirection (2026-08-02) | pilot | `stubs/road-to-a-security-chain-measured` |
| M07 | CI / quality gates, false-verified | `check_bench_task_validity --gate` (oracle validity only, not outcomes) | built-not-run | `stubs/road-to-assurance-benchmark` (8.2 false-verified) |
| M08 | Model routing, token policy | `docs/CLAIMS.md` `downshift-cost-reduction` (read-only fan-out family, n=10) | pilot | `later/road-to-evidence-calibrated-model-orchestration`; `later/road-to-cross-model-routing-eval` |
| M09 | Prompt cache, context | § Cache-injection anatomy null (2026-08-10) | pilot | none found for billed-vs-estimated cache cost |
| M10 | Security audit recall | none found | not-measured | `stubs/road-to-assurance-benchmark` (seeded security mistakes in 8.1) |
| M11 | Frontend / UI | `docs/CLAIMS.md` artifact pre-registrations (2026-10-28, before any run) | built-not-run | `stubs/road-to-frontend-power-live-measurements` |
| M12 | Media forensics / generation QA | none found | not-measured | `stubs/road-to-media-channels-measured` |
| M13 | Multi-host install / projection | Consumer Matrix and Public Install Smoke CI (deterministic, every PR) | measured-live | CI; `stubs/road-to-evidence-driven-stability` |
| M14 | Provenance / memory poisoning | none found | not-measured | none found |
| M15 | Planning / roadmap quality | none found as outcome; step receipts in shadow | built-not-run | `road-to-a-map-that-holds-on-the-real-repo` Phase 3 (receipts, falsifiable verify) |
| M16 | Learning from landed commits | none found | not-measured | `later/road-to-a-learner-the-measurements-gate` |

## What this does not say

A `none found` owner is a grep over `agents/roadmaps/` (active, `later/`,
`stubs/`) at the pin, not a proof that no plan exists elsewhere. A
`measured-live` row says a run exists, not that it showed a lift — M05's
readings are nulls. Six families have neither a reading nor a measurement
owner (M01, M03, M14, and the stale-ADR half of M04, the billed-cost half of
M09, plus M10 beyond the assurance stub's seeded corpus).
