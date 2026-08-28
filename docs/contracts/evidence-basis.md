# Evidence basis — what a number rests on

> Owner: maintainer · Status: active · Landed by `road-to-delivered-cost-truth`
> step 4.1 · Machine-readable source: `src/scripts/_lib/evidence_basis.ts`

## Why one vocabulary

Every number this suite reports rests on something, and the tree said what on at
least three incompatible partial scales:

| Module | Its private vocabulary |
|---|---|
| `_lib/orchestration_record.ts` | `measured` · `estimated` |
| `preamble_byte_census.ts` | `measured_local_file` · `residual` |
| `_lib/value_ladder.ts` | `measured` · `estimated` · `vendor-claim` · `pending` · `available` |

They overlap, they disagree on the name for one idea (`measured_local_file` and
`measured`), and none of them can express *a model judged this* — which several
surfaces in this tree do report.

## The six values

Each is defined by what evidence the value rests on, in one sentence.

| Value | What it rests on |
|---|---|
| `measured` | an instrument in this repository produced it from real input |
| `estimated` | derived by arithmetic from measured values, not itself observed |
| `inferred` | concluded from structure or convention, with no measurement behind it |
| `provider-reported` | a third party stated it and we recorded it unverified |
| `model-judged` | a language model's assessment, reproducible only in distribution |
| `unknown` | nothing establishes it, and that is the honest answer |

**`unknown` is a first-class value, not a failure code.** A surface that cannot
establish a basis says `unknown`; it does not pick the nearest optimistic one.

`EVIDENCE_BASIS_STRENGTH` orders them for **reporting only**. Two figures on
different bases do not become comparable by being ranked, and nothing in that
ordering should be read as licence to average them.

## What migrated, in the same change

Per step 4.1's verify — the old literals are **gone**, not aliased:

- **`_lib/orchestration_record.ts`** — `Provenance` is now
  `Extract<EvidenceBasis, 'measured' | 'estimated'>`. The wire values are
  unchanged; they are simply no longer declared privately. Narrowed to two
  rather than widened to six, because an orchestration record's floor is either
  read from the transcript ledger or arithmetic over it, and admitting
  `model-judged` there would widen a type to match a vocabulary rather than a
  fact.
- **`preamble_byte_census.ts`** — `measured_local_file` → `measured`,
  `residual` → `estimated`. Both were private spellings of shared ideas, and two
  names for one idea is how a vocabulary forks. The residual bucket is
  unchanged; its `name` still carries the word `residual`, which is what the
  test asserts on.

## What did NOT migrate, and why that is recorded rather than silent

**`_lib/value_ladder.ts`'s `confidence` field stays as it is.** Two reasons, and
the first is the load-bearing one:

1. **It is not a basis field.** It mixes two axes: `measured` / `estimated` /
   `vendor-claim` describe evidence, while `pending` and `available` describe
   *status* — whether a rung has been measured yet, and whether its delta counts
   toward the cumulative. Migrating it would mean splitting one field into two,
   which changes the value-report schema's shape.
2. **`vendor-claim` is a published schema value.** It appears in
   `docs/contracts/value-report-schema.md`, `docs/contracts/value-dashboard-spec.md`,
   `docs/value.md` and the rendered dashboard. Renaming it to
   `provider-reported` is a consumer-visible break.

The semantic mapping is `vendor-claim ≡ provider-reported`. Recording that here,
with the reason the rename did not happen, is the point: an unmigrated variant
that nobody wrote down is indistinguishable from one nobody noticed. It appears
in the parallel-form inventory
([`agents/evidence/analysis/parallel-forms-inventory.md`](../../agents/evidence/analysis/parallel-forms-inventory.md))
as a `variant`, which is where a future consolidation would start.

## What this contract does NOT claim

- **It does not grade confidence.** `measured` says an instrument produced the
  number, never that the instrument was right.
- **It does not make figures comparable.** The strength ordering is for reading,
  not for arithmetic.
- **It is not the epistemic-state vocabulary.** `_lib/subagent_capsule.ts`'s
  `verified` / `assumed` / `gap` describes the state of an *assumption* a worker
  inherits, not the basis of a *number*, and it is deliberately pinned to the
  Evidence-Report buckets. The two are different axes and neither is a partial
  version of the other.
- **It is not `evidence.strength`.** ADR frontmatter's `E0`–`E4` grades how much
  evidence a *decision record* rests on. Same word, different measurement.
