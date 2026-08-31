/**
 * Reviewer budget `k` and provider diversity — steps 8.2 and 8.3.
 *
 * Pure arithmetic over scripted member sets. No provider call, no network, no
 * corpus: every figure here is computed, not sampled.
 */
import { describe, expect, it } from 'vitest';

import {
    assignReviewers,
    costCurves,
    crossFamilyAvailable,
    diversityCeiling,
    interleaveByFamily,
    nonDiverseCandidates,
    reviewerLoads,
} from '../../../src/scripts/ai_council/reviewer_assignment.js';
import type { ReviewMember } from '../../../src/scripts/ai_council/reviewer_assignment.js';

const SEED = 'step-8.2-fixed-seed';

/** N members, each its own family — the engine's current invariant. */
function distinctFamilies(n: number): ReviewMember[] {
    return Array.from({ length: n }, (_, i) => ({ name: `m${String(i)}`, family: `fam${String(i)}` }));
}

/** N members over `f` families, round-robin — what Phase 9 fan-out would produce. */
function sharedFamilies(n: number, f: number): ReviewMember[] {
    return Array.from({ length: n }, (_, i) => ({ name: `m${String(i)}`, family: `fam${String(i % f)}` }));
}

/** The skew case: `a` of one family and `b` of another. */
function skewed(a: number, b: number): ReviewMember[] {
    return [
        ...Array.from({ length: a }, (_, i) => ({ name: `a${String(i)}`, family: 'A' })),
        ...Array.from({ length: b }, (_, i) => ({ name: `b${String(i)}`, family: 'B' })),
    ];
}

describe('8.2 — call count at N=8 measured against both curves', () => {
    it('the shipped path is N(N-1): 56 reviewed pairs at N=8', () => {
        // orchestrator.ts:1509-1560 gives every reviewer every OTHER member's
        // answer. That is the unconditional quadratic this step names.
        const c = costCurves(8, 7);
        expect(c.pairs_quadratic).toBe(56);
        expect(c.pairs_linear).toBe(56); // k = N-1 reproduces it exactly
        expect(c.ratio).toBe(1);
    });

    it('a budget k gives N×k, and the assignment realises exactly that count', () => {
        const table = [1, 2, 3, 4, 5, 6, 7].map((k) => {
            const r = assignReviewers(distinctFamilies(8), k, SEED);
            return { k, expected: 8 * k, actual: r.pairs, quadratic: 56 };
        });
        for (const row of table) expect(row.actual).toBe(row.expected);
        // The measured comparison this step asks for, at N=8:
        expect(table.map((r) => r.actual)).toEqual([8, 16, 24, 32, 40, 48, 56]);
        expect(table.map((r) => r.quadratic)).toEqual([56, 56, 56, 56, 56, 56, 56]);
        // k=3 is 24 of 56 — a 57% reduction against the unconditional curve.
        expect(costCurves(8, 3).ratio).toBeCloseTo(24 / 56, 10);
    });

    it('the gap widens with N, which is the whole reason for a budget', () => {
        expect(costCurves(4, 3).pairs_linear).toBe(costCurves(4, 3).pairs_quadratic); // k=N-1
        expect(costCurves(16, 3)).toMatchObject({ pairs_quadratic: 240, pairs_linear: 48 });
        expect(costCurves(32, 3)).toMatchObject({ pairs_quadratic: 992, pairs_linear: 96 });
    });

    it('k >= N-1 reproduces the shipped all-pairs behaviour exactly, for N=2..8', () => {
        for (let n = 2; n <= 8; n++) {
            const r = assignReviewers(distinctFamilies(n), n - 1, SEED);
            expect(r.pairs).toBe(n * (n - 1));
            // Every candidate sees every other member, i.e. the full set.
            for (const [name, reviewers] of r.assignment) {
                expect(new Set(reviewers).size).toBe(n - 1);
                expect(reviewers).not.toContain(name);
            }
        }
    });
});

describe('the assignment is balanced, self-review-free and deterministic', () => {
    it('every candidate is reviewed exactly k times and every reviewer reviews exactly k, N=2..8', () => {
        for (let n = 2; n <= 8; n++) {
            for (let k = 1; k <= n - 1; k++) {
                const r = assignReviewers(distinctFamilies(n), k, SEED);
                for (const reviewers of r.assignment.values()) expect(reviewers).toHaveLength(k);
                for (const load of reviewerLoads(r.assignment).values()) expect(load).toBe(k);
            }
        }
    });

    it('no member ever reviews itself', () => {
        for (let n = 2; n <= 8; n++) {
            for (let k = 1; k <= n - 1; k++) {
                for (const [name, reviewers] of assignReviewers(sharedFamilies(n, 3), k, SEED).assignment) {
                    expect(reviewers).not.toContain(name);
                }
            }
        }
    });

    it('the same seed replays and a different seed generally does not', () => {
        const a = assignReviewers(distinctFamilies(8), 3, SEED);
        const b = assignReviewers(distinctFamilies(8), 3, SEED);
        expect([...a.assignment.entries()]).toEqual([...b.assignment.entries()]);
        const c = assignReviewers(distinctFamilies(8), 3, 'a-different-seed');
        expect([...c.assignment.entries()]).not.toEqual([...a.assignment.entries()]);
    });

    it('k clamps to N-1 rather than producing a self-review or a duplicate', () => {
        const r = assignReviewers(distinctFamilies(4), 99, SEED);
        expect(r.effectiveK).toBe(3);
        expect(r.pairs).toBe(12);
    });

    it('a one-member council assigns nothing rather than throwing', () => {
        expect(assignReviewers(distinctFamilies(1), 3, SEED).pairs).toBe(0);
    });
});

describe('8.3 — no candidate is reviewed only by same-family reviewers when one was available', () => {
    it('attains the balance-feasible diversity ceiling for N=2..8 over 2, 3 and 4 families', () => {
        for (let n = 2; n <= 8; n++) {
            for (const f of [2, 3, 4]) {
                const members = sharedFamilies(n, f);
                for (let k = 1; k <= n - 1; k++) {
                    const r = assignReviewers(members, k, SEED);
                    const diverse = n - nonDiverseCandidates(r.assignment, members).length;
                    expect(diverse).toBe(diversityCeiling(members, k));
                }
            }
        }
    });

    it('attains it on the skew case an interleave alone does not fix (6 of A, 2 of B)', () => {
        const members = skewed(6, 2);
        for (let k = 1; k <= 7; k++) {
            const r = assignReviewers(members, k, SEED);
            const diverse = 8 - nonDiverseCandidates(r.assignment, members).length;
            expect(diverse).toBe(diversityCeiling(members, k));
            // The repair is a 2-swap, so balance survives it.
            for (const load of reviewerLoads(r.assignment).values()) expect(load).toBe(k);
            for (const reviewers of r.assignment.values()) expect(reviewers).toHaveLength(k);
        }
    });

    it('the ceiling is a real constraint, not a rubber stamp — 6A/2B at k=1 caps at 4', () => {
        // Eight candidates, two B members, each reviewing exactly one candidate:
        // at most two A candidates and two B candidates can be diverse. No
        // assignment avoids the other four, which is why 8.3 says "where
        // alternatives exist" rather than "always".
        expect(diversityCeiling(skewed(6, 2), 1)).toBe(4);
        expect(diversityCeiling(skewed(6, 2), 2)).toBe(6);
        expect(diversityCeiling(skewed(6, 2), 3)).toBe(8);
        // And with every member its own family the ceiling is everyone, at k=1.
        expect(diversityCeiling(distinctFamilies(8), 1)).toBe(8);
    });

    it('every candidate WITH a feasible cross-family reviewer actually gets one, at k >= 3 on 6A/2B', () => {
        const members = skewed(6, 2);
        const r = assignReviewers(members, 3, SEED);
        expect(nonDiverseCandidates(r.assignment, members)).toEqual([]);
        for (const m of members) expect(crossFamilyAvailable(m.name, members)).toBe(true);
    });

    it('a single-family council reports its candidates as unrepairable rather than silently passing', () => {
        const members = skewed(4, 0);
        const r = assignReviewers(members, 2, SEED);
        expect(r.unrepairable.sort()).toEqual(['a0', 'a1', 'a2', 'a3']);
        expect(diversityCeiling(members, 2)).toBe(0);
        // 8.3's own escape: no alternative existed, so the constraint is not violated.
        for (const m of members) expect(crossFamilyAvailable(m.name, members)).toBe(false);
    });

    it('is vacuous under the current one-advisor-per-provider invariant, and says so', () => {
        // chairman.ts:16-18 — each member IS one provider today, so every
        // reviewer is cross-family by construction and no repair can be needed.
        const r = assignReviewers(distinctFamilies(8), 3, SEED);
        expect(r.diversityRepairs).toBe(0);
        expect(r.unrepairable).toEqual([]);
    });
});

describe('DENIAL — the diversity detector fires on a real violation', () => {
    it('nonDiverseCandidates flags a hand-built all-same-family assignment', () => {
        const members = skewed(3, 1);
        const bad = new Map<string, string[]>([['a0', ['a1', 'a2']]]);
        expect(nonDiverseCandidates(bad, members)).toEqual(['a0']);
        // …and a cross-family reviewer WAS available, so this is a real 8.3 breach.
        expect(crossFamilyAvailable('a0', members)).toBe(true);
    });

    it('interleaveByFamily actually alternates when it can', () => {
        const order = interleaveByFamily(sharedFamilies(6, 2)).map((m) => m.family);
        for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
    });
});
