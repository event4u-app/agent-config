# Transport share of the large-payload dispatch cell

<!-- evidence-type: analysis -->

Produced for `b-payload-read-parse-dominates`, option (a), council 2026-08-20
(2/2 quorum): *"add a same-fixture dispatcher cell that reads stdin and exits
immediately, reporting its own latency and its share of the large-payload
delta."*

## What was measured, and with what

`./scripts-run src/scripts/bench_hook_latency --read-exit-cell 3000000 --runs N`

The cell takes four readings in ONE invocation, alternating arms, so no number
here is compared across separate runs:

| Arm | What it is |
|---|---|
| full dispatch, small | `post_tool_use`, minimal payload, whole concern chain |
| full dispatch, large | same, `tool_response` padded to 3 MB |
| read + parse, small | the same bundle with `--read-exit`: read fd 0, `_build_envelope`, exit |
| read + parse, large | same, padded |

`--read-exit` exits before the manifest load, before concern resolution and
before every concern, so the probe and the slot differ in exactly one thing:
what happens after the envelope exists. Bundle load and process spawn are in
both arms and cancel in the large-minus-small delta, which is why the delta —
not the absolute — is the number this cell reports.

## Result

Environment: darwin-arm64, node v26.7.0, one machine, warm cache. Per § 2 of
`road-to-per-turn-hook-economy`, **the shape transfers and the magnitude does
not**; these are not CI numbers.

At `--runs 50`, the gate's own sample size, two consecutive rounds:

| Round | slot small | slot large | slot delta | read+parse small | read+parse large | transport delta | transport share |
|---|---|---|---|---|---|---|---|
| 1 | 62 ms | 158 ms | 96 ms | 54 ms | 120 ms | 66 ms | **69 %** |
| 2 | 59 ms | 143 ms | 84 ms | 52 ms | 114 ms | 62 ms | **74 %** |

**Roughly 70 % of the large-payload delta is the dispatcher's own read and
parse** — one read of the pipe and one `JSON.parse`, before any concern runs.

## What this settles, and what it does not

It settles the question the blocker asked. Option (b) at that blocker — "accept
the cell as host-imposed and close D-2 as mis-attributed" — turns out to be
*mostly* right and not entirely: about 30 % of the delta is still downstream of
the read, so there is a remainder with an owner rather than a shrug. The
council's reason for refusing (b) as an answer holds: the Phase-2 null falsified
the earlier attribution to per-concern churn; it did not show the remaining cost
unavoidable, and now a number says how much of it is.

It does **not** say the ~70 % is irreducible. A streaming or incremental parse
would attack exactly that term; option (c) at the blocker names it, and it is a
much larger change than this roadmap scoped.

## The instrument needs the 50-run sample, measured

At `--runs 12` the same cell read **44 %, 51 % and 157 %** across three rounds.
A share above 100 % is arithmetically possible only as noise — the padded slot
arm happened to land faster than its own probe arm — so 12 runs is below the
threshold where this estimator says anything. Reported here rather than dropped,
because it is also the evidence behind the `arming_precondition` now recorded on
the `per_turn_composite` row in `src/config/hook-latency-budget.json`: a summed
metric set from single-digit readings would carry this same instability into a
gate.

## Reproducing

```bash
npm run build:hooks
./scripts-run src/scripts/bench_hook_latency --read-exit-cell 3000000 --runs 50
```

The flag is measurement-only and refuses `--gate`, `--update` and `--baseline`,
for the same reason `--payload-bytes` does: a padded payload must never write a
budget row or a regression baseline.
