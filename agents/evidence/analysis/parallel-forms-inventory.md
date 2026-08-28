<!-- evidence-type: analysis -->
# Parallel-form inventory — duplicates and genuine variants

> `road-to-delivered-cost-truth` step 4.3 · 2026-08-28 · **Changes no code.**
> Every entry carries a `file:line` anchor and is labelled `duplicate` or
> `variant` with a one-line reason.

## Why an inventory and not a refactor

The tree carries several near-identical shapes for task contracts, artefact
references and decision ledgers. An inventory that names duplicates invites
consolidating them, and consolidation is a large behavioural change that would
be riding on a documentation step — which is the roadmap's own Risk 5. So this
file **states what is there**. Merging anything is a separate decision with its
own blast radius and its own file.

The distinction being drawn:

- **`duplicate`** — two implementations of one idea that could be one, and whose
  divergence would be a defect rather than a design.
- **`variant`** — two shapes that look alike and encode genuinely different
  things, where merging them would lose a distinction.

## Evidence vocabularies

| Shape | Anchor | Label | Reason |
|---|---|---|---|
| `Provenance` | `src/scripts/_lib/orchestration_record.ts:27` | **duplicate — resolved** | Was a private `'measured' \| 'estimated'`; migrated onto `EvidenceBasis` in this change. |
| `ByteCensusSource.provenance` | `src/scripts/preamble_byte_census.ts:255` | **duplicate — resolved** | `measured_local_file` / `residual` were private spellings of `measured` / `estimated`; migrated in this change. |
| `confidence` | `src/scripts/_lib/value_ladder.ts:195` | **variant** | Mixes two axes — evidence (`measured`/`estimated`/`vendor-claim`) and status (`pending`/`available`). Migrating means splitting one field into two and renaming a published schema value. `vendor-claim ≡ provider-reported`. |
| `EPISTEMIC_STATES` | `src/scripts/_lib/subagent_capsule.ts:43` | **variant** | `verified`/`assumed`/`gap` is the state of an ASSUMPTION a worker inherits, not the basis of a number. Deliberately pinned to the Evidence-Report buckets. |
| `evidence.strength` | `src/scripts/_lib/adr_frontmatter.ts` (`E0`–`E4`) | **variant** | Grades how much evidence a DECISION RECORD rests on. Same word, different measurement. |

## Loss and delivery classifications

| Shape | Anchor | Label | Reason |
|---|---|---|---|
| `LOSS_CLASSES` | `src/scripts/_lib/loss_class.ts:32` | **variant** | Classifies what a TRANSFORM guarantees about recovery. Orthogonal to evidence basis: a `measured` number can arrive through an `ephemeral-lossy` transform. |
| `DELIVERY_CRITICALITY` | `src/scripts/_lib/delivery_criticality.ts:23` | **variant** | Classifies what happens to an OBLIGATION when its carrier is missing. Neither a basis nor a loss class. |

## Token measurement

| Shape | Anchor | Label | Reason |
|---|---|---|---|
| `classify_size` proxy margin | `src/scripts/lint_token_budget_discipline.ts:66` | **duplicate** | `PROXY_ERROR_MARGIN = 0.06` is declared twice — here and at `src/scripts/_lib/asset_delivery_ledger.ts:30` — for one measured property of one proxy. Two copies of one measurement is the shape that drifts; consolidating is a one-line move and is deliberately NOT done here, because this step changes no code. |
| `gpt_tokens` / `gpt_tokens_proxy` | `src/scripts/_lib/token_count.ts:117` | **variant** | Exact and proxy are different measurements with different error properties, and the pair is the point. |

## Report shapes

| Shape | Anchor | Label | Reason |
|---|---|---|---|
| `{ unavailable: <reason> }` | `src/scripts/_lib/benchmark_cache_fields.ts:19` | **variant, and worth spreading** | The same shape now appears in the cache block, the provenance block, `computePrefixStability`'s `insufficient-data`, and `config_cost`'s `unknown_profile`. Four surfaces reached the same answer independently — a stated reason instead of a fabricated number. Naming it a shared type is a candidate, not a duplicate to remove. |

## What this inventory does NOT do

- **It does not consolidate anything.** Not one line of code changed for it.
- **It does not claim completeness.** It covers the shapes this roadmap's work
  passed through. A shape nobody touched is not listed, and its absence is not
  evidence it does not exist.
