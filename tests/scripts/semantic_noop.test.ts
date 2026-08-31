// The semantic no-op gate — road-to-harness-promotion-bridge 7.4.
//
// The verify clause is "a paraphrase-only candidate is refused BEFORE the
// cascade", which has two halves: the refusal, and its position. The position
// half is checked by exercising the screen on candidates that carry no
// evaluation results at all and asserting the lifecycle never left `proposed` —
// a screen that needed a trial result could not have run before the cascade.
import { describe, expect, it } from 'vitest';

import { assertTransition } from '../../src/scripts/_lib/candidate_record.js';
import { NEAR_DUPLICATE_THRESHOLD } from '../../src/scripts/_lib/curator_ops.js';
import {
    MIN_MATERIAL_IMPROVEMENT_PERCENT,
    PARAPHRASE_OVERLAP_THRESHOLD,
    SemanticNoOpError,
    assertNotSemanticNoOp,
    isSemanticNoOp,
    screenSemanticNoOps,
} from '../../src/scripts/_lib/semantic_noop.js';

const BASELINE = [
    'Every request handler stays thin and delegates its business logic to a service or use case,',
    'because a handler that computes is a handler nobody can exercise without standing up the whole',
    'transport layer around it. Validation belongs at the request boundary, never inline in the body,',
    'and the service returns a value the handler renders rather than a response the service invented.',
].join(' ');

/**
 * The same rule, reworded — the shape 7.4 exists to catch.
 *
 * Artefact-sized on purpose. `shingleOverlap` uses 8-word shingles, so a single
 * substitution breaks eight shingles: on a one-sentence fixture that is already
 * a 45-point drop and no paraphrase could ever reach the 70 % threshold, while
 * on rule-body-sized text (~60 words, 56 shingles) it measures 85.7 %. The
 * detector is therefore meaningful for the corpus it will actually see and weak
 * for one-liners, which is a real bound and is stated rather than fixtured away.
 */
const PARAPHRASE = BASELINE.replace('nobody', 'no one');

/** A genuinely different rule, same size. */
const DIFFERENT = [
    'Index every foreign key and every column a query filters or orders on, and ship that index',
    'in the same migration that ships the query needing it. A migration is reversible or it is not',
    'a migration; expand and contract in two steps so a rollback never drops a column the previous',
    'release still writes to. Append-only tables declare their retention before they are created.',
].join(' ');

describe('7.4 — the no-op detector', () => {
    it('is pinned to the near-duplicate threshold rather than tuned separately', () => {
        expect(PARAPHRASE_OVERLAP_THRESHOLD).toBe(NEAR_DUPLICATE_THRESHOLD);
    });

    it('refuses a paraphrase and names the overlap it measured', () => {
        const v = isSemanticNoOp(BASELINE, PARAPHRASE, 40);
        expect(v.isNoOp).toBe(true);
        expect(v.reason).toContain('paraphrase-only');
        expect(v.overlapPercent).toBeGreaterThanOrEqual(PARAPHRASE_OVERLAP_THRESHOLD);
        // Even a large claimed delta does not rescue it: the text did not move.
        expect(isSemanticNoOp(BASELINE, PARAPHRASE, 99).isNoOp).toBe(true);
    });

    it('refuses a real rewrite whose measured effect is below the floor', () => {
        const v = isSemanticNoOp(BASELINE, DIFFERENT, MIN_MATERIAL_IMPROVEMENT_PERCENT - 0.5);
        expect(v.isNoOp).toBe(true);
        expect(v.reason).toContain('no material improvement');
        expect(v.overlapPercent).toBeLessThan(PARAPHRASE_OVERLAP_THRESHOLD);
    });

    it('the two gates are independent — neither implies the other', () => {
        // Rewrite + no effect → caught by gate 2 only.
        expect(isSemanticNoOp(BASELINE, DIFFERENT, 0).reason).toContain('no material improvement');
        // Paraphrase + large effect → caught by gate 1 only.
        expect(isSemanticNoOp(BASELINE, PARAPHRASE, 50).reason).toContain('paraphrase-only');
        // Both clear → admitted. The positive pole.
        expect(isSemanticNoOp(BASELINE, DIFFERENT, 12).isNoOp).toBe(false);
    });

    it('reports zero model calls, as a literal the type pins', () => {
        expect(isSemanticNoOp(BASELINE, DIFFERENT, 12).modelCalls).toBe(0);
        expect(screenSemanticNoOps([]).modelCalls).toBe(0);
    });

    it('assertNotSemanticNoOp throws with the candidate id in the message', () => {
        expect(() => assertNotSemanticNoOp('cand-x', isSemanticNoOp(BASELINE, PARAPHRASE, 40)))
            .toThrow(SemanticNoOpError);
        expect(() => assertNotSemanticNoOp('cand-x', isSemanticNoOp(BASELINE, PARAPHRASE, 40)))
            .toThrow(/cand-x/);
        expect(() => assertNotSemanticNoOp('cand-y', isSemanticNoOp(BASELINE, DIFFERENT, 12))).not.toThrow();
    });
});

describe('7.4 — the screen runs BEFORE the cascade', () => {
    it('refuses a paraphrase-only candidate with no evaluation results present', () => {
        // The inputs carry TEXT and a claimed delta and nothing else — no trials,
        // no sealed result, no lifecycle. A screen that could only decide after
        // the cascade would need one of those.
        const result = screenSemanticNoOps([
            { id: 'para', baselineText: BASELINE, candidateText: PARAPHRASE, deltaPercent: 40 },
            { id: 'real', baselineText: BASELINE, candidateText: DIFFERENT, deltaPercent: 12 },
            { id: 'flat', baselineText: BASELINE, candidateText: DIFFERENT, deltaPercent: 0 },
        ]);
        expect(result.admitted).toEqual(['real']);
        expect(result.refused.map((r) => r.id).sort()).toEqual(['flat', 'para']);
        expect(result.modelCalls).toBe(0);
    });

    it('the refused candidate never reaches the first cascade stage', () => {
        // `proposed -> diagnostic-evaluated` is the first stage. The screen sits
        // before it, so a refused candidate has no legal reason to have moved.
        const refused = screenSemanticNoOps([
            { id: 'para', baselineText: BASELINE, candidateText: PARAPHRASE, deltaPercent: 40 },
        ]);
        expect(refused.admitted).toEqual([]);
        // The transition itself is still legal for an ADMITTED candidate — without
        // this pole the assertion above would pass on a spine that refuses
        // everything.
        expect(() => assertTransition('proposed', 'diagnostic-evaluated')).not.toThrow();
    });
});
