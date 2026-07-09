/**
 * Lexical-index activation in retrieve() (road-to-retrieval-substrate-hardening
 * B2 activation). Above the tripwire the BM25 index re-ranks the recalled set;
 * below it `_score` bucket ranking is unchanged.
 */
import * as path from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setLexicalTripwireOverride,
    _setMemoryRoot,
    retrieve,
    retrieve_v1,
} from '../../src/scripts/memory_lookup.js';

// The tie-generating store: dec-* needed entries + dist-* keyword confusers.
const STORE = path.resolve(
    __dirname,
    '..',
    '..',
    'internal',
    'bench',
    'second-brain',
    'retrieval-store',
);

beforeAll(() => {
    _setMemoryRoot(STORE);
    _setKnowledgeRoot(path.join(STORE, 'knowledge-none'));
    _setIntakeRoot(path.join(STORE, 'intake-none'));
});
afterEach(() => {
    _setLexicalTripwireOverride(null); // restore default tripwire between cases
});

const QUERY = ['public API', 'REST', 'GraphQL'];
const topTie = (hits: Array<{ score: number }>): number => {
    if (hits.length === 0) return 0;
    const top = hits[0]?.score ?? 0;
    return hits.filter((h) => h.score === top).length;
};

describe('below the tripwire — inert (bucket scorer)', () => {
    it('leaves the coarse `_score` tie in place (needed entry not uniquely first)', () => {
        _setLexicalTripwireOverride(null); // default high thresholds → inert
        const hits = retrieve(['domain-invariants'], QUERY, 20);
        expect(hits.length).toBeGreaterThan(2);
        // `_score` gives every keyword match the same bucket → a top tie.
        expect(topTie(hits)).toBeGreaterThan(1);
        // Bucket scores, never continuous BM25.
        for (const h of hits) expect([0.6, 0.8]).toContain(Math.round(h.score * 100) / 100);
    });
});

describe('above the tripwire — BM25 re-rank', () => {
    it('uniquely top-ranks the needed entry and breaks the tie', () => {
        _setLexicalTripwireOverride(0); // force activation on the small fixture
        const hits = retrieve(['domain-invariants'], QUERY, 20);
        expect(hits[0]?.id).toBe('dec-api-style');
        expect(topTie(hits)).toBe(1);
    });

    it('keeps confidence within the v1 [0,1] contract', () => {
        _setLexicalTripwireOverride(0);
        const env = retrieve_v1(['domain-invariants'], QUERY, 20);
        const entries = env['entries'] as Array<Record<string, unknown>>;
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
            const conf = (e['confidence'] as { value: number }).value;
            expect(conf).toBeGreaterThanOrEqual(0);
            expect(conf).toBeLessThanOrEqual(1);
        }
        // The v1 envelope shape is unchanged (still id/type/source/confidence/body).
        expect(Object.keys(entries[0] ?? {}).sort()).toEqual([
            'body',
            'confidence',
            'id',
            'source',
            'type',
        ]);
    });

    it('is deterministic across calls', () => {
        _setLexicalTripwireOverride(0);
        const a = retrieve(['domain-invariants'], QUERY, 20).map((h) => `${h.id}:${h.score}`);
        const b = retrieve(['domain-invariants'], QUERY, 20).map((h) => `${h.id}:${h.score}`);
        expect(a).toEqual(b);
    });
});
