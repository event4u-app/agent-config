---
stability: beta
keep-beta-until: 2026-08-28
---

# Value Report Schema (`value-v1`)

Parser-visible contract for the JSON report emitted by
[`scripts/_lib/value_report.py`](../../scripts/_lib/value_report.py)
and consumed by [`scripts/render_value_md.py`](../../scripts/render_value_md.py).
Sibling of [`benchmark-report-schema.md`](benchmark-report-schema.md);
companion to [`value-dashboard-spec.md`](value-dashboard-spec.md) which
owns the semantics this contract types.

## File layout

```
internal/bench/
├── pricing.yaml                         # per-1M model rates + sourced_on dates
└── reports/
    └── value/
        ├── 2026-05-28T10-30-00Z.json    # machine-readable value-v1 report
        ├── 2026-05-28T10-30-00Z.md      # optional human dump (informational)
        └── latest.json                  # symlink or copy of newest report
```

Filename format: `<UTC ISO-8601 with `:` → `-`>.{json,md}`. Sortable
lexicographically.

## JSON schema (v1)

```yaml
schema_version: 1                   # int — bump on a breaking change
schema_id: value-v1                 # string literal
generated_at: <ISO-8601 UTC>
reference_scale:
  requests: 1000                    # int — N requests being priced
  avg_input_tokens: 8000            # int — assumed input tokens per request
  avg_output_tokens: 600            # int — assumed output tokens per request
  model_tier: sonnet                # haiku | sonnet | opus
  pricing_sourced_on: <ISO date>    # from internal/bench/pricing.yaml
baseline:
  label: "Ohne Paket / Without package"
  input_tokens_per_request: <int>   # the 0-point of the ladder
cost_ladder:
  - id: load
    label: "<German + English>"
    what_it_does: "<≤ 80 char phrase>"
    token_delta: <signed int>       # per-request input token delta
    eur_delta: <float>              # priced at reference_scale
    cumulative_pct: <signed float>  # % of baseline.input_tokens_per_request
    confidence: measured | estimated | vendor-claim | pending
    source_report: <relative path>  # raw report this was derived from
    footnote: "<optional caveat>"   # e.g. "Thin-Root files excluded"
  - id: condense
    ...
  - id: rtk
    ...
  - id: terse
    ...
behaviour:
  - id: selection
    label: "<German + English>"
    what_this_means: "<one line caption>"
    with: <value>                   # metric-specific
    without: <value>
    delta: <signed value>           # with - without
    unit: pct | count | ratio | seconds
    mode: live | dry-run
    source_report: <relative path>
  - id: destructive-stops
    ...
  - id: ask-vs-act
    ...
  - id: completion
    ...
totals:
  cumulative_token_delta: <signed int>   # sum of cost_ladder token_deltas
  cumulative_eur_delta: <float>          # priced at reference_scale
  cumulative_pct: <signed float>         # net % of baseline
  net_verdict: net-saving | net-cost | break-even   # by sign of cumulative_pct
notes:
  - "Token→€ conversion priced at <model_tier> rates from <pricing source>."
  - "<other invariants surfaced as plain prose>"
```

## Invariants

- **No silent drops.** Missing input → emit the rung with
  `confidence: pending` and a `source_report` pointing to the raw
  report path the renderer *expected* to find. Never omit a rung
  from `cost_ladder` because data was missing.
- **No saving label on negative.** A rung with `token_delta > 0` is a
  *cost* rung; a rung with `token_delta < 0` is a *saving* rung;
  zero is *neutral*. The linter
  ([`scripts/lint_value_dashboard.py`](../../scripts/lint_value_dashboard.py))
  rejects any rendered "saving" label on a positive `token_delta`.
- **No `measured` without a real source.** A rung that carries
  `confidence: measured` MUST have a `source_report` that exists on
  disk under `internal/bench/reports/`. The linter walks this.
- **Reference scale is documented.** The renderer prints the
  `reference_scale` block prominently in the dashboard so a reader
  can recompute mentally for a different workload.
- **Mode badge is mandatory in `behaviour`.** Every behaviour metric
  carries `mode: live | dry-run`. The renderer prints the badge
  inline; a `dry-run` value is never the headline.

## Cumulative rule

`cumulative_pct[i]` = the running cumulative of `token_delta` from
rungs `0..i` divided by `baseline.input_tokens_per_request`,
expressed as a signed percentage. The **NETTO** line that the
renderer prints in Panel A is identical to `totals.cumulative_pct`.

```
cumulative[i]   = sum(rung.token_delta for rung in cost_ladder[:i+1])
cumulative_pct  = 100 * cumulative[i] / baseline.input_tokens_per_request
```

A rung with `confidence: pending` contributes `token_delta: 0` to
the cumulative (its raw value is the renderer's best guess from the
raw report; it MUST NOT influence the headline until it flips to
`measured`).

## Markdown shape (informational human dump)

The `.md` sibling of every `value-v1.json` is informational — a
flat textual dump of the same data, useful for `git diff` review and
human spot-checks. The **production** rendering is
`docs/value.md`, produced by `scripts/render_value_md.py` from the
latest `value-v1.json`.

The optional `.md` dump carries:

1. `# Value Report — <generated_at>`
2. `## Reference scale` — the `reference_scale` block.
3. `## Cost ladder` — one section per rung with its full fields.
4. `## Behaviour` — one section per metric with its full fields.
5. `## Totals` — cumulative line + verdict.
6. `## Notes` — invariants surfaced as prose.

## Cross-references

- Semantics — [`value-dashboard-spec.md`](value-dashboard-spec.md)
- Roadmap — [`agents/roadmaps/road-to-readable-value-dashboard.md`](../../agents/roadmaps/road-to-readable-value-dashboard.md)
- Pricing source — [`internal/bench/pricing.yaml`](../../internal/bench/pricing.yaml)
- Rung normaliser — [`scripts/_lib/value_ladder.py`](../../scripts/_lib/value_ladder.py)
- Report assembler — [`scripts/_lib/value_report.py`](../../scripts/_lib/value_report.py)
- Renderer — [`scripts/render_value_md.py`](../../scripts/render_value_md.py)
- Linter — [`scripts/lint_value_dashboard.py`](../../scripts/lint_value_dashboard.py)
