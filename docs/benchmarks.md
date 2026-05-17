---
stability: beta
keep-beta-until: 2026-08-14
---

# Benchmark cadence

> **Status:** active · **Owner:** `step-16-caveman-substance.md` Phase 1 ·
> **Sources:** [`benchmark-corpus-spec.md`](contracts/benchmark-corpus-spec.md) ·
> [`benchmark-report-schema.md`](contracts/benchmark-report-schema.md)

Where the package's benchmark runs live, when they run, and what counts as
a publishable report. Mirrors the Ruflo `docs/benchmarks/runs/<ISO>.json`
discipline (upstream `5b71c7a`).

## Corpora

| Corpus | Path | Purpose |
|---|---|---|
| `dev` | `tests/eval/corpus-dev.yaml` | router / engine selection |
| `caveman` | `bench/corpora/caveman/prompts.yaml` | compression dialect (`vs_raw` + `vs_terse`) |

## Reports — naming and trail

- **Canonical pointer:** `bench/reports/<corpus>-v<N>.{json,md}` — always
  reflects the latest published run for that corpus version.
- **Timestamped trail:** `bench/reports/<ISO-Zulu>-<corpus>-v<N>.{json,md}`
  — every committed run keeps an immutable history copy alongside.

Both are produced in one `scripts/bench_run.py` invocation; do not commit
one without the other.

## Cadence

| Trigger | Required corpus | Required artefact |
|---|---|---|
| Pre-release bake (any `vX.Y.0`) | `dev` + `caveman` | both reports refreshed |
| Edit to `.agent-src.uncompressed/rules/caveman-speak.md` | `caveman` | report refreshed in same PR |
| Edit to `scripts/bench_run.py` `--caveman` arm | `caveman` | report refreshed in same PR |
| Edit to `bench/corpora/caveman/prompts.yaml` | `caveman` | report refreshed, version bumped (`caveman-vN+1`) |
| Edit to `scripts/_lib/bench_caveman*.py` | `caveman` | report refreshed in same PR |

A PR that touches any of the cadence triggers without refreshing the
corresponding report is rejected by reviewer convention (no CI gate yet
— the trigger surface is too small to warrant one).

## Cost envelope (`caveman` corpus)

10 prompts × 3 arms (`compressed` · `terse-control` · `uncompressed`) = 30
Anthropic calls per run. Observed envelope on `claude-sonnet-4-5` (v1,
2026-05-16): **$0.0805 actual** · 0 errors · realised carve-out share
30.67 %.

## Commands

```bash
task bench -- --caveman                                  # full run
task bench -- --caveman --caveman-max-prompts 1          # 1-prompt smoke
task bench -- --caveman --caveman-dry-run --no-write     # offline shape
```

Cost-touched runs require an `ANTHROPIC_API_KEY` at
`~/.event4u/agent-config/anthropic.key` (mode 600).

## Cross-references

- [`benchmark-corpus-spec.md`](contracts/benchmark-corpus-spec.md) —
  per-prompt schema.
- [`benchmark-report-schema.md`](contracts/benchmark-report-schema.md) —
  per-report JSON / Markdown contract.
- [`compression-default-kill-criterion.md`](contracts/compression-default-kill-criterion.md)
  — how a published `caveman-v<N>` report is read against the kill table.
- `agents/roadmaps/step-16-caveman-substance.md` Phase 1 — where the
  caveman corpus was authored.
