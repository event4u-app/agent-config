/**
 * Step 6.3 — a lexical shortlist, and only a shortlist.
 *
 * > verify: **the shortlist feeds a later stage and never decides alone.**
 *
 * The verify clause has a positive half and a negative half, and the negative
 * half is the load-bearing one. A shortlist that decides nothing is trivially
 * compliant and useless; a shortlist that decides is the failure. So this file
 * proves BOTH: that the shortlist demonstrably changes what the later stage
 * (the byte cap in `selectForInjection`) does, and that it cannot change the
 * SET the matcher decided, in either direction.
 *
 * ## The banned-construct list lives here, not in the module
 *
 * A scanner whose banned literals sit inside the file it scans matches its own
 * declaration and can never pass. `governed_harness_no_live_harness.test.ts`
 * keeps its banned set on the test side for the same reason.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SHORTLIST_SIZE,
    ShortlistDecidedAloneError,
    assertPermutation,
    buildRuleIndex,
    makePromptShortlist,
    orderByShortlist,
    shortlistIds,
    shortlistRanks,
} from '../../../src/scripts/_lib/lexical_shortlist.js';
import {
    allTierRules,
    loadRouter,
    loadRuleBody,
    matchTierRules,
    selectForInjection,
    type TierRuleMatch,
} from '../../../src/scripts/_lib/rule_injection.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const router = loadRouter(REPO);

function m(id: string, score: number, order: number): TierRuleMatch {
    return { id, tier: 'tier_2', score, order };
}

/** Real tier-rule ids that carry a projected body — the cap's real subjects. */
const bodied = allTierRules(router)
    .filter((r) => loadRuleBody(REPO, r.id) !== null)
    .map((r) => r.id);

// --- § the index is BM25 over what already ships ----------------------------

describe('6.3 — the shortlist is built over the existing BM25 core', () => {
    it('indexes the bodied tier rules and ranks deterministically', () => {
        const index = buildRuleIndex(REPO, router);
        expect(index.size).toBeGreaterThan(20);
        expect(index.size).toBeLessThanOrEqual(bodied.length);
        const a = shortlistIds(index, 'never commit or push without permission');
        const b = shortlistIds(index, 'never commit or push without permission');
        expect(a).toEqual(b);
        expect(a.length).toBeGreaterThan(0);
        expect(a.length).toBeLessThanOrEqual(SHORTLIST_SIZE);
    });

    it('a shortlist is a ranking, so its first entry moves with the prompt', () => {
        const index = buildRuleIndex(REPO, router);
        const commit = shortlistIds(index, 'commit policy, when may I commit');
        const design = shortlistIds(index, 'design fidelity of the provided prototype mockup');
        expect(commit[0]).toBeDefined();
        expect(design[0]).toBeDefined();
        // A ranker that returned the same head for every prompt would be a
        // constant wearing a ranking's clothes.
        expect(commit[0]).not.toBe(design[0]);
    });

    it('an empty shortlist is a real answer, not a crash', () => {
        const index = buildRuleIndex(REPO, router);
        expect(shortlistIds(index, 'zzzzqqqxvv', 40)).toEqual([]);
        expect(shortlistIds(index, 'commit', 0)).toEqual([]);
    });

    it('shortlistRanks keeps the FIRST position of a duplicated id', () => {
        expect([...shortlistRanks(['a', 'b', 'a']).entries()]).toEqual([
            ['a', 0],
            ['b', 1],
        ]);
    });
});

// --- § never decides alone: the permutation invariant -----------------------

describe('6.3 — the shortlist never decides alone (the negative half)', () => {
    const matches = [m('r-a', 1, 0), m('r-b', 1, 1), m('r-c', 1, 2)];

    it('orderByShortlist returns a permutation of the matcher`s output', () => {
        const out = orderByShortlist(matches, ['r-c', 'r-a']);
        expect(out.map((x) => x.id)).toEqual(['r-c', 'r-a', 'r-b']);
        expect([...out].map((x) => x.id).sort()).toEqual(['r-a', 'r-b', 'r-c']);
    });

    it('ids the shortlist ranks that the matcher did not return are dropped on the floor', () => {
        // `r-zzz` never fired. It appears first in the shortlist and is still
        // nowhere in the output — this is "cannot add" at its source.
        const out = orderByShortlist(matches, ['r-zzz', 'r-b']);
        expect(out.map((x) => x.id)).not.toContain('r-zzz');
        expect(out.map((x) => x.id)).toEqual(['r-b', 'r-a', 'r-c']);
    });

    it('the matcher`s score dominates the shortlist rank, never the other way round', () => {
        // `r-a` fired twice; `r-c` is the shortlist's favourite. The matcher wins.
        const scored = [m('r-a', 2, 0), m('r-c', 1, 2)];
        expect(orderByShortlist(scored, ['r-c', 'r-a']).map((x) => x.id)).toEqual(['r-a', 'r-c']);
    });

    it('the shortlist breaks ties the matcher left, ahead of router order', () => {
        expect(orderByShortlist(matches, ['r-c']).map((x) => x.id)).toEqual(['r-c', 'r-a', 'r-b']);
    });

    it('an unshortlisted match still competes — it sorts last, it is not removed', () => {
        const out = orderByShortlist(matches, ['r-b']);
        expect(out.map((x) => x.id)).toEqual(['r-b', 'r-a', 'r-c']);
        expect(out).toHaveLength(matches.length);
    });

    // --- the sabotage the verify clause actually asks for --------------------

    it('FIRES when the shortlist DECIDES BY SUBTRACTION (negative polarity)', () => {
        // The sabotage in one line: filter the matcher's output down to the
        // shortlist. This is the shape a "shortlist" naturally degrades into.
        const decided = matches.filter((x) => ['r-c'].includes(x.id));
        expect(() => assertPermutation(matches, decided)).toThrow(ShortlistDecidedAloneError);
        expect(() => assertPermutation(matches, decided)).toThrow(/dropped r-a, r-b/);
        expect(() => assertPermutation(matches, decided)).toThrow(/decides by subtraction/);
    });

    it('FIRES when the shortlist DECIDES BY ADDITION (negative polarity)', () => {
        const decided = [...matches, m('r-zzz', 1, 99)];
        expect(() => assertPermutation(matches, decided)).toThrow(/added r-zzz/);
        expect(() => assertPermutation(matches, decided)).toThrow(
            /delivers what the matcher never fired on/,
        );
    });

    it('is silent on a genuine reorder (positive polarity)', () => {
        expect(() => assertPermutation(matches, [...matches].reverse())).not.toThrow();
    });

    it('counts multiplicity, so a swap of one id for a duplicate of another is caught', () => {
        const decided = [m('r-a', 1, 0), m('r-a', 1, 0), m('r-b', 1, 1)];
        expect(() => assertPermutation(matches, decided)).toThrow(ShortlistDecidedAloneError);
    });
});

// --- § it feeds a LATER STAGE, and the later stage still owns membership -----

describe('6.3 — the shortlist feeds selectForInjection`s cap', () => {
    const ids = bodied.slice(0, 6);

    it('with a slack cap, membership is identical with and without a shortlist', () => {
        const matches = ids.map((id, i) => m(id, 1, i));
        const slack = 10_000_000;
        const off = selectForInjection(REPO, [...matches], slack);
        const on = selectForInjection(REPO, [...matches], slack, [...ids].reverse());
        expect(off.selected.map((x) => x.id).sort()).toEqual(on.selected.map((x) => x.id).sort());
        expect(on.dropped).toEqual([]);
    });

    it('selected + dropped is exactly the matcher`s set, in both modes', () => {
        const matches = ids.map((id, i) => m(id, 1, i));
        for (const sl of [null, [...ids].reverse()]) {
            const sel = selectForInjection(REPO, [...matches], 1, sl);
            const seen = [...sel.selected, ...sel.dropped].map((x) => x.id).sort();
            expect(seen).toEqual([...ids].sort());
        }
    });

    it('a PARTIAL shortlist drops no matched body when the cap is slack', () => {
        // The gap a sabotage found: every earlier case shortlisted EVERY match,
        // so a `filter(x => shortlisted)` inside the cap walk changed nothing
        // and no test moved. Here the shortlist names one of six.
        const matches = ids.map((id, i) => m(id, 1, i));
        const partial = [ids[3] as string];
        const sel = selectForInjection(REPO, [...matches], 10_000_000, partial);
        expect(sel.selected.map((x) => x.id).sort()).toEqual([...ids].sort());
        expect(sel.dropped).toEqual([]);
    });

    it('the matcher`s score outranks the shortlist INSIDE the cap walk too', () => {
        // `orderByShortlist` pins the key order in the shortlist module; this
        // pins the identical order at the place the cap actually binds, which
        // is a second implementation of the same comparator and can drift.
        const hi = ids[0] as string;
        const lo = ids[1] as string;
        const matches = [m(hi, 2, 0), m(lo, 1, 1)];
        const cap = 1; // admits exactly one body
        const sel = selectForInjection(REPO, [...matches], cap, [lo]);
        expect(sel.selected.map((x) => x.id)).toEqual([hi]);
        expect(sel.dropped.map((x) => x.id)).toEqual([lo]);
    });

    it('a shortlisted id the matcher did not return is never delivered', () => {
        const matches = ids.slice(0, 2).map((id, i) => m(id, 1, i));
        const sel = selectForInjection(REPO, [...matches], 10_000_000, ['r-not-a-match', ...ids]);
        expect(sel.selected.map((x) => x.id)).not.toContain('r-not-a-match');
        expect(sel.selected).toHaveLength(2);
    });

    it('CHANGES which body survives a binding cap — the shortlist is not decorative', () => {
        // A cap that admits exactly one body. Without a shortlist the winner is
        // router order; with one naming the last id first, the winner moves.
        const matches = ids.map((id, i) => m(id, 1, i));
        const cap = 1;
        const off = selectForInjection(REPO, [...matches], cap);
        const on = selectForInjection(REPO, [...matches], cap, [ids[ids.length - 1] as string]);
        expect(off.selected.map((x) => x.id)).toEqual([ids[0]]);
        expect(on.selected.map((x) => x.id)).toEqual([ids[ids.length - 1]]);
    });

    it('the default is byte-for-byte the pre-6.3 behaviour', () => {
        const matches = ids.map((id, i) => m(id, 1, i));
        const a = selectForInjection(REPO, [...matches], 20_480);
        const b = selectForInjection(REPO, [...matches], 20_480, null);
        expect(a.selected.map((x) => x.id)).toEqual(b.selected.map((x) => x.id));
        expect(a.bytes).toBe(b.bytes);
    });
});

// --- § over the real router and a real prompt -------------------------------

describe('6.3 — over the real router', () => {
    it('a bound shortlist reorders real matches without changing the set', () => {
        const shortlist = makePromptShortlist(REPO, router);
        const prompt = 'I need to commit and push this change to a production branch';
        const matches = matchTierRules(router, prompt);
        expect(matches.length).toBeGreaterThan(0);
        const ranked = shortlist(prompt);
        expect(ranked.length).toBeGreaterThan(0);
        const out = orderByShortlist(matches, ranked);
        expect(out.map((x) => x.id).sort()).toEqual(matches.map((x) => x.id).sort());
    });
});

// --- § no embeddings, no vector store, no model call ------------------------

/** Constructs `resident-process-governance.md:82` and its P4 row prohibit. */
const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
    ['embedding-call', /\bembed(?:ding)?s?\s*\(/i],
    ['embedding-identifier', /\b(?:createEmbedding|getEmbedding|sentenceTransformer)\b/],
    ['vector-store', /\b(?:pgvector|faiss|hnswlib|qdrant|chromadb|pinecone|weaviate|milvus)\b/i],
    ['cosine-similarity', /\bcosine(?:Similarity|Distance|_similarity|_distance)\b/i],
    ['network', /\bfetch\s*\(|node:https?\b|node:net\b|XMLHttpRequest/],
    ['child-process', /\bchild_process\b/],
];

function findBanned(source: string): string[] {
    return BANNED.filter(([, re]) => re.test(source)).map(([name]) => name);
}

const SUBJECTS = [
    'src/scripts/_lib/lexical_shortlist.ts',
    'src/scripts/_lib/lexical_index.ts',
];

describe('6.3 — no embeddings (contract, not preference)', () => {
    it('the scan FIRES on synthetic sources carrying each construct', () => {
        // Proved before it is trusted to be silent. A scanner never seen fire
        // has unknown sensitivity, and "no hits" would then mean nothing.
        expect(findBanned('const v = await embed(text);')).toContain('embedding-call');
        expect(findBanned('import { createEmbedding } from "x";')).toContain(
            'embedding-identifier',
        );
        expect(findBanned('const db = new Qdrant();')).toContain('vector-store');
        expect(findBanned('return cosineSimilarity(a, b);')).toContain('cosine-similarity');
        expect(findBanned('await fetch("https://example.invalid");')).toContain('network');
        expect(findBanned("import cp from 'node:child_process';")).toContain('child-process');
    });

    it('is silent on plain BM25 arithmetic (positive polarity)', () => {
        expect(findBanned('const s = (idf * (tf * (K1 + 1))) / denom;')).toEqual([]);
    });

    it('and the real sources carry none of them', () => {
        const offenders: Record<string, string[]> = {};
        let bytesScanned = 0;
        for (const rel of SUBJECTS) {
            const src = readFileSync(path.join(REPO, rel), 'utf-8');
            bytesScanned += src.length;
            const hits = findBanned(src);
            if (hits.length > 0) offenders[rel] = hits;
        }
        // A scan over nothing exits green, so the denominator is asserted too.
        expect(bytesScanned).toBeGreaterThan(8000);
        expect(offenders).toEqual({});
    });

    it('the shortlist module imports only the BM25 core and the injection module', () => {
        const src = readFileSync(path.join(REPO, SUBJECTS[0] as string), 'utf-8');
        const imports = [...src.matchAll(/^import[^;]*from '([^']+)';/gm)].map((x) => x[1]);
        expect(imports.sort()).toEqual(['./lexical_index.js', './rule_injection.js']);
    });
});
