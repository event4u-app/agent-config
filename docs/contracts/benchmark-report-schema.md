---
stability: beta
keep-beta-until: 2026-08-14
---

# Benchmark Report Schema — step-4 Phase 2

Parser-visible contract for the JSON + Markdown reports emitted by
[`scripts/bench_run.py`](../../src/scripts/bench_run.ts). Every `task bench`
run writes one `internal/bench/reports/<ts>-<corpus_id>.json` + matching `.md`.

## File layout

```
internal/bench/
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
  pricing_sourced_on: <ISO date from internal/bench/pricing.yaml>
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
cache:                                             # REQUIRED — see below
  read_write_ratio: <float> | { unavailable: <reason> }
  stable_prefix_share: <float 0.0-1.0> | { unavailable: <reason> }
verdict:
  selection: pass | fail
  quality: pass | fail | not_collected
  overall: pass | fail | partial                   # partial = quality not_collected
  ranking_metric: tokens | cost-per-solved         # OPTIONAL, default `tokens`
```

## The `cache` block — required, never omitted

`road-to-runtime-context-floors` Phase 4. Both fields are **required**, not
optional, and a report that cannot compute one states a reason instead of
omitting the key:

```yaml
cache:
  read_write_ratio: { unavailable: "no cache_read/cache_creation fields in the session source" }
  stable_prefix_share: 0.82
```

| Field | Meaning |
|---|---|
| `read_write_ratio` | `cache_read_input_tokens / cache_creation_input_tokens` over the run. Above 1 means the prefix is being read more than it is being rewritten, which is the whole point of having one. |
| `stable_prefix_share` | the share of dispatches whose payload hash repeated at least once — the STABLE cohort of `_lib/payload_hash_drift`, as a fraction of all dispatches carrying the field. |

### Why these two and not token count

The direction was adopted on in-tree evidence, and the in-tree evidence is
specifically a **refutation of the token-count intuition**:
`road-to-cache-economy`'s C-5 assumed a straightforward token-reduction win and
was **falsified**, while C-1 confirmed cold-start dominance at 69.7 %. Rewriting
a prefix repeatedly pays the cache-write rate rather than the cache-read rate, so
an arm can reduce input tokens and still cost more. Token reduction is not the
objective function; cache-stable, smaller, correct contexts are, and these two
fields are what distinguish them.

An external benchmark reporting the same direction with much larger figures is
**not** cited as evidence here: this checkout cannot reach it, so it is recorded
as a hypothesis in the roadmap and carried nowhere else.

### Goodhart guard

A mandatory ratio invites tuning the ratio. Two things bound that, deliberately:
`ranking_metric` keeps `cost-per-solved` available so the ratio stays
*diagnostic* rather than becoming the score, and the `unavailable` form requires
a **stated reason** rather than a fabricated number — a blank or a `0.0` standing
for "not measured" is the failure this shape exists to prevent.

## The `ranking_metric` option

`tokens` (default) or `cost-per-solved`. Not a replacement and not the default:
an option, so a comparison can rank on cost at held quality rather than on token
volume. Implemented in `src/scripts/_lib/arm_ranking.ts`; a fixture run in
`tests/scripts/_lib/arm_ranking.test.ts` ranks two arms in **different orders**
under the two metrics, which is what makes the choice substantive rather than
cosmetic.

## Markdown shape

Headers in order:

1. `# Benchmark Report — <corpus_id> · <generated_at>`
2. `## Headline` — three-line summary (selection · tokens · quality).
3. `## Selection accuracy` — table per prompt with hit/miss + expected/got.
4. `## Token usage` — per-tier message counts + token totals; "unavailable"
   block if no session jsonl was found. The monetary (USD) comparison is
   **intentionally not rendered** — per-call API pricing misleads
   subscription users; tokens are the currency-neutral metric that matters.
5. `## Quality probe` — per-prompt assertion pass/fail; `not_collected`
   block when no agent-output path was passed.
6. `## Notes` — `corpus path` and the versioned filename for citation.

## Invariants

- **No silent drops.** Missing token source → emit `source: unavailable`
  with a marker; never omit the section.
- **Quality stub honesty.** When agent outputs are not provided, set
  `quality.source: not_collected` and `verdict.overall: partial`. Score
  stays `0.0`; never inflate by assuming pass.
- **The `cache` block is never omitted.** A missing `read_write_ratio` or
  `stable_prefix_share` is a schema failure naming the field
  (`check_benchmark_report_fields`). Uncomputable → `{ unavailable: <reason> }`,
  never a blank and never a zero standing in for "not measured".
- **Tokens, not money.** The rendered report shows token counts only. The
  JSON still carries the `cost` block (`total_cost_usd`, per-tier `cost_usd`)
  for back-compat with downstream consumers, but no USD figure is rendered in
  the Markdown headline, sections, or footer.

## Cross-references

- Runner — [`scripts/bench_run.py`](../../src/scripts/bench_run.ts)
- Baseline collector — [`scripts/bench_runner.py`](../../src/scripts/bench_runner.ts)
- Corpus contract — [`benchmark-corpus-spec.md`](benchmark-corpus-spec.md)
- Pricing source — [`internal/bench/pricing.yaml`](../../bench/pricing.yaml)
- Cost session reader (live sessions) — [`scripts/cost/track.mjs`](../../src/scripts/cost/track.mjs)
