---
stability: beta
keep-beta-until: 2026-08-16
---

# Benchmark Report Schema — step-4 Phase 2

Parser-visible contract for the JSON + Markdown reports emitted by
[`scripts/bench_run.py`](../../scripts/bench_run.py). Every `task bench`
run writes one `bench/reports/<ts>-<corpus_id>.json` + matching `.md`.

## File layout

```
bench/
├── pricing.yaml                       # per-1M model rates + sourced_on dates
└── reports/
    ├── 2026-05-16T10-30-00Z-dev.json  # machine-readable
    ├── 2026-05-16T10-30-00Z-dev.md    # human-readable
    └── ...
```

Filename format: `<UTC ISO-8601 with `:` → `-`>-<corpus_id>.{json,md}`.
Sortable lexicographically.

## JSON schema (v1)

```yaml
schema_version: 1
generated_at: <ISO-8601 UTC>
corpus:
  id: <corpus_id>
  path: tests/eval/corpus-<id>.yaml
  prompt_count: <int>
runner:
  bench_run_version: <semver>
  baseline_collector: scripts/bench_runner.py     # selection-accuracy floor
  baseline_collector_sha: <git-sha-or-mtime>
selection:
  top_k: 3
  prompts_hit: <int>
  prompts_total: <int>
  selection_accuracy: <float 0.0-1.0>             # hits / total
  target: <float>                                 # from corpus
  passed: <bool>                                  # accuracy >= target
  per_prompt:                                     # one entry per corpus prompt
    - id: canonical-01
      expected_skills: [...]
      top_k_ranked: [...]
      hit: <bool>
cost:
  source: agents/cost-tracking/sessions.jsonl     # or "unavailable"
  sessions_scanned: <int>
  totals:
    input_tokens: <int>
    output_tokens: <int>
    cache_read_input_tokens: <int>
    cache_creation_input_tokens: <int>
    total_cost_usd: <float>
  per_tier:                                        # haiku / sonnet / opus / unknown
    sonnet: { messages: <int>, cost_usd: <float> }
    ...
  pricing_sourced_on: <ISO date from bench/pricing.yaml>
quality:
  source: <path-or-"not_collected">
  prompts_with_assertion: <int>
  prompts_passing: <int>
  quality_score: <float 0.0-1.0>                  # passing / total OR 0.0 if not_collected
  per_prompt:
    - id: canonical-01
      assertion: <regex-string>
      assertion_kind: rubric.must_include | quality_assertion
      passed: <bool | "not_collected">
verdict:
  selection: pass | fail
  quality: pass | fail | not_collected
  overall: pass | fail | partial                   # partial = quality not_collected
```

## Markdown shape

Headers in order:

1. `# Benchmark Report — <corpus_id> · <generated_at>`
2. `## Headline` — three-line summary (selection · cost · quality).
3. `## Selection accuracy` — table per prompt with hit/miss + expected/got.
4. `## Cost capture` — per-tier table + total; "unavailable" block if no
   session jsonl was found.
5. `## Quality probe` — per-prompt assertion pass/fail; `not_collected`
   block when no agent-output path was passed.
6. `## Notes` — pointer to `pricing.yaml`, `corpus path`, and the
   versioned filename for citation.

## Invariants

- **No silent drops.** Missing cost source → emit `source: unavailable`
  and `total_cost_usd: 0.0` with a marker; never omit the section.
- **Quality stub honesty.** When agent outputs are not provided, set
  `quality.source: not_collected` and `verdict.overall: partial`. Score
  stays `0.0`; never inflate by assuming pass.
- **Pricing dated.** Every cost row reads `sourced_on` from
  `bench/pricing.yaml`. Stale price (> 90 days) → warning line in the
  Markdown footer.

## Cross-references

- Runner — [`scripts/bench_run.py`](../../scripts/bench_run.py)
- Baseline collector — [`scripts/bench_runner.py`](../../scripts/bench_runner.py)
- Corpus contract — [`benchmark-corpus-spec.md`](benchmark-corpus-spec.md)
- Pricing source — [`bench/pricing.yaml`](../../bench/pricing.yaml)
- Cost session reader (live sessions) — [`scripts/cost/track.mjs`](../../scripts/cost/track.mjs)
