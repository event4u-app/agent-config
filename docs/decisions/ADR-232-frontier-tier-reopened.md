---
adr: 232
status: accepted
date: 2026-08-15
decision: frontier-tier-reopened
supersedes: —
superseded_by: —
amends: ADR-035
phase: road-to-inbox-harvest-2026-08-d-top-band-model-economy
type: structural
review_trigger: >-
  Reopen if the fourth family disappears from the vendor line-up, if a fifth
  band appears that four tiers cannot express, or if the measured share of
  frontier-band dispatches stays at zero across a full review window — the last
  would mean the band was named for a capability nobody uses, which is the
  sparse-mapping objection ADR-035 raised and this record accepted as
  conditional rather than refuted
---

# ADR-232 — The `frontier` tier, reopened on ADR-035's own condition

## Status

Accepted. **Amends ADR-035 § Decision 1; does not supersede it.** Every other
decision in ADR-035 stands unchanged — in particular § Decision 3, which gives
the generator exclusive ownership of the tier→model mapping, is the mechanism
this amendment relies on rather than an obstacle to it.

## Context

ADR-035 § Decision 1 rejected a fourth `frontier` tier with a stated reason: it
"would map sparsely (one vendor's outlier) and break vendor-neutrality". That
was a judgement about the vendor landscape at the time, and the ADR did not
treat it as permanent. It shipped its own reopen condition:

> Also reopen if a vendor ships a band the three tiers cannot express without a
> fourth, which is the frontier tier this ADR rejected as too sparse to map.

That condition is now satisfiable **from the tree**, not from an impression:

- `src/scripts/hooks/orchestration_record_hook.ts:158` enumerates
  `MODEL_FAMILIES` as `['haiku', 'sonnet', 'opus', 'fable']` — **four** families.
- `src/scripts/_lib/model_tier.ts:28-32` maps **three** —
  `high→opus`, `medium→sonnet`, `lite→haiku`.

The telemetry layer has been able to *name* the fourth family since it shipped;
the tier layer — the vocabulary in which every `model_tier:` declaration, every
`inherit` resolution and the judge ladder are written — has no name for it.
The two constants sit in two files and disagree.

The measurement is published at
`agents/evidence/analysis/same-band-spawn-distribution.md`. Over the full
313-record dispatch corpus, 40 records carried a reported model:

| Family | Dispatches |
|---|---:|
| `opus` | 35 |
| `fable` | **2** |
| `haiku` | 2 |
| `sonnet` | 1 |

Two facts follow. The fourth band is **reachable and used**, so it is not
hypothetical. And almost every dispatch that reported a model ran at or above
the top mapped tier, which is where the cost concern that opened this track
came from.

The consequences of the gap are structural rather than cosmetic:

- `inherit` resolves to the session model
  (`src/agent-src/contexts/model-recommendations.md:16`), so under a
  fourth-band session every undeclared slice inherits it silently.
- The judge ladder saturates: *"If the session runs on opus, judge stays on
  opus (no higher tier available)"*
  (`src/agent-src/contexts/subagent-configuration.md:24-25`). With a band above
  the top mapping, "one tier above" has no defined meaning.
- `subagents.model_ceiling` is **uncapped when absent**, so nothing bounds this
  by default.

## Decision

1. **A fourth capability band, `frontier`, is added to the tier vocabulary.**
   The name is deliberately the one ADR-035 used for the band it rejected, so
   the amendment is legible as a reversal of a specific, named decision rather
   than as a new invention.

2. **The band is a capability descriptor, exactly like the other three.** It
   means "reasoning capability above the strongest generally-recommended band" —
   not a use-case, not a vendor, not a price tier.

3. **Resolution stays generator-owned, per ADR-035 § Decision 3, unchanged.**
   `TIER_TO_CLAUDE_MODEL` in `src/scripts/_lib/model_tier.ts` gains exactly one
   row. No `.md` gains a vendor model name it did not already carry, and no
   per-vendor runtime table is created — the two-clocks failure ADR-035 warned
   about is avoided by not adding a second mapping, not by refusing the band.

4. **Declaring `frontier` is opt-in and expected to stay rare.** No existing
   artefact is migrated to it. The band exists so that work which genuinely
   needs it can *say so* — which makes the cost visible instead of inherited.

## Consequences

- Three frontmatter schemas (`skill`, `command`, `subagent`) accept a fourth
  enum value. The change is additive; every existing declaration stays valid.
- `inherit` under a `frontier` session becomes expressible as a bounded
  resolution rather than an unbounded one. Committing that bound is the
  follow-on work, not this record.
- The judge ladder's saturation case gains a defined top. This record does not
  decide what the judge does there; it makes the question answerable.
- **The sparse-mapping objection is accepted, not refuted.** One vendor is
  known to ship this band today. Other agents resolve the tier name to their
  own line-up or ignore it, which is the same suggestion-only contract the
  other three bands already carry for non-Claude hosts. The `review_trigger`
  above makes a persistently-unused band a reason to remove it again.

## Alternatives considered

- **Leave ADR-035 closed.** Defensible on n=2, and it was on the table as an
  explicit option. Rejected because the asymmetry is not a preference but a
  measurable inconsistency between two shipped constants, and because leaving
  it means `inherit` keeps resolving to an unnamed top band by default.
- **Remove `fable` from `MODEL_FAMILIES` instead**, resolving the asymmetry
  downward so both vocabularies agree on three. Rejected: the telemetry would
  then be unable to name a family that demonstrably runs, which trades a
  vocabulary gap for a measurement gap — the worse of the two.
- **A price/cost tier rather than a capability tier.** Rejected as a category
  error; ADR-035 § Decision 1's "capability descriptors, not use-case names"
  applies with equal force to cost names.

## References

- `docs/decisions/ADR-035-model-capability-tiers.md` — the amended record and
  the reopen condition this one invokes.
- `agents/evidence/analysis/same-band-spawn-distribution.md` — the measurement.
- `src/scripts/_lib/model_tier.ts` — the single generator-owned mapping.
- `src/scripts/hooks/orchestration_record_hook.ts:158` — `MODEL_FAMILIES`, the
  four-family constant that surfaced the asymmetry.
- `agents/roadmaps/archive/road-to-inbox-harvest-2026-08-d-top-band-model-economy.md` —
  the track this record unblocks.
