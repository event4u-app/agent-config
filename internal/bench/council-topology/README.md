# council-topology — what does a topology actually buy?

> Scope: `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 2.
> Frozen spec + expander: `src/scripts/ai_council/topology_bench_manifest.ts`.
> Family pre-registration: [`PREREG-families.md`](PREREG-families.md).
> Reporting bar: [`../council-topology-promotion-stats-PREREG.md`](../council-topology-promotion-stats-PREREG.md).

## Status — MANIFEST FROZEN · RUNNER NOT BUILT · NOTHING RUN

**No arm has executed and no quota has been spent.** Every cell in
`call-manifest.json` reads `pending`, which is deliberately not a completable
status. The AI council of 2026-08-31 was explicit on both seats: **do not
greenlight the runner yet.** This directory carries the zero-call work that had
to exist first.

NOT RUN is not a null. A null is what a measurement returns; this is the state
before one. The distinction is enforced in the type layer and at module load
rather than asserted in prose — see *The completion invariant* below.

## Why this carrier exists at all

The council answered the carrier question **(a): a new directory**, unanimously.
The two candidates were rejected on the same shape of argument:

- **`adversarial-council/`** owns an adversarial-review corpus. Hosting topology
  evidence there would couple a conclusion about *topology* to one particular
  corpus, so a result would never be separable from the material it ran on.
- **`council-blind-review/`** owns a blinded human-rating workflow that is
  explicitly deferred for part of this benchmark. Hosting execution there would
  couple every arm to a grading mechanism that has no grader.

Those are evaluation *inputs*. They are not appropriate owners of the
experiment that consumes them.

## What this carrier owns

| | |
|---|---|
| The pre-registered family list and per-family success criteria | [`PREREG-families.md`](PREREG-families.md) |
| The frozen arm spec and its provider-call graph | `topology_bench_manifest.ts` |
| The fully enumerated cell manifest | `call-manifest.json` (generated) |
| Immutable UTC-day batches under the per-provider cap | `day_batches` in the same file |
| The Phase-2 completion invariant | `PHASE2_COMPLETE_STATUSES` + `phase2Complete` |

## What this carrier deliberately does NOT own

- **A second provider client.** There is exactly one, in `ai_council/clients.ts`,
  and this benchmark will call through it. Nothing here imports a transport.
- **A second quota interpretation.** The ceiling is
  `DEFAULT_CLI_CALLS_PER_DAY = 50` (`ai_council/cli_call_budget.ts:60`), read
  per provider. This directory mirrors that constant; it does not redefine it.
- **Anonymisation or parsing.** `consensus.anonymize_responses`,
  `blind_review.build_blind_labels` and the findings parser already exist and
  are the ones the runner will use.
- **The reporting bar.** Step 2.6 is already pre-registered in
  `../council-topology-promotion-stats-PREREG.md`. This carrier does not
  restate, extend, or contradict it.
- **The runner.** Not built, by instruction.

## The call graph, and why it had to be written down

The roadmap defines experimental *dimensions*. It never defined the
provider-call graph, and the council's Q2 verdict turned on exactly that: an
experimental cell is not a provider call. Host-solo may spend nothing; a full
debate is multi-call; retries add calls; and `50/provider/UTC-day` is two
separate ceilings, never one pool of 100.

Every pass below is one `consult()` per participating member, which is one
provider call per member. The citation is the code, not an estimate:

| Pass | Call site | Participants |
|---|---|---|
| generation | `orchestrator.ts:394` | all members, once per round |
| peer critique | `orchestrator.ts:1553` | all members |
| findings extraction | `consensus_round.ts:107` | all members |
| bounded re-ask | `consensus_round.ts:141` | at most **one** per member, per extraction pass |
| consensus scoring | `consensus_round.ts:191` | all members |
| prose synthesis | chairman only | one member; the templated default path spends nothing (`prompts.ts:512-518`) |

Multi-round debate multiplies the generation pass by `rounds`
(`orchestrator.ts:160-161`, `:246` — "across every billable member × rounds").

The bounded re-ask is the **entire** retry reserve, and it is booked up front
rather than spent opportunistically: a retry that discovers the ceiling has
already crossed it.

## Overlap, stated rather than implied

The council required an explicit statement of whether the five baselines, five
ablations, two axes and round arms overlap, with no implicit reuse. They
overlap in exactly **two** places:

- `axis-ms1-dual` reuses `baseline-default-council` — identical configuration.
- `rounds-1` reuses `baseline-default-council` — identical configuration.

Everything else re-runs. In particular the ablation ladder does **not** borrow
the default-council baseline's generation output for its `generation only`
rung, though the two look interchangeable: an attribution claim needs all five
rungs produced under identical conditions, and a rung borrowed from a baseline
executed on a different UTC day would carry day-as-confounder into the one arm
whose whole purpose is attribution.

A reusing arm books zero calls and must be scheduled into the same day batch as
its source, so the shared observation cannot acquire a day-as-confounder either.

## The totals — the number that did not exist before

Reproduce with `./scripts-run src/scripts/ai_council/topology_bench_manifest`.

| | anthropic | openai | total |
|---|---|---|---|
| Minimum calls | 814 | 770 | **1,584** |
| Worst case (full retry reserve) | 924 | 880 | **1,804** |

- **384 cells** — 352 eligible, 32 belonging to the deferred family.
- **48 cells** carry a declared reuse and book nothing.
- **20 UTC days** at 50 calls/provider/day, from the generated partition. The
  arithmetic floor is `ceil(924 / 50) = 19`; the twentieth day is packing
  fragmentation, because a cell is atomic and never spans a day boundary.

Those totals assume **one item per family** and **two trials per item**. Both
are declared in the spec rather than derived, because the roadmap fixes neither
— and the day count is linear in their product. At three items per family the
schedule is roughly 60 UTC days.

## The finding this arithmetic produces

**Phase 2 as designed consumes both providers' entire daily quota for about
twenty consecutive UTC days**, during which no other council work — 1B, 3.3, a
`/council` run, an analysis pass — can proceed on those days.

That is reported, not acted on. Reducing the twelve families, deleting the
ablation ladder, or treating unexecuted arms as nulls would weaken criteria
2.1 and 2.4, and both council seats refused to approve any of them: those
dispositions are **owner-reserved**. The manifest exists so the owner can make
that decision against a number instead of an intuition. The available levers,
in the order that costs the least evidence, are: fewer trials per item (the
schedule is linear in trials, and N=2 is already the floor), a narrower model
set axis, or accepting the calendar cost.

## The completion invariant

Phase 2 is complete only when **every eligible cell** carries `success`,
`declared_gap`, or an **observed** pre-registered null. `pending` is not in
that set and cannot be put there quietly:

- **Type layer.** `PendingIsNotComplete` fails the typecheck. Sabotage-verified:
  adding `'pending'` to `PHASE2_COMPLETE_STATUSES` produced
  `topology_bench_manifest.ts(100,36): error TS2344: Type 'false' does not
  satisfy the constraint 'true'.` and `npm run typecheck` exit 2.
- **Runtime layer.** `auditCompletionStatuses()` throws at module load, so the
  claim survives into `dist/` where types are erased. The same sabotage made
  the test file fail to collect.

The family arity is guarded the same way in both layers. Sabotage-verified:
changing `BENCH_FAMILY_ARITY` to 11 produced `error TS2367` (typecheck exit 2)
and `council topology manifest: expected exactly 11 pre-registered families,
found 12` (vitest exit 1). Restoring returned both to exit 0.

This is the two-layer pattern step 7.1 established for the topology vocabulary
(`topology_vocabulary.ts:119-175`), reused rather than reinvented.

## What Phase 2 cannot produce, by construction

At **N=2** this benchmark publishes raw values and min–max ranges. It does not
publish a bootstrap interval, does not describe a two-observation range as
inferential, and licenses **no promotion claim**.

That is not a weakening of step 2.6 — it is the consequence of reading 2.6's
own pre-registered floors honestly. Those floors are `n >= 5` for deterministic
metrics and `n >= 10` for rubric-judged ones, and N=2 clears neither. So the
manifested Phase 2 satisfies 2.4's attribution requirement and 2.5's two-axis
requirement and produces **descriptive comparison only**. A promotion decision
needs a later, larger run, and the schedule for that run scales linearly from
the totals above.

## To run it — the preconditions, not an invitation

1. An owner decision on the twenty-day schedule (or on a lever that shortens it).
2. A runner, which does not exist and was explicitly not greenlit.
3. Kill switches the council named and this carrier does not yet implement:
   projected cap breach; actual calls exceeding a cell's frozen maximum;
   manifest or prompt drift; provider or model substitution; parse-failure rate
   crossing a pre-registered threshold; retry-reserve exhaustion; missing ledger
   durability or a duplicate cell execution; UTC rollover inside a batch.
4. A resumable ledger that verifies manifest hash, model identity, prompt hash
   and prior call ids before continuing.

Items 3 and 4 are recorded here as the runner's contract so that building the
runner cannot quietly omit them.

## Regenerating the manifest

```bash
./scripts-run src/scripts/ai_council/topology_bench_manifest --emit
```

`call-manifest.json` is generated and must never be hand-edited: editing a call
count there without editing the spec would let the schedule drift from the
mechanics it claims to model, which is the exact failure the manifest exists to
prevent.
