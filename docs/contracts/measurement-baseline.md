---
stability: stable
---

# Measurement baseline — contract

> **Status:** locked 2026-05-16 · **Owner:** `step-4-measurement-and-benchmark.md`
> · **Cited by:** every P2 enforcement roadmap (skill rationalization G0, north-star G1, compression default decision).

Single source of truth for what `task bench` measures, what counts as
drift, and what unblocks enforcement. Read this before pinning a number
to a roadmap or PR description.

## What `task bench` measures

Four axes, all numeric, all reproducible from the same input:

| Axis | Source | Definition | Units |
|---|---|---|---:|
| **selection accuracy** | [`scripts/bench_runner.py`](../../scripts/bench_runner.py) | Keyword-overlap ranker hits the expected skill in top-K | % |
| **cost** | [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs) session jsonl | Token+USD per model, captured live | USD |
| **quality** | regex / rubric assertions per prompt | `quality_assertion` matches in agent output | % |
| **projection fidelity** | [`scripts/bench_per_tool.py`](../../scripts/bench_per_tool.py) | `accuracy(tool) / accuracy(augment)` for skill-projecting tools | ratio |

Schemas: [`benchmark-report-schema.md`](benchmark-report-schema.md) ·
[`benchmark-corpus-spec.md`](benchmark-corpus-spec.md). Reports land at
`bench/reports/<utc-stamp>-<corpus>[-projection].{json,md}` —
timestamped, never overwritten, content-addressed by run.

## Corpora — frozen for the soak window

| Corpus | Path | Prompts | Purpose |
|---|---|---:|---|
| `dev` | [`tests/eval/corpus-dev.yaml`](../../tests/eval/corpus-dev.yaml) | 10 | Developer task surface (Laravel/Symfony/React/CI/PR) |
| `non-dev` | [`tests/eval/corpus-non-dev.yaml`](../../tests/eval/corpus-non-dev.yaml) | 16 | Founder / agency / content creator surface (Wing-4) |

Total 26 prompts ≥ Acceptance Criteria floor of 25. Mid-window edits
to either YAML restart the 60-day clock per
[`compression-default-kill-criterion.md`](compression-default-kill-criterion.md) § 2.

## What counts as drift

[`scripts/bench_drift_check.py`](../../scripts/bench_drift_check.py)
compares the latest report against a sliding window of the prior N runs
(default 5) for the same corpus.

| Axis | Threshold | Note |
|---|---|---|
| selection accuracy | latest − baseline_mean ≤ −5 pp | always evaluated |
| cost | latest / baseline_mean ≥ +20 % | only when both sides have `source: captured` |
| quality | latest − baseline_mean ≤ −10 pp | skipped when latest is `not_collected` |
| projection fidelity | tool fidelity < 0.85 | exit 1 from `task bench:projection` |

Drift exits with code 2 from `task bench:drift`. **CI posture during
soak:** all bench-drift steps `continue-on-error: true` and post a
sticky PR comment — informational only, not a merge gate. Flip to
required check happens via a separate PR once
`task bench:baseline-ready` returns 0 (see below).

## What unblocks enforcement (the G1 gate)

```
TASK bench:baseline-ready EXIT 0 IS THE ONLY AUTHORITY.
NO ANECDOTE, NO INDIVIDUAL REPORT, NO ROADMAP-SIDE OVERRIDE.
```

[`scripts/bench_baseline_ready.py`](../../scripts/bench_baseline_ready.py)
returns exit 0 iff both:

1. **Wall-clock soak:** `today − bench/baseline-start.txt ≥ --min-days` (default 60)
2. **Report density:** `bench/reports/*-<corpus>.json` count ≥ `--min-reports` (default 30)

Soak start anchored at [`bench/baseline-start.txt`](../../bench/baseline-start.txt)
= **2026-05-16**. Earliest possible flip: **2026-07-15**, contingent
on the 30-report floor.

Downstream consumers:

- ``step-99-north-star-restructure.md` § Acceptance G1` — reads this exit code.
- [`compression-default-kill-criterion.md` § 3](compression-default-kill-criterion.md) — reads the decision table after baseline closes.
- ``step-2-skill-inventory-rationalization.md` § G0` — usage-data soak floor.

## What the closeout writes

On baseline closure, the step-4 closeout writes the numeric verdict to
[`docs/parity/bench.json`](../parity/bench.json) — frozen snapshot with
the 30+ reports averaged, drift verdict, and the compression-default
decision per the kill-criterion table. That file is the artefact every
P2 roadmap reads — not the live `bench/reports/` directory.

## Carve-outs

- **Pricing freshness:** [`bench/pricing.yaml`](../../bench/pricing.yaml) rows must carry `sourced_on: YYYY-MM-DD`. Stale prices = stale numbers = no trust (ruflo "measured-vs-claimed" pattern).
- **Subjective grading excluded:** quality scoring is mechanical via `quality_assertion`. No vibes.
- **Cursor / Cline / Windsurf:** rules-only surfaces, no SKILL.md projection. `bench:projection` reports them as `not_applicable` — the gap is acknowledged, not silently dropped.

## Cross-references

- [`benchmark-report-schema.md`](benchmark-report-schema.md) · per-report JSON schema
- [`benchmark-corpus-spec.md`](benchmark-corpus-spec.md) · corpus YAML schema
- [`compression-default-kill-criterion.md`](compression-default-kill-criterion.md) · decision table read by step-4 closeout
- `step-4-measurement-and-benchmark.md` · the owning roadmap
