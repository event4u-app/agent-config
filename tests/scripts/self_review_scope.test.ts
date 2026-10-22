// A scoped, uncapped self-review run: the path filter, the lifted ceiling and
// the coverage line that names the scope. Added for the 17.0.0 cut, whose span
// needs ~71 requests against a per-run ceiling of 6.

import { describe, expect, it } from 'vitest';

import {
    MAX_REVIEW_CHUNKS,
    coverageBlock,
    inScope,
    main,
    partitionDiff,
} from '../../src/scripts/self_review_gate.js';

describe('inScope', () => {
    it('keeps every file when no scope is given', () => {
        expect(inScope('agents/evidence/x.md', undefined)).toBe(true);
    });

    it('matches a prefix on a path-segment boundary, with or without a trailing slash', () => {
        expect(inScope('src/scripts/a.ts', ['src/scripts'])).toBe(true);
        expect(inScope('src/scripts/a.ts', ['src/scripts/'])).toBe(true);
        expect(inScope('src/scripts-old/a.ts', ['src/scripts'])).toBe(false);
        expect(inScope('hooks/hooks.json', ['src/scripts', 'hooks'])).toBe(true);
        expect(inScope('dist/install/install.mjs', ['src', 'hooks'])).toBe(false);
    });

    it('matches a prefix that names a file exactly', () => {
        expect(inScope('package.json', ['package.json'])).toBe(true);
    });
});

describe('the per-run ceiling', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({ path: `f${String(i)}.ts`, diff: 'x'.repeat(100) }));

    it('stays at the default when no override is given', () => {
        const p = partitionDiff(files, 150);
        expect(p.chunks).toHaveLength(MAX_REVIEW_CHUNKS);
        expect(p.unreviewed).toHaveLength(10 - MAX_REVIEW_CHUNKS);
    });

    it('reviews the whole span when the override covers it', () => {
        const p = partitionDiff(files, 150, 20);
        expect(p.chunks).toHaveLength(10);
        expect(p.unreviewed).toHaveLength(0);
    });

    it('refuses a --max-chunks that is not a positive integer', () => {
        expect(main(['--dry-run', '--max-chunks', '0'])).toBe(2);
        expect(main(['--dry-run', '--max-chunks', 'many'])).toBe(2);
    });
});

describe('coverage of a scoped run', () => {
    it('names the scope, so the reader knows what the counts leave out', () => {
        const block = coverageBlock({ chunks: 2, filesReviewed: 9, filesTotal: 9, unreviewed: [], scope: ['src/scripts', 'hooks'] });
        expect(block).toContain('Scoped to `src/scripts`, `hooks`');
        expect(block).toContain('2 request(s) over 9 of 9 changed file(s).');
    });

    it('says nothing about scope for a whole-span run', () => {
        expect(coverageBlock({ chunks: 1, filesReviewed: 3, filesTotal: 3, unreviewed: [] })).not.toContain('Scoped to');
    });
});

describe('a scoped run is never an enforced verdict', () => {
    it('refuses --scope together with --enforce', () => {
        // Finding cc59a3fd0ca7: a scoped, enforced, clean run read as a review of
        // the whole span. Refused before any plan is built or anything is spent.
        expect(main(['--dry-run', '--scope', 'src/scripts', '--enforce'])).toBe(2);
    });
});
