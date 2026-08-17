# The observed `rate_missing` row — field set, and what it can and cannot repair

Discharges the `unknown-model-row-never-observed` blocker of
`road-to-inbox-harvest-2026-08-b-ledger-truth` (`Resolved when:` *"at least one
real `rate_missing` row exists and its field set is written down, so a backfill
pass can be built against an observed shape rather than a guessed one"*).

Measured 2026-08-16 on this repo's own transcript store.

## The blocker's premise was true and had stopped being a reason to wait

The entry, dated 2026-08-13, records that `agents/cost-tracking/` does not
exist, so the ledger has **no rows at all** — not zero *flagged* rows — and
concludes that the precondition is "a step upstream of the one this blocker
waits on". Both halves verify: the directory is still absent, and the
precondition is indeed upstream.

What had not been noticed is that the upstream step is **runnable offline in
one command**. `track.mjs` reads `~/.claude/projects/**/*.jsonl`, takes a
`TRACK_STORE` override so it need not touch the repo, and reaches the network
never. The wait was passive for three days against a producer that only had to
be invoked.

It also did not have to be a hopeful invocation. `modelTier()` matches the three
substrings `haiku` / `sonnet` / `opus` and returns `unknown` for everything
else, and the local corpus contains a high-volume model id that matches none of
them — so a flagged row was **guaranteed** by the corpus before the run, not
hoped for.

```bash
# the run that produced the row; TRACK_STORE keeps it out of the repo
TRACK_CWD=<the worktree the session ran in> \
TRACK_SESSION=<that session's transcript> \
TRACK_STORE=<a scratch path> \
TRACK_QUIET=1 node src/scripts/cost/track.mjs
# stderr: cost-track: rate_missing — no price tier for claude-fable-5; those
#         messages priced at $0 and the session total is understated.
```

## The observed field set

Top-level keys, in the order the producer writes them:

`sessionId` · `cwd` · `startedAt` · `endedAt` · `messageCount` · `byModel` ·
`byTier` · `byBucket` · `total_cost_usd` · **`rate_missing`** ·
**`rate_missing_models`** · `totalRecordsSeen` · `dedupedRecordsCount` ·
`dedup_ratio` · `capturedAt`

On the observed row:

| field | observed value |
|---|---|
| `rate_missing` | `true` |
| `rate_missing_models` | `["claude-fable-5"]` |
| `byModel["claude-fable-5"]` | `tier: "unknown"`, 2,720 in / 353,138 out / 6,132,102 cache-write / 236,695,963 cache-read, 468 messages, `cost_usd: 0` |
| `byModel["<synthetic>"]` | `tier: "unknown"`, all token counts 0, 4 messages, `cost_usd: 0` |
| `byModel["claude-opus-5"]` | `tier: "opus"`, 56 messages, `cost_usd: 12.82` |
| `byTier` | `{haiku: 0, sonnet: 0, opus: 12.82, unknown: 0}` |
| `total_cost_usd` | `12.822884` |

Three properties of the shape, each of which the backfill design turns on:

1. **The token counts survive, per model.** This is what makes re-pricing a
   pure function of `byModel[m]` plus a rate table, with no transcript re-read.
   It is the property 2.4 was built to preserve, and it holds on a real row.
2. **A second `unknown`-tier model is present and correctly NOT flagged.**
   `<synthetic>` carries zero billable tokens, so it costs zero at any rate;
   flagging it would claim an understatement that is not there. The flag
   condition is `!PRICING[tier] && billableTokens > 0`, and the observed row is
   the case that distinguishes the two readings.
3. **`byTier.unknown` is 0, not the missing amount.** The unpriced cost is
   absent from every aggregate, not parked in a bucket — so a backfill adds to
   the target tier rather than moving a balance.

## What the row does NOT retain — two limits, measured not assumed

- **The cache-write TTL split is gone.** `track.mjs` prices `ephemeral_5m` and
  `ephemeral_1h` writes at 1.25x / 2x of input, but `byModel[m]` keeps one
  aggregated `cache_creation_input_tokens`. A backfill can only price all cache
  writes at the 5m rate — the same default the producer already applies to any
  unaccounted remainder. Recorded per repair as `cache_ttl_assumed: "5m"`.
- **The bucket split cannot be attributed.** `byBucket` carries per-bucket
  totals and `byModel` carries per-model totals, but nothing carries
  per-bucket-per-model tokens. On the observed row `byBucket.main.cost_usd` is
  `0` across 350 messages while `subagent` holds the whole priced 12.82 — so
  the recovered cost genuinely cannot be split. `byBucket` is therefore left as
  captured and the pass says so, rather than inventing a plausible ratio. Same
  honest-limit stance `cost-summary-schema` already takes for `by_date`.

Neither limit is a defect of the pass. Both are consequences of what the row
kept, and stating them is the difference between a repaired figure and a figure
that merely looks repaired.

## Scale of the understatement

Re-pricing the observed row at opus rates — **illustrative, not a claim about
what this model actually costs** — recovers **$496.55** against a row that
reported **$12.82**. The flagged model accounted for roughly 97 % of the
session's real spend and none of its reported spend.

That ratio is the argument for the whole `rate_missing` mechanism: the silent
zero 2.4 removed was not a rounding error, and a single unrecognised model id
can make a session's cost figure wrong by a factor of forty.

## What this unblocks

The backfill pass (`src/scripts/cost/backfill_rates.mjs`) is built against the
field set above: it reads `rate_missing_models`, re-prices from `byModel`,
moves the delta into `byTier` and `total_cost_usd`, clears the flag **only**
when nothing unpriced remains, and records `rate_backfill` provenance carrying
both limits. Its rate table is operator-supplied — the pass never guesses a
price for an id the producer did not recognise.
