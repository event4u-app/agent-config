/**
 * The activation ladder, its precedence receipt, and the unknown invariant.
 *
 * `road-to-governed-harness-evolution` Phase 1, steps 1.1 and 1.2.
 *
 * **E4 + E9 decided 2026-08-30, option B, AI council 2/2** (anthropic +
 * openai): SIX rungs, twelve cascade stages. The argument that carried it was
 * not "more is better" — it was that option A requires EDITING Phase 1's exit
 * criterion in order to fit, and that the distinction A drops is the one the
 * delivery experiment exists to measure. Two independent roadmaps arriving at
 * the same distinction (`road-to-experience-loop-broadening` Phase 5 needs five
 * activation/adherence states of its own) was the strongest evidence available.
 *
 * The cost asymmetry is a ratchet and it points the same way: an
 * under-populated rung can be collapsed later, while a distinction that was
 * never recorded cannot be added to historical data at all.
 *
 * **The openai seat attached a condition, and this module is it.** Before the
 * enums are persisted, every rung must map to a receipt field and an OBSERVABLE
 * PREDICATE, with an explicit `unknown`; see {@link LADDER}. Its `revisit-if`:
 * any rung lacking a distinct observable predicate, or staying `unknown` across
 * representative Phase 1 evaluations — in which case keep six rungs and
 * reconsider the nine-stage cascade independently.
 */

/**
 * The six rungs, in order. A run climbs them; the first one it fails to reach
 * is where the receipt points.
 *
 * `projected`, `delivered` and `visible` are three rungs and not one because
 * the shipping substrate already separates them:
 * `_lib/lean_projection_mode.ts:19` defines `eager-all | thin | delivery`, and
 * under `thin`/`delivery` an artefact can be projected without being visible in
 * a given turn. The 4-rung form collapses all three into `injected`.
 */
export const LADDER_RUNGS = [
    'eligible',
    'selected',
    'projected',
    'delivered',
    'visible',
    'adhered',
] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

/**
 * The receipt-bearing cascade stage that reads each rung, in ladder order.
 *
 * Derived from {@link LADDER_RUNGS} rather than written out, so a rung cannot
 * exist without its stage and the two orders cannot drift. Named here rather
 * than in the cascade because the RUNGS are this module's, and a second module
 * spelling `receipt-<rung>` would be a second source of truth for the same
 * enum.
 *
 * The cascade consumes these; nothing here imports the cascade. That direction
 * is the one `docs/contracts/activation-receipt-trust-boundary.md` TB-1 fixes.
 */
export const RECEIPT_STAGES = LADDER_RUNGS.map((r) => `receipt-${r}` as const);
export type ReceiptStage = (typeof RECEIPT_STAGES)[number];

/** The rung a receipt-bearing stage reads. Total over {@link ReceiptStage}. */
export function rungForReceiptStage(stage: ReceiptStage): LadderRung {
    return stage.slice('receipt-'.length) as LadderRung;
}

/**
 * Which failure family a stall at each rung belongs to.
 *
 * This is what step 1.1's exit criterion asks for: a deliberately failing
 * trigger eval must be classifiable as CONTENT vs ACTIVATION vs ADHERENCE from
 * the recorded receipt alone.
 */
export type FailureFamily = 'content' | 'activation' | 'adherence' | 'unknown';

/** One rung's contract: what it means, what observes it, and what it decides. */
export interface RungSpec {
    readonly rung: LadderRung;
    /** The receipt field whose value decides this rung. */
    readonly observedBy: string;
    /** How the value is read — the observable predicate the council required. */
    readonly predicate: string;
    /** The family a stall AT this rung belongs to. */
    readonly family: Exclude<FailureFamily, 'unknown'>;
}

/**
 * The evidence matrix — rung → receipt field → predicate → family.
 *
 * Required by the E4+E9 verdict before the enum is persisted. Its purpose is to
 * make "false precision" checkable: a rung whose predicate cannot be evaluated
 * from a receipt is a rung that will read `unknown` forever, which is the
 * council's own stated revisit condition.
 */
export const LADDER: readonly RungSpec[] = [
    {
        rung: 'eligible',
        observedBy: 'eligible',
        predicate: 'the artefact matched the request at all — its triggers, packs and workspaces admit it',
        family: 'content',
    },
    {
        rung: 'selected',
        observedBy: 'selected',
        predicate: 'the router chose it over competing artefacts at the same trigger',
        family: 'activation',
    },
    {
        rung: 'projected',
        observedBy: 'projected',
        predicate: 'a host tree carries the artefact — the projection wrote a file for this host',
        family: 'activation',
    },
    {
        rung: 'delivered',
        observedBy: 'delivered',
        predicate: 'the host loaded it for this turn under the active lean_projection_mode',
        family: 'activation',
    },
    {
        rung: 'visible',
        observedBy: 'visible',
        predicate: 'it survived the turn\'s context budget rather than being trimmed',
        family: 'activation',
    },
    {
        rung: 'adhered',
        observedBy: 'adhered',
        predicate: 'the reply shows the obligation was followed, not merely present',
        family: 'adherence',
    },
];

/**
 * Why a rung was not reached.
 *
 * This replaces a flat `rule/skill/hook/router/host/model` attribution, which
 * names a CATEGORY and not a PLACE — you cannot fix "router" and you can fix
 * "lost to a higher-priority rule".
 */
export const PRECEDENCE_REASONS = [
    'lost-to-higher-priority-rule',
    'host-restriction',
    'pack-filter',
    'missing-projection',
    'context-budget',
    'contradictory-instruction',
] as const;
export type PrecedenceReason = (typeof PRECEDENCE_REASONS)[number];

/**
 * A rung's observed state.
 *
 * `'unknown'` is a first-class value and NOT a default that means no: step
 * 1.2's soundness invariant is that a state which was not observed stays
 * unknown and is never silently converted to success. Without it every
 * downstream rate is inflated by exactly the capture gap.
 */
export type RungState = 'reached' | 'not-reached' | 'unknown';

export interface ActivationReceipt {
    readonly artefact: string;
    /** A rung ABSENT from this map is `unknown` — see {@link rungState}. */
    readonly rungs: Readonly<Partial<Record<LadderRung, RungState>>>;
    /** Why the first not-reached rung was not reached. */
    readonly reason?: PrecedenceReason;
}

/**
 * A rung's state, with absence read as `unknown`.
 *
 * ABSENT and `not-reached` are different observations and this is where that is
 * enforced. The audit-log contract already draws the same line for
 * `skills_applied` (`docs/contracts/audit-log-v1.md:88`): the key omitted means
 * *not recorded*, `[]` means *recorded, and none*. A reader that folds the two
 * cannot tell no signal from a negative signal.
 */
export function rungState(receipt: ActivationReceipt, rung: LadderRung): RungState {
    return receipt.rungs[rung] ?? 'unknown';
}

/**
 * Which family a receipt's failure belongs to — step 1.1's exit criterion.
 *
 * Walks the ladder in order and returns the family of the FIRST rung that was
 * not reached. A rung whose state is `unknown` short-circuits to `'unknown'`
 * rather than being skipped: skipping it would silently attribute the failure
 * to a later rung the run may never have reached, which is the same inflation
 * step 1.2 forbids, wearing a different shape.
 *
 * Every rung reached → `'adherence'` is NOT returned; the receipt did not fail,
 * and the caller gets `null`.
 */
export function classifyFailure(receipt: ActivationReceipt): FailureFamily | null {
    return firstStall(receipt)?.family ?? null;
}

/** Where a receipt stopped climbing, and the family that stall belongs to. */
export interface LadderStall {
    /** The rung the walk stopped at. */
    readonly rung: LadderRung;
    /** The receipt-bearing cascade stage that reads {@link rung}. */
    readonly stage: ReceiptStage;
    /** `unknown` when the rung was never observed; the rung's family otherwise. */
    readonly family: FailureFamily;
}

/**
 * The first rung a receipt did not reach, with its stage and its family.
 *
 * {@link classifyFailure} is a projection of this, and delegates to it rather
 * than walking the ladder a second time. Two walks of the same ladder applying
 * the same short-circuit rule is two places to change it — and the cascade needs
 * the STAGE as well as the family, which is the only reason this exists
 * separately at all.
 */
export function firstStall(receipt: ActivationReceipt): LadderStall | null {
    for (const [i, spec] of LADDER.entries()) {
        const state = rungState(receipt, spec.rung);
        const stage = RECEIPT_STAGES[i] as ReceiptStage;
        if (state === 'unknown') return { rung: spec.rung, stage, family: 'unknown' };
        if (state === 'not-reached') return { rung: spec.rung, stage, family: spec.family };
    }
    return null;
}

/** A rate with its `unknown` bucket kept OUT of the denominator. */
export interface LadderRate {
    readonly reached: number;
    readonly notReached: number;
    readonly unknown: number;
    /** `reached / (reached + notReached)`, or `null` when that is zero. */
    readonly rate: number | null;
}

/**
 * Aggregate one rung across receipts.
 *
 * The invariant step 1.2 exists for: **no aggregation folds `unknown` into a
 * success denominator.** `unknown` is reported beside the rate, never inside
 * it, and a population that is entirely `unknown` yields `rate: null` rather
 * than `0` — zero is a measurement, and there was none.
 */
export function ladderRate(receipts: readonly ActivationReceipt[], rung: LadderRung): LadderRate {
    let reached = 0;
    let notReached = 0;
    let unknown = 0;
    for (const r of receipts) {
        const s = rungState(r, rung);
        if (s === 'reached') reached += 1;
        else if (s === 'not-reached') notReached += 1;
        else unknown += 1;
    }
    const denominator = reached + notReached;
    return { reached, notReached, unknown, rate: denominator === 0 ? null : reached / denominator };
}
