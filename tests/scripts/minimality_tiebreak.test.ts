/**
 * Tests for the minimality tie-break
 * (`src/scripts/_lib/minimality_tiebreak.ts`,
 * road-to-governed-harness-evolution step 4.5, decision E5).
 *
 * Two things are pinned here that a reader cannot get from the code alone.
 * First, the ARITY: E5 rejected a fifth criterion, so a test that only checked
 * the four present ones would stay green the day a fifth was added. Second,
 * that the ORDER is load-bearing — the same pair of candidates resolves to
 * different winners under the inverted order, which is why the order needed a
 * council decision rather than a style preference.
 */
import { describe, expect, it } from 'vitest';

import {
    breakTie,
    MINIMALITY_ORDER,
    MinimalityMetadataError,
    orderByMinimality,
    PRECEDENCE_ORDER,
    SCOPE_ORDER,
    type MinimalityCriterion,
    type MinimalityMetadata,
} from '../../src/scripts/_lib/minimality_tiebreak.js';

/** A candidate that ties on everything, so each test varies exactly one field. */
function candidate(id: string, over: Partial<MinimalityMetadata> = {}): MinimalityMetadata {
    return {
        candidate_id: id,
        tokens: 100,
        artifacts: 2,
        scope: 'module',
        precedence: 'auto',
        ...over,
    };
}

describe('4.5 — the committed order is E5, and its arity is four', () => {
    it('is exactly `tokens -> artifacts -> scope -> precedence`', () => {
        expect([...MINIMALITY_ORDER]).toEqual(['tokens', 'artifacts', 'scope', 'precedence']);
    });

    it('has FOUR criteria — the fifth ("simpler mechanism") is OUT per E5', () => {
        expect(MINIMALITY_ORDER).toHaveLength(4);
        expect(MINIMALITY_ORDER as readonly string[]).not.toContain('mechanism');
        expect(MINIMALITY_ORDER as readonly string[]).not.toContain('simplicity');
    });

    it('scope and precedence rank narrowest / least-binding first', () => {
        expect([...SCOPE_ORDER]).toEqual(['single-artifact', 'module', 'pack', 'repo']);
        expect([...PRECEDENCE_ORDER]).toEqual(['advisory', 'auto', 'always', 'kernel']);
    });
});

describe('4.5 — each criterion decides in turn', () => {
    it('tokens decide first', () => {
        const r = breakTie(candidate('lean', { tokens: 40 }), candidate('fat', { tokens: 400 }));
        expect(r.winner).toBe('lean');
        expect(r.decided_by).toBe('tokens');
    });

    it('artifacts decide when tokens tie', () => {
        const r = breakTie(candidate('one', { artifacts: 1 }), candidate('three', { artifacts: 3 }));
        expect(r.winner).toBe('one');
        expect(r.decided_by).toBe('artifacts');
    });

    it('scope decides when tokens and artifacts tie', () => {
        const r = breakTie(
            candidate('narrow', { scope: 'single-artifact' }),
            candidate('wide', { scope: 'repo' }),
        );
        expect(r.winner).toBe('narrow');
        expect(r.decided_by).toBe('scope');
    });

    it('precedence decides last', () => {
        const r = breakTie(
            candidate('advisory', { precedence: 'advisory' }),
            candidate('kernel', { precedence: 'kernel' }),
        );
        expect(r.winner).toBe('advisory');
        expect(r.decided_by).toBe('precedence');
    });

    it('an all-four tie escalates rather than inventing a winner', () => {
        const r = breakTie(candidate('a'), candidate('b'));
        expect(r.winner).toBeNull();
        expect(r.decided_by).toBeNull();
        expect(r.reason).toContain('escalates');
    });

    it('REFUSES an unknown scope or precedence instead of ranking it last', () => {
        const bad = { ...candidate('bad'), scope: 'galaxy' } as unknown as MinimalityMetadata;
        expect(() => breakTie(bad, candidate('ok'))).toThrow(MinimalityMetadataError);
    });
});

describe('4.5 — verify: identical vectors resolve deterministically under the committed order', () => {
    /**
     * Both candidates carry the SAME metric vector by construction — the
     * tie-break is the only thing separating them, which is the situation step
     * 4.5 describes. `cheap` costs fewer tokens; `narrow` touches less.
     */
    const cheap = candidate('cheap', { tokens: 50, artifacts: 5, scope: 'repo', precedence: 'kernel' });
    const narrow = candidate('narrow', {
        tokens: 500,
        artifacts: 1,
        scope: 'single-artifact',
        precedence: 'advisory',
    });

    it('resolves to the same winner on every run, and on the reversed argument order', () => {
        const first = breakTie(cheap, narrow);
        expect(first.winner).toBe('cheap');
        expect(first.decided_by).toBe('tokens');
        for (let i = 0; i < 20; i++) {
            expect(breakTie(cheap, narrow)).toEqual(first);
        }
        const swapped = breakTie(narrow, cheap);
        expect(swapped.winner).toBe('cheap');
        expect(swapped.decided_by).toBe('tokens');
    });

    it('and the ORDER is what decided it — inverting the order flips the winner', () => {
        const inverted = [...MINIMALITY_ORDER].reverse() as MinimalityCriterion[];
        const r = breakTie(cheap, narrow, inverted);
        expect(r.winner).toBe('narrow');
        expect(r.decided_by).toBe('precedence');
    });

    it('orderByMinimality is a total order, stable when all four criteria tie', () => {
        const tied = [candidate('zulu'), candidate('alpha'), candidate('mike')];
        const once = orderByMinimality(tied).map((c) => c.candidate_id);
        expect(once).toEqual(['alpha', 'mike', 'zulu']);
        // Input order must not change the result — the stabiliser is the id.
        expect(orderByMinimality([...tied].reverse()).map((c) => c.candidate_id)).toEqual(once);
    });

    it('the id stabiliser never appears as a decision — it is not a fifth criterion', () => {
        const r = breakTie(candidate('aaa'), candidate('zzz'));
        expect(r.winner).toBeNull();
        expect(r.decided_by).toBeNull();
    });
});
