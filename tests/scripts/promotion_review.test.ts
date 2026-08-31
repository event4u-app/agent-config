// The lifecycle after promotion — road-to-harness-promotion-bridge 7.6 and 7.7.
//
// 7.6's verify clause has two conjuncts and they are checked separately: a
// promoted artefact reaching its review trigger produces ONE OF THE FIVE
// verdicts (checked over every trigger, not over one), and at least one RETIRE
// path is exercised in a fixture (checked all the way to the lifecycle
// transition, not just to the verdict string).
import { describe, expect, it } from 'vitest';

import {
    ACCEPTED_STATE,
    LIFECYCLE_SPINE,
    LifecycleTransitionError,
} from '../../src/scripts/_lib/candidate_record.js';
import { CURATOR_OPS } from '../../src/scripts/_lib/curator_ops.js';
import {
    type BestKnownState,
    NoBestKnownStateError,
    NotPromotedError,
    POST_PROMOTION_VERDICTS,
    type PromotedArtefactState,
    REVIEW_THRESHOLDS,
    REVIEW_TRIGGERS,
    VERDICTS_EXECUTABLE_BY_CURATOR,
    lineageOf,
    planRollback,
    retirePromoted,
    reviewPromoted,
    reviewTriggerFor,
} from '../../src/scripts/_lib/promotion_review.js';

/** A healthy promoted artefact. Every test mutates a copy. */
function promoted(over: Partial<PromotedArtefactState> = {}): PromotedArtefactState {
    return {
        id: 'art-alpha',
        lifecycle: ACCEPTED_STATE,
        currentDeltaPercent: 8,
        promotedDeltaPercent: 8,
        invocations: 40,
        duplicates: [],
        responsibilities: 1,
        daysSincePromotion: 10,
        ...over,
    };
}

// --- § 7.6 — the verdict set ------------------------------------------------

describe('7.6 — the verdict set and its relationship to the curator ops', () => {
    it('is exactly the five the step names', () => {
        expect([...POST_PROMOTION_VERDICTS]).toEqual(['KEEP', 'REVISE', 'MERGE', 'SPLIT', 'RETIRE']);
    });

    it('four are curator ops and REVISE is not — pinned in BOTH directions', () => {
        // E6's argument for seven ops cites this very verdict set. Measured: the
        // shipped seven still cannot execute REVISE. A later change that adds it,
        // or drops one of the four, fails here instead of drifting.
        expect([...VERDICTS_EXECUTABLE_BY_CURATOR].sort()).toEqual(['KEEP', 'MERGE', 'RETIRE', 'SPLIT']);
        expect(CURATOR_OPS).not.toContain('REVISE');
        for (const v of VERDICTS_EXECUTABLE_BY_CURATOR) {
            expect(CURATOR_OPS).toContain(v);
        }
    });
});

// --- § 7.6 — the review trigger and its verdict ------------------------------

describe('7.6 — a promoted artefact reaching its review trigger produces one verdict', () => {
    it('a healthy artefact is not due', () => {
        expect(reviewTriggerFor(promoted())).toBeNull();
    });

    it('every trigger is reachable, and each yields exactly one of the five', () => {
        const cases: Array<[string, PromotedArtefactState]> = [
            ['regression', promoted({ currentDeltaPercent: 3 })],
            ['usage-floor', promoted({ invocations: 0 })],
            ['duplicate-detected', promoted({ duplicates: ['art-beta'] })],
            ['scope-overgrown', promoted({ responsibilities: REVIEW_THRESHOLDS.responsibilityCeiling + 1 })],
            ['age', promoted({ daysSincePromotion: REVIEW_THRESHOLDS.ageDays })],
        ];
        // Every declared trigger has a case — so adding one to REVIEW_TRIGGERS
        // without a path here fails rather than passing untested.
        expect(cases.map(([t]) => t).sort()).toEqual([...REVIEW_TRIGGERS].sort());
        for (const [expectedTrigger, state] of cases) {
            const trigger = reviewTriggerFor(state);
            expect(trigger, `state did not fire ${expectedTrigger}`).toBe(expectedTrigger);
            const outcome = reviewPromoted(state, trigger!);
            expect(POST_PROMOTION_VERDICTS, `${expectedTrigger} produced ${outcome.verdict}`)
                .toContain(outcome.verdict);
            expect(outcome.reason.length).toBeGreaterThan(0);
            expect(outcome.id).toBe(state.id);
        }
    });

    it('the trigger order is fixed, so two conditions at once are reproducible', () => {
        const both = promoted({ currentDeltaPercent: 1, invocations: 0 });
        expect(reviewTriggerFor(both)).toBe('regression');
    });

    it('a regression that ate the whole effect RETIREs; one that did not REVISEs', () => {
        expect(reviewPromoted(promoted({ currentDeltaPercent: 0 }), 'regression').verdict).toBe('RETIRE');
        expect(reviewPromoted(promoted({ currentDeltaPercent: 3 }), 'regression').verdict).toBe('REVISE');
    });

    it('refuses to review anything that is not promoted', () => {
        for (const state of LIFECYCLE_SPINE) {
            if (state === ACCEPTED_STATE) continue;
            expect(() => reviewPromoted(promoted({ lifecycle: state }), 'age')).toThrow(NotPromotedError);
        }
    });
});

// --- § 7.6 — the RETIRE path, exercised ---------------------------------------

describe('7.6 — at least one RETIRE path is exercised', () => {
    it('runs review -> RETIRE -> the lifecycle transition, end to end', () => {
        const state = promoted({ invocations: 0 });
        const trigger = reviewTriggerFor(state);
        expect(trigger).toBe('usage-floor');
        const outcome = reviewPromoted(state, trigger!);
        expect(outcome.verdict).toBe('RETIRE');
        // The verdict is not the exercise — the transition is. This is the half
        // AC-9 is about: a PROMOTED artefact retiring, not a candidate.
        expect(retirePromoted(state)).toBe('retired');
    });

    it('a candidate that never landed cannot take the retirement edge', () => {
        // The direction AC-9's audit note names: `curator_ops`' RETIRE acts on a
        // record whose lifecycle is a literal 'candidate', so it retires a
        // candidate and never a promoted artefact.
        expect(() => retirePromoted(promoted({ lifecycle: 'proposed' }))).toThrow(LifecycleTransitionError);
        expect(() => retirePromoted(promoted({ lifecycle: 'sealed-evaluated' }))).toThrow(/only a promoted candidate/);
    });
});

// --- § 7.7 — best-known state and rollback -----------------------------------

describe('7.7 — an injected regression triggers the rollback path', () => {
    const history: BestKnownState[] = [
        { artefactId: 'art-alpha', reference: 'rev-1', deltaPercent: 4, supersedes: null, recordedAt: '2026-01-01' },
        { artefactId: 'art-alpha', reference: 'rev-2', deltaPercent: 9, supersedes: 'rev-1', recordedAt: '2026-02-01' },
        { artefactId: 'art-beta', reference: 'other', deltaPercent: 99, supersedes: null, recordedAt: '2026-02-01' },
    ];

    it('an injected regression returns a plan naming the best-known state', () => {
        const plan = planRollback('art-alpha', 'rev-3', 2, history);
        expect(plan).not.toBeNull();
        expect(plan!.to).toBe('rev-2');
        expect(plan!.from).toBe('rev-3');
        expect(plan!.reason).toContain('regressed');
    });

    it('carries the lineage, oldest first — not an unordered pile', () => {
        expect(planRollback('art-alpha', 'rev-3', 2, history)!.lineage).toEqual(['rev-1', 'rev-2']);
    });

    it('does NOT fire when the current state is at least as good', () => {
        // The pole that keeps the rule from being "always roll back".
        expect(planRollback('art-alpha', 'rev-3', 9, history)).toBeNull();
        expect(planRollback('art-alpha', 'rev-3', 15, history)).toBeNull();
    });

    it('reads only this artefact\'s history', () => {
        // `other` has a delta of 99 and belongs to a different artefact; a plan
        // that pointed at it would roll back to someone else's state.
        expect(planRollback('art-alpha', 'rev-3', 2, history)!.to).toBe('rev-2');
    });

    it('a regression with no recorded state is an error, not a silent no-op', () => {
        expect(() => planRollback('art-gamma', 'rev-x', -5, history)).toThrow(NoBestKnownStateError);
        // Not-yet-regressed and unrecorded is not an error — nothing to return to
        // and nothing asking to.
        expect(planRollback('art-gamma', 'rev-x', 3, history)).toBeNull();
    });

    it('lineageOf is cycle-guarded', () => {
        const cyclic: BestKnownState[] = [
            { artefactId: 'a', reference: 'x', deltaPercent: 1, supersedes: 'y', recordedAt: '' },
            { artefactId: 'a', reference: 'y', deltaPercent: 1, supersedes: 'x', recordedAt: '' },
        ];
        expect(lineageOf(cyclic[0]!, cyclic)).toEqual(['y', 'x']);
    });
});
