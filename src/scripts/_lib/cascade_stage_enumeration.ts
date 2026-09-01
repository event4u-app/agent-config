/**
 * The twelve-stage evaluation cascade, DERIVED rather than enumerated by hand.
 *
 * `road-to-governed-evidence-production` step 1.2. E9 (2026-08-30) decided the
 * ARITY — twelve — and enumerated the stages nowhere. The 2026-08-31 council
 * round that was asked for the enumeration returned `REVISE`, and the reason it
 * gave is the reason this module exists rather than a constant list: running the
 * same seat twice produced two materially different twelves — different names,
 * different order, a different placement of the statistical stage.
 *
 * **So the enumeration is not proposed. It is computed.** Two committed arrays
 * and one stated ordering rule determine it, and re-running the computation over
 * the same tree cannot yield a different answer. Nobody's judgement is in the
 * output, which is what "settled" has to mean after two judgements disagreed.
 *
 * ## The ordering rule
 *
 * Stages are ordered by the EVIDENCE each one needs — the `CascadeInput` field
 * it reads — and within a class by source order. The classes, cheapest evidence
 * first:
 *
 * | Rank | Class | Evidence it needs | `CascadeInput` field |
 * |---|---|---|---|
 * | 0 | `record`      | the candidate record alone           | `raw` |
 * | 1 | `plan`        | the run plan and the budget ceiling  | `plan`, `budget` |
 * | 2 | `peers`       | the sibling candidates of this run   | `peers` |
 * | 3 | `receipt`     | an activation receipt                | `receipt` |
 * | 4 | `measurement` | measured trials                      | `rows`, `vector` |
 *
 * The rule is not a preference. It is the cascade's own cheapest-first,
 * abort-on-first-failure discipline restated over evidence rather than over
 * cost: a stage may not run before the evidence it depends on could exist, and a
 * candidate that fails a cheap-evidence stage must never consume the expensive
 * evidence. `docs/contracts/activation-receipt-trust-boundary.md` EC-2 is the
 * receipt row of exactly this table.
 *
 * ## What is NOT decided here
 *
 * The rung SEMANTICS — what `delivered` means, what observes it — belong to
 * `_lib/activation_ladder.ts`, and the `REVISE` verdict's condition on them was
 * discharged by the trust-boundary and evidence-cost contract, not by this file.
 * This module settles the enumeration and its order, and nothing else.
 */

import { CASCADE_STAGES, type StageId } from './evaluation_cascade.js';
import { RECEIPT_STAGES } from './activation_ladder.js';

/** What evidence a stage needs. The ordering key. */
export const EVIDENCE_CLASSES = ['record', 'plan', 'peers', 'receipt', 'measurement'] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/**
 * The evidence class of each DETERMINISTIC prefix stage.
 *
 * Written out because it is a fact about `runCascade`'s body — which
 * `CascadeInput` field each stage reads — and a fact about code cannot be
 * derived from a list of names. It is not unchecked: the companion test asserts
 * this order against the order in which `runCascade` first touches each input
 * field, so a stage that starts reading a different field reds here rather than
 * quietly reordering the enumeration.
 */
export const PREFIX_EVIDENCE_CLASS: Readonly<Record<string, EvidenceClass>> = {
    'schema-validity': 'record',
    'path-ownership': 'record',
    'holdout-disclosure': 'record',
    budget: 'plan',
    'near-duplicate': 'peers',
    'metric-verdict': 'measurement',
};

/** The evidence class of any stage. Receipt stages are uniformly `receipt`. */
export function evidenceClass(stage: StageId): EvidenceClass {
    if ((RECEIPT_STAGES as readonly string[]).includes(stage)) return 'receipt';
    const c = PREFIX_EVIDENCE_CLASS[stage];
    if (c === undefined) throw new Error(`no evidence class declared for stage '${stage}'`);
    return c;
}

/**
 * The committed twelve, in order.
 *
 * Route A of step 1.2's reproduction: the two committed arrays, sorted by
 * evidence class, stable within a class. `Array.prototype.sort` is specified as
 * stable since ES2019, which is what makes "within a class, source order" a
 * property of the language rather than of an implementation.
 */
export const TWELVE_STAGES: readonly StageId[] = [...CASCADE_STAGES, ...RECEIPT_STAGES].sort(
    (a, b) => EVIDENCE_CLASSES.indexOf(evidenceClass(a)) - EVIDENCE_CLASSES.indexOf(evidenceClass(b)),
);

/** The arity E9 decided. Stated so a drift from twelve is a named failure. */
export const DECIDED_ARITY = 12;
