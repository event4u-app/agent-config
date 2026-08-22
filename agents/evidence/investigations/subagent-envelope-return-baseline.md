<!-- evidence-type: analysis -->
<!-- analyzed: 2026-08-22 | commit: eb1e0b866 | files: 1 -->

# The envelope-return column, measured — 0 of 1,296

This publishes the **fourth column** of `road-to-subagent-lifecycle-integrity`
Phase 1 Step 4, the one that step deliberately left unpublished on 2026-08-20
because the data would have measured the answer format rather than envelope
return. The four-way `classifyEnvelope` split landed in that same change and made
the column measurable *forward from it*. Enough post-split data now exists.

## Window, and why it starts where it does

**2026-08-21T01:23:41Z → 2026-08-22T03:01:39Z** (~25.6 h), **10 sessions**,
**74 starts / 1,296 stops**.

The start is the timestamp of the **first `no_envelope` record in the ledger** —
not the split's commit date, and not a chosen round number. That distinction is
load-bearing and it cost one wrong reading before it was caught:

| Day | `absent` | `no_envelope` | `fail` |
|---|---|---|---|
| 2026-08-13 … 08-20 | 92 … 1,893 | — | 3, 2, 4, 5, 1, —, 6, — |
| **2026-08-21** | 154 | **1,150** | 5 |
| **2026-08-22** | — | **141** | — |

A first pass anchored the window on the earliest record carrying *any* post-split
value and got 2026-08-13 → 1,317 stops across 23 sessions. That was wrong in a
way worth recording: **`fail` predates the split.** It existed in the retired
classifier, so those 26 rows are old-classifier output, and folding them in
inflates both the denominator and the parse-failure count. Anchoring on
`no_envelope` — a value only the new classifier can emit — is the correct cutoff.
The 154 `absent` rows on 08-21 are pre-deploy records from the same day and the
same anchor excludes them.

The ledger is gitignored and machine-local, so the numbers travel and the file
does not. Reproduce with:

```
python3 - <<'PY'
import json
from collections import Counter
rows=[json.loads(l) for l in open('agents/runtime/state/subagent-ledger/2026-08.jsonl') if l.strip()]
stops=[r for r in rows if r.get('event')=='subagent_stop' and r.get('ts')]
first=min(r['ts'] for r in stops if r.get('envelope_parse')=='no_envelope')
post=[r for r in stops if r['ts']>=first]
print(Counter(str(r.get('envelope_parse')) for r in post))
PY
```

## The four columns, now complete

| Column | Value | Denominator |
|---|---|---|
| **envelope return rate** | **0.00 %** — 0 `ok` | 1,296 stops |
| parse-failure rate | **0.39 %** — 5 `fail` | 1,296 stops |
| duration distribution | p50 **655 s** · p90 **1,212 s** · max **2,179 s** (36.3 min) | **64** stops (4.9 %) that carry one |
| nested-spawn count | **0** | 74 starts |

## The 0 % is a real measurement, not the artefact the step feared

Withholding the column was the right call and this is why. Under the retired
classifier a rate off it read 0 % because `absent` collapsed "nothing came back"
with "prose came back", and prose is what nearly every subagent returns. The split
separates them, and that separation is what makes this number mean something:

- **`no_message` = 0 (0.00 %).** Something came back **every single time** — not
  one silent return in 1,296.
- **`no_envelope` = 1,291 (99.61 %).** What came back was prose, every time.
- **`ok` = 0.** Not one structured envelope.

So the finding is neither "the channel is unmeasurable" nor "returns are going
missing". It is that the return channel **works and is universally unused**: the
envelope contract is honoured 0 times out of 1,296 while the prose channel is
honoured 1,296 times out of 1,296.

That replaces the 0.27 % model-carried capture figure this step was written to
retire, and it replaces it with a harder number pointing the same way.

## Two subordinate findings

**All 5 parse failures carry `envelope_error_count: 5`.** Identical to the
2026-08-20 window, where all 17 did. Two independent windows agreeing on the same
error count reads as **one recurring answer shape** rather than independent
malformations — the earlier window's reading holds at a second n.

**`stop_loss_arms_exceeded` fired on 46 of 1,296 (3.55 %).** Consistent with the
4.1 % measured on 2026-08-20 (138 of 3,400). Phase 3 Step 3's shadow is guarding
something real, at a rate that has now reproduced across two windows.

## Limits, stated

- **~25.6 h, 10 sessions, one machine.** The ≥20-dispatch bar is cleared by 74
  starts, and the stop count by three orders of magnitude — but this is one
  operator's ledger and the sessions are not independent of one another.
- **The duration row describes 4.9 % of the population.** A duration needs a
  matched start and 1,232 stops have none, so it is stated with its own
  denominator rather than presented as the distribution.
- **The pre-split window stays unresolvable by filtering**, exactly as the
  pre-`session_id` window does. Nothing here recovers those 4,543 `absent` rows.
- `no_message = 0` is a statement about **this** window. It does not prove a
  silent return is impossible.
