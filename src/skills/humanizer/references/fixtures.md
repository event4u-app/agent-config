# Humanizer worked fixtures

> On-demand fixtures for the [`humanizer`](../SKILL.md) skill — the
> behavioral cases the U2 (style/stance separation) and U5 (six-signal
> voice-match) verify clauses reference
> (road-to-ecosystem-harvest-prose-authenticity, Source I).

## Fixture 1 — stance survives the style pass (U2)

A humanize pass lowers the AI signal; it must **not** soften a refusal or a
disagreement into agreement. Input takes a firm negative position with two
Tier-High tells (sycophancy + chat artifact + significance inflation):

**Before (AI-toned refusal):**

> Great question! Unfortunately, I'm not able to merge this to `main` right
> now — doing so would mark a pivotal moment that bypasses the review gate.
> Let me know if you'd like me to walk through the alternatives!

**After (humanized — tells gone, refusal intact):**

> I can't merge this to `main` — it would skip the review gate. The
> alternatives are to open a PR for review or to get an explicit override
> from a maintainer.

The rewrite removed the flattery, the chat artifact, and the significance
inflation, and **kept the "no"**. A rewrite that turned this into "I could
probably merge this if you'd like!" would have corrupted the stance — a
defect, not a humanize. Same rule for hedged-because-genuinely-uncertain
claims: uncertainty the author actually holds stays.

## Fixture 2 — two voice samples, measurably different targets (U5)

The six-signal extraction produces distinct targets for distinct samples —
matching moves the draft toward the sample's values, never toward a generic
"human" vibe.

**Sample A — terse operator:**

> Deploy failed. Rolled back. Root cause: the migration locked the orders
> table for 40s. Fix lands tomorrow.

| Signal | Sample A target |
|---|---|
| Sentence-length rhythm | very short, uniform (4–8 words) |
| Vocabulary register | plain / operational |
| Punctuation habits | periods only; no dashes, no parentheticals |
| Hedging density | zero |
| Structural cadence | clipped declaratives, no lists |
| Idiom | incident-log shorthand ("root cause:", "lands") |

**Sample B — discursive essayist:**

> What struck me, reading the migration post-mortem again, was how ordinary
> the failure looked in advance — a lock we'd all seen a hundred times, on a
> table nobody thought of as hot until, suddenly, it was.

| Signal | Sample B target |
|---|---|
| Sentence-length rhythm | long, winding; one sentence per idea |
| Vocabulary register | reflective / literary |
| Punctuation habits | em dashes + nested clauses (fingerprint allows dashes) |
| Hedging density | moderate ("looked", "thought of as") |
| Structural cadence | single flowing paragraph |
| Idiom | narrative asides ("What struck me…") |

The two targets diverge on every axis — a draft matched to A is not a draft
matched to B. Sample B is also a case where the dash-density default is
**suppressed**: the fingerprint genuinely writes in dashes, so the fingerprint
wins (SKILL § voice precedence).
