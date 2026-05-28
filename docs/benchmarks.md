---
stability: beta
keep-beta-until: 2026-08-14
---

# Benchmark cadence

> **Status:** active · **Owner:** `step-16-telegraph-substance.md` Phase 1 ·
> **Sources:** [`benchmark-corpus-spec.md`](contracts/benchmark-corpus-spec.md) ·
> [`benchmark-report-schema.md`](contracts/benchmark-report-schema.md)

Where the package's benchmark runs live, when they run, and what counts as
a publishable report. Mirrors the Ruflo `docs/benchmarks/runs/<ISO>.json`
discipline (upstream `5b71c7a`).

## Corpora

| Corpus | Path | Purpose |
|---|---|---|
| `dev` | `tests/eval/corpus-dev.yaml` | router / engine selection |
| `telegraph` | `internal/bench/corpora/telegraph/prompts.yaml` | condensation dialect (`vs_raw` + `vs_terse`) |
| `rtk` | `internal/bench/corpora/rtk/commands.yaml` | rtk CLI-output filtering savings (Phase 2 of `road-to-readable-value-dashboard.md`) |
| `value` | _derived_ | aggregated dashboard — no own corpus, reads from the others |

## Reports — naming and trail

- **Canonical pointer:** `internal/bench/reports/<corpus>-v<N>.{json,md}` — always
  reflects the latest published run for that corpus version.
- **Timestamped trail:** `internal/bench/reports/<ISO-Zulu>-<corpus>-v<N>.{json,md}`
  — every committed run keeps an immutable history copy alongside.

Both are produced in one `scripts/bench_run.py` invocation; do not commit
one without the other.

## Cadence

| Trigger | Required corpus | Required artefact |
|---|---|---|
| Pre-release bake (any `vX.Y.0`) | `dev` + `telegraph` | both reports refreshed |
| Edit to `.agent-src.uncondensed/rules/telegraph-speak.md` | `telegraph` | report refreshed in same PR |
| Edit to `scripts/bench_run.py` `--telegraph` arm | `telegraph` | report refreshed in same PR |
| Edit to `internal/bench/corpora/telegraph/prompts.yaml` | `telegraph` | report refreshed, version bumped (`telegraph-vN+1`) |
| Edit to `scripts/_lib/bench_telegraph*.py` | `telegraph` | report refreshed in same PR |
| Edit to any rung source (frugality / telegraph / rtk / A/B) | `value` | `task value` re-renders `docs/value.md` in same PR |
| Edit to `internal/bench/corpora/rtk/commands.yaml` | `rtk` | `scripts/bench_rtk_savings.py` refreshed in same PR |

A PR that touches any of the cadence triggers without refreshing the
corresponding report is rejected by reviewer convention (no CI gate yet
— the trigger surface is too small to warrant one).

## Cost envelope (`rtk` corpus)

8 commands × 2 arms (raw vs. rtk-filtered) = 16 local shell invocations
per run. Zero API spend — pure local measurement. Wall-time ≈ 5–10 s on
the maintainer's repo (`scripts/bench_rtk_savings.py --quiet`).

## Cost envelope (`telegraph` corpus)

10 prompts × 3 arms (`condensed` · `terse-control` · `uncondensed`) = 30
Anthropic calls per run. Observed envelope on `claude-sonnet-4-5` (v1,
2026-05-16): **$0.0805 actual** · 0 errors · realised carve-out share
30.67 %.

## Commands

```bash
task bench -- --telegraph                                  # full run
task bench -- --telegraph --telegraph-max-prompts 1          # 1-prompt smoke
task bench -- --telegraph --telegraph-dry-run --no-write     # offline shape
```

Cost-touched runs require an `ANTHROPIC_API_KEY` at
`~/.event4u/agent-config/anthropic.key` (mode 600).

## Cross-references

- [`benchmark-corpus-spec.md`](contracts/benchmark-corpus-spec.md) —
  per-prompt schema.
- [`benchmark-report-schema.md`](contracts/benchmark-report-schema.md) —
  per-report JSON / Markdown contract.
- [`condensation-default-kill-criterion.md`](contracts/condensation-default-kill-criterion.md)
  — how a published `telegraph-v<N>` report is read against the kill table.
- `agents/roadmaps/step-16-telegraph-substance.md` Phase 1 — where the
  telegraph corpus was authored.
