<!-- evidence-type: analysis -->

# The envelope DROP band does not trigger — its population says `non-local`

> `road-to-episode-finalizer-and-outcome-attribution-v2` Step 0.1 / blocker
> `b-envelope-drop-vs-unresolved`. Measured 2026-08-25.

## The contradiction as the blocker states it

Two shipped contracts appear to disagree about one number:

- **Phase 2.2's pre-registered band**: `DROP <= 1%`, so today's 0.00 % reading
  satisfies it arithmetically.
- **`claim:subagent-valid-envelope-rate`, falsification clause (1)**: a flat rate
  *"is reported as unresolved rather than as the pointer having failed"*, because
  a zero rate has at least three causes one number cannot separate.

The blocker is marked owner-reserved because **either resolution weakens a
pre-registered criterion**. A prior council attempt split.

## The band's own population line resolves it, and nobody had quoted it

```text
population >=200 non-local stops
PROVE >5%
DROP <=1%
INDETERMINATE 1..5%
```

**`non-local`.** The word is in the pre-registration, ahead of the thresholds.

And the roadmap defines it two steps later, at 2.3, in its own words:

> *"every envelope figure to date comes from **one gitignored machine-local
> ledger**, so no rate from it generalises (the claim says so itself)."*

## The measurement, and what it is a population of

Re-measured on the maintainer's machine, 2026-08-25:

```
valid_envelope_rate: 0.00% — 0 ok of 4912 stops,
  window 2026-08-13T21:19:46Z → 2026-08-24T14:43:18Z,
  read from agents/runtime/state/subagent-ledger/2026-08.jsonl
verdicts: no_envelope 4871 · fail 28 · foreign_object 13
```

Run in a clean drain worktree, the same command prints:

> `NO LEDGER at …/agents/runtime/state/subagent-ledger — the ledger is gitignored
> and machine-local, so this is expected in a fresh clone and **is not a
> measurement of zero**.`

**Every one of the 4,912 stops is machine-local.** The band requires **≥ 200
non-local** stops. The eligible population is therefore **zero**, not 4,912.

## The verdict: the band never applied, so neither contract yields

**The band is not triggerable on this sample** — not overridden, not amended, not
weakened. Its precondition is unmet by its own pre-registered wording. The
claim's falsification clause is likewise untouched: there is no DROP reading to
forbid.

This is what makes the blocker releasable without the weakening that made it
owner-reserved. **Both criteria stand exactly as written.**

It is also **not** post-hoc criterion revision, which is the objection this
conclusion has to survive: the word `non-local` was in the pre-registration
before any measurement, and this note quotes it rather than adding it.

## What the council contributed, and where it was superseded

Asked whether the machine-local finding *mooted* the contradiction, both seats
said **no** and corrected the framing: outcome, attribution and generalisation are
three separate judgments, and machine-local evidence limits external validity
without erasing a local observation. Their reconciliation was a **split
resolution** — the band classifies an *outcome*, the claim governs *causal
attribution*, so both hold: *"Local DROP; cause unresolved; cross-machine status
unconfirmed."*

One seat then set the condition that decided it:

> *"The decisive question is the original denominator definition … That original
> language should be quoted before owner sign-off. Without it, declaring the band
> 'not yet triggerable' risks post-hoc criterion revision."*

Quoting it settles the case in the direction that seat had explicitly left open:
the pre-registration **does** restrict the population, so the sample is
ineligible and there is no outcome to classify. The split resolution is recorded
as the answer that would govern **if** an eligible population existed, which is
the state Step 2.3 exists to produce.

## The 13 `foreign_object` rows — diagnostic, not causal

Classified rather than counted, per the council's list. All 13, without exception:

| field | value on all 13 |
|---|---|
| `envelope_field_hits` | **0** |
| `envelope_error_count` | **5** |
| `event` | `subagent_stop` |
| `depth` / `depth_basis` | `1` / `assumed-root` |
| `start_seen` | `true` |

Agent types: `general-purpose` 8, `Explore` 5. Window 2026-08-23 → 2026-08-24,
**3 distinct sessions**. Share: **13 of 4,912 = 0.26 %**.

**Zero envelope-field hits with an identical error count across all 13** is the
signature of a *consistently shaped different object*, not of a corrupted or
partial envelope. A worker emitting a malformed envelope would produce varying
field hits and varying error counts; these vary in neither.

So on the council's taxonomy this reads as **unrelated instrumentation output**
reaching the classifier — not worker emission, and specifically **not** evidence
for cause #2 (dominant path misidentified). At 0.26 % and with no variance, it
carries no weight for any of the three causes.

**Recorded as a lead, not a finding:** what produces them is not identified here.
The rows carry no producer field, and adding one is Step 0.2's territory.

## Cross-check that the ledger's other vocabulary is accounted for

`envelope_parse` over all 10,697 rows: `no_envelope` 4,871 · `absent` 4,543 ·
`null` 1,242 · `fail` 28 · `foreign_object` 13. The 4,543 `absent` rows are the
**retired vocabulary** the claim already excludes by name, and the exclusion
reproduces: 4,871 + 28 + 13 = 4,912, the stop count reported above.
