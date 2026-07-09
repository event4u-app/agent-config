/**
 * Hand-rolled lexical index (road-to-retrieval-substrate-hardening B2).
 */
import { describe, expect, it } from 'vitest';

import { LexicalIndex, tokenize, trigrams } from '../../src/scripts/_lib/lexical_index.js';

describe('tokenize', () => {
    it('lowercases, splits on non-alphanumerics, drops single chars', () => {
        expect(tokenize('Public API: REST, not GraphQL (v2)!')).toEqual([
            'public',
            'api',
            'rest',
            'not',
            'graphql',
            'v2',
        ]);
    });
});

describe('trigrams', () => {
    it('emits sliding character trigrams over the normalised string', () => {
        expect([...trigrams('REST')]).toEqual(['res', 'est']);
    });
    it('handles short strings without throwing', () => {
        expect([...trigrams('a')]).toEqual(['a']);
        expect([...trigrams('')]).toEqual([]);
    });
});

describe('LexicalIndex ranking', () => {
    const docs = [
        { id: 'api', text: 'We chose REST for the public API with edge caching, not GraphQL.' },
        { id: 'queue', text: 'The job queue runs on Postgres, we did not adopt Kafka.' },
        { id: 'api-distract', text: 'Internal API notes mention GraphQL experiments only.' },
    ];
    const idx = new LexicalIndex(docs);

    it('ranks the on-topic doc first and breaks the keyword tie', () => {
        const ranked = idx.rank(['public API', 'REST', 'GraphQL']);
        expect(ranked[0]?.id).toBe('api');
        // Continuous scores → the two API docs do NOT tie at the top.
        const top = ranked[0]?.score ?? 0;
        const sharedTop = ranked.filter((r) => r.score === top).length;
        expect(sharedTop).toBe(1);
    });

    it('returns only positive-scoring candidates', () => {
        const ranked = idx.rank(['Kafka', 'job queue']);
        expect(ranked[0]?.id).toBe('queue');
        expect(ranked.every((r) => r.score > 0)).toBe(true);
    });

    it('is deterministic — identical query yields identical order + scores', () => {
        const a = idx.rank(['REST', 'API']);
        const b = idx.rank(['REST', 'API']);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('empty query and no-match query return no hits', () => {
        expect(idx.rank([])).toEqual([]);
        expect(idx.rank(['zzzznomatch'])).toEqual([]);
    });

    it('reports corpus size', () => {
        expect(idx.size).toBe(3);
    });
});
