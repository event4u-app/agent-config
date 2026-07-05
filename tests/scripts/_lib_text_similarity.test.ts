// Tests for src/scripts/_lib/text_similarity.ts (road-to-knowledge-system,
// Phase 2 — capture-hygiene dedup primitive).
import { describe, expect, it } from 'vitest';

import {
    classifySimilarity,
    findMostSimilar,
    jaccardSimilarity,
    MERGE_THRESHOLD,
    tokenize,
    WARN_THRESHOLD,
} from '../../src/scripts/_lib/text_similarity.ts';

describe('tokenize', () => {
    it('lowercases and splits on non-alphanumeric runs', () => {
        expect(tokenize('Null Deref on Checkout!')).toEqual(new Set(['null', 'deref', 'on', 'checkout']));
    });

    it('drops duplicate tokens (it is a set)', () => {
        expect(tokenize('foo foo bar')).toEqual(new Set(['foo', 'bar']));
    });

    it('empty string tokenizes to an empty set', () => {
        expect(tokenize('')).toEqual(new Set());
    });
});

describe('jaccardSimilarity', () => {
    it('identical text scores 1.0', () => {
        expect(jaccardSimilarity('null deref on checkout', 'null deref on checkout')).toBe(1.0);
    });

    it('completely disjoint text scores 0.0', () => {
        expect(jaccardSimilarity('foo bar baz', 'qux quux corge')).toBe(0.0);
    });

    it('partial overlap scores strictly between 0 and 1', () => {
        const score = jaccardSimilarity('null deref on checkout page', 'null pointer on checkout flow');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(1);
    });

    it('is symmetric', () => {
        const a = 'stripe webhook signature format';
        const b = 'webhook signature stripe verification';
        expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a));
    });

    it('is case-insensitive', () => {
        expect(jaccardSimilarity('Null Deref', 'null deref')).toBe(1.0);
    });

    it('two empty strings are defined as identical', () => {
        expect(jaccardSimilarity('', '')).toBe(1.0);
    });

    it('empty vs non-empty scores 0', () => {
        expect(jaccardSimilarity('', 'something')).toBe(0.0);
    });
});

describe('classifySimilarity', () => {
    it('scores >= MERGE_THRESHOLD classify as merge', () => {
        expect(classifySimilarity(MERGE_THRESHOLD)).toBe('merge');
        expect(classifySimilarity(1.0)).toBe('merge');
    });

    it('scores between WARN and MERGE classify as warn', () => {
        expect(classifySimilarity(WARN_THRESHOLD)).toBe('warn');
        expect(classifySimilarity((MERGE_THRESHOLD + WARN_THRESHOLD) / 2)).toBe('warn');
    });

    it('scores below WARN_THRESHOLD classify as create', () => {
        expect(classifySimilarity(WARN_THRESHOLD - 0.01)).toBe('create');
        expect(classifySimilarity(0)).toBe('create');
    });
});

describe('findMostSimilar', () => {
    it('returns null for an empty candidate set', () => {
        expect(findMostSimilar('anything', [])).toBeNull();
    });

    it('picks the highest-scoring candidate', () => {
        const match = findMostSimilar('null deref on checkout page', [
            { id: 'a', text: 'completely unrelated topic here' },
            { id: 'b', text: 'null deref on checkout page' },
            { id: 'c', text: 'null pointer somewhere else' },
        ]);
        expect(match?.id).toBe('b');
        expect(match?.score).toBe(1.0);
        expect(match?.classification).toBe('merge');
    });

    it('classification field matches classifySimilarity(score)', () => {
        const match = findMostSimilar('a b c d', [{ id: 'x', text: 'a b' }]);
        expect(match).not.toBeNull();
        expect(match!.classification).toBe(classifySimilarity(match!.score));
    });
});
