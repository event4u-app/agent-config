/**
 * The lifecycle AFTER promotion — `road-to-harness-promotion-bridge` steps 7.6
 * and 7.7.
 *
 * ## 7.6 — a promoted artefact is not immortal
 *
 * > *post-promotion re-evaluation with `KEEP / REVISE / MERGE / SPLIT / RETIRE`.
 * > The master's promotion phase ends at the evidence package plus a cooldown,
 * > so nothing reopens a promoted artefact and the lifecycle is manual-only at
 * > exactly the point where growth accumulates.*
 * > verify: **a promoted artefact reaching its review trigger produces one of
 * > the five verdicts, and at least one `RETIRE` path is exercised in a
 * > fixture.**
 *
 * Two halves were already in the tree and one was missing. Four of the five
 * verdicts are E6 curator ops (`_lib/curator_ops.ts`) — `REVISE` is not — and
 * `promoted -> retired` is already the one legal retirement edge
 * (`_lib/candidate_record.ts:210-219`). What did not exist was the REVIEW
 * TRIGGER: nothing decided that a promoted artefact was due, and nothing turned
 * that into a verdict. {@link reviewPromoted} is that.
 *
 * **The verdict set is NOT a subset of `CURATOR_OPS`, and finding that out is
 * part of what this step buys.** E6 argued for seven curator ops on the ground
 * that 7.6 specifies five verdicts a four-op curator could not execute — and the
 * shipped seven still cannot execute one of them, because `REVISE` is not among
 * them. The relationship is pinned by a test in both directions rather than
 * papered over with a mapping nobody chose; see {@link POST_PROMOTION_VERDICTS}.
 *
 * ## 7.7 — best-known-state reference on regression
 *
 * > *Roll back to the recorded best-known state; lineage, not endless append.*
 * > verify: **an injected regression triggers the rollback path in a fixture.**
 *
 * {@link BestKnownState} is the record, {@link planRollback} is the decision.
 * "Lineage, not endless append" is carried in the type: a rollback names the
 * state it returns to and the state it leaves, so the history is a chain rather
 * than a pile of snapshots nobody can order.
 *
 * ## This module promotes nothing
 *
 * It reads promoted artefacts and it can RETIRE one — the only transition it
 * expresses is `promoted -> retired`, which `assertTransition` accepts without
 * an approver because retirement is the direction that shrinks the estate.
 * There is no path here that moves anything INTO `promoted`; that stays behind
 * `_lib/promotion_capability.ts`, and `lint_promotion_paths.ts` is what proves
 * this file did not grow one.
 */
import { ACCEPTED_STATE, type LifecycleState, assertTransition } from './candidate_record.js';
import { CURATOR_OPS, type CuratorOp } from './curator_ops.js';

/**
 * The five verdicts step 7.6 names, verbatim.
 *
 * **Four of the five are E6 curator ops. `REVISE` is not, and that is a finding
 * rather than a detail.** `_lib/curator_ops.ts:48-56` is `KEEP · ADD · MERGE ·
 * REPLACE · SPLIT · RETIRE · SKIP`, and its own header argues for seven ops on
 * the ground that *"step 7.6 of the same roadmap already specifies the verdict
 * set KEEP / REVISE / MERGE / SPLIT / RETIRE, so a four-op curator would emit
 * verdicts it cannot execute"*. Measured against the shipped set: `REVISE` is
 * still a verdict the curator cannot execute — `REPLACE` is the nearest op and
 * it is not the same thing, since `REPLACE` is 1→1 with a new artefact while
 * `REVISE` edits the one in place and keeps its identity.
 *
 * The list is therefore written out rather than derived, because deriving it
 * would require inventing the mapping the two sets do not have. What IS pinned,
 * by `tests/scripts/promotion_review.test.ts`, is the relationship in both
 * directions: the four shared verdicts really are curator ops, and `REVISE`
 * really is not — so a later change that adds `REVISE` to `CURATOR_OPS`, or
 * drops one of the four, fails a test instead of drifting.
 */
export const POST_PROMOTION_VERDICTS = ['KEEP', 'REVISE', 'MERGE', 'SPLIT', 'RETIRE'] as const;

/** The four verdicts the curator can actually execute today. */
export const VERDICTS_EXECUTABLE_BY_CURATOR: readonly CuratorOp[] = CURATOR_OPS.filter(
    (op) => (POST_PROMOTION_VERDICTS as readonly string[]).includes(op),
);

export type PostPromotionVerdict = (typeof POST_PROMOTION_VERDICTS)[number];

/** Why a promoted artefact came up for review. Absent means it is not due. */
export const REVIEW_TRIGGERS = [
    'regression',
    'usage-floor',
    'duplicate-detected',
    'scope-overgrown',
    'age',
] as const;
export type ReviewTrigger = (typeof REVIEW_TRIGGERS)[number];

/** What a review reads. Every field is an observation, not a judgement. */
export interface PromotedArtefactState {
    readonly id: string;
    readonly lifecycle: LifecycleState;
    /** Measured effect now, in the same units as the promotion evidence's delta. */
    readonly currentDeltaPercent: number;
    /** The delta recorded at promotion. The regression test is `current < promoted`. */
    readonly promotedDeltaPercent: number;
    /** How many times the artefact was actually reached since promotion. */
    readonly invocations: number;
    /** Ids of promoted artefacts whose text this one now duplicates. */
    readonly duplicates: readonly string[];
    /** Distinct responsibilities the artefact has accumulated. */
    readonly responsibilities: number;
    readonly daysSincePromotion: number;
}

export class NotPromotedError extends Error {
    constructor(id: string, lifecycle: LifecycleState) {
        super(
            `'${id}' is '${lifecycle}', not '${ACCEPTED_STATE}' — post-promotion review acts on a ` +
                'PROMOTED artefact. A candidate that never landed is rejected, not retired, and ' +
                'reviewing one here would report a lifecycle event that did not happen.',
        );
        this.name = 'NotPromotedError';
    }
}

export interface ReviewOutcome {
    readonly id: string;
    readonly trigger: ReviewTrigger;
    readonly verdict: PostPromotionVerdict;
    readonly reason: string;
}

/** The floors the review reads. Stated defaults; each carries its own revisit-if. */
export const REVIEW_THRESHOLDS = {
    /** Below this many invocations the artefact is not earning its place. `revisit-if` a
     *  legitimately rare artefact is retired for being rare. */
    usageFloor: 1,
    /** Distinct responsibilities above which the artefact should be SPLIT. `revisit-if` a
     *  cohesive artefact with several facets is split for having them. */
    responsibilityCeiling: 2,
    /** Days after which an unreviewed artefact is due. `revisit-if` the cadence is noise. */
    ageDays: 180,
} as const;

/**
 * Is this artefact due for review, and why? `null` means not due.
 *
 * Order is precedence: a regression outranks a usage question, which outranks a
 * duplicate, which outranks overgrowth, which outranks mere age. Without a fixed
 * order two triggers firing at once would make the verdict depend on evaluation
 * order, which is how a review becomes irreproducible.
 */
export function reviewTriggerFor(state: PromotedArtefactState): ReviewTrigger | null {
    if (state.currentDeltaPercent < state.promotedDeltaPercent) return 'regression';
    if (state.invocations < REVIEW_THRESHOLDS.usageFloor) return 'usage-floor';
    if (state.duplicates.length > 0) return 'duplicate-detected';
    if (state.responsibilities > REVIEW_THRESHOLDS.responsibilityCeiling) return 'scope-overgrown';
    if (state.daysSincePromotion >= REVIEW_THRESHOLDS.ageDays) return 'age';
    return null;
}

/**
 * Produce exactly ONE of the five verdicts for a promoted artefact that reached
 * its review trigger.
 *
 * @throws {NotPromotedError} when the artefact is not promoted.
 */
export function reviewPromoted(state: PromotedArtefactState, trigger: ReviewTrigger): ReviewOutcome {
    if (state.lifecycle !== ACCEPTED_STATE) {
        throw new NotPromotedError(state.id, state.lifecycle);
    }
    const outcome = (verdict: PostPromotionVerdict, reason: string): ReviewOutcome => ({
        id: state.id,
        trigger,
        verdict,
        reason,
    });
    switch (trigger) {
        case 'regression':
            // A measured effect that fell BELOW zero is not worth revising; it is
            // now costing what it was promoted to save.
            return state.currentDeltaPercent <= 0
                ? outcome('RETIRE', `effect fell to ${String(state.currentDeltaPercent)} pp — it no longer earns its place`)
                : outcome(
                      'REVISE',
                      `effect fell ${String(state.promotedDeltaPercent)} -> ${String(state.currentDeltaPercent)} pp ` +
                          'but is still positive',
                  );
        case 'usage-floor':
            return outcome('RETIRE', `reached ${String(state.invocations)} time(s) since promotion`);
        case 'duplicate-detected':
            return outcome('MERGE', `now duplicates ${state.duplicates.join(', ')}`);
        case 'scope-overgrown':
            return outcome('SPLIT', `carries ${String(state.responsibilities)} distinct responsibilities`);
        case 'age':
            return outcome('KEEP', `${String(state.daysSincePromotion)} days since promotion, effect held`);
    }
}

/**
 * Execute the RETIRE verdict.
 *
 * Routes through `assertTransition`, so the ONE legal retirement edge is the one
 * this takes and a caller cannot retire something that never landed. Returns the
 * next lifecycle state rather than writing anything — nothing in this module
 * touches the filesystem.
 *
 * @throws {LifecycleTransitionError} from `assertTransition`.
 */
export function retirePromoted(state: PromotedArtefactState): LifecycleState {
    assertTransition(state.lifecycle, 'retired');
    return 'retired';
}

// --- 7.7 — best-known state and rollback ------------------------------------

/** A recorded good state, and the state it came from. Lineage, not endless append. */
export interface BestKnownState {
    readonly artefactId: string;
    /** The revision or bundle identifier this state is recoverable from. */
    readonly reference: string;
    readonly deltaPercent: number;
    /** The best-known state this one replaced. `null` only for the first. */
    readonly supersedes: string | null;
    readonly recordedAt: string;
}

export interface RollbackPlan {
    readonly artefactId: string;
    readonly from: string;
    readonly to: string;
    readonly reason: string;
    /** Oldest first. The chain that makes this a lineage rather than a pile. */
    readonly lineage: readonly string[];
}

export class NoBestKnownStateError extends Error {
    constructor(artefactId: string) {
        super(
            `'${artefactId}' regressed and has no recorded best-known state to return to. A rollback ` +
                'target is recorded at promotion time, not reconstructed after the regression — by ' +
                'then the state that worked is exactly what is missing.',
        );
        this.name = 'NoBestKnownStateError';
    }
}

/**
 * Walk the `supersedes` chain, oldest first.
 *
 * Cycle-guarded: a chain that points at itself is a corrupted lineage, and
 * following it forever would hang the caller rather than report the corruption.
 */
export function lineageOf(head: BestKnownState, all: readonly BestKnownState[]): string[] {
    const byRef = new Map(all.map((s) => [s.reference, s]));
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor: BestKnownState | undefined = head;
    while (cursor !== undefined && !seen.has(cursor.reference)) {
        seen.add(cursor.reference);
        chain.push(cursor.reference);
        cursor = cursor.supersedes === null ? undefined : byRef.get(cursor.supersedes);
    }
    return chain.reverse();
}

/**
 * Plan a rollback when the current state regressed against the best known one.
 *
 * `null` when there is no regression — the caller does not have to know the
 * comparison, and a rollback that fires on an improvement is worse than none.
 *
 * @throws {NoBestKnownStateError} when a regression has nowhere to return to.
 */
export function planRollback(
    artefactId: string,
    currentReference: string,
    currentDeltaPercent: number,
    history: readonly BestKnownState[],
): RollbackPlan | null {
    const mine = history.filter((s) => s.artefactId === artefactId);
    const best = mine.reduce<BestKnownState | null>(
        (acc, s) => (acc === null || s.deltaPercent > acc.deltaPercent ? s : acc),
        null,
    );
    if (best === null) {
        if (currentDeltaPercent < 0) throw new NoBestKnownStateError(artefactId);
        return null;
    }
    if (currentDeltaPercent >= best.deltaPercent) {
        return null;
    }
    return {
        artefactId,
        from: currentReference,
        to: best.reference,
        reason:
            `regressed ${String(best.deltaPercent)} -> ${String(currentDeltaPercent)} pp against the ` +
            `best-known state '${best.reference}'`,
        lineage: lineageOf(best, mine),
    };
}
