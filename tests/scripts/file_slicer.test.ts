/**
 * Document slicer invariants (road-to-retrieval-substrate-hardening B8).
 * These invariants are the ingest-slicing contract fold_intake relies on.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_MAX_CHARS, sliceDocument, verifySlices } from '../../src/scripts/_lib/file_slicer.js';

const bigDoc = [
    '# Title',
    '',
    '## Section A',
    'para one line one',
    'para one line two',
    '',
    '## Section B',
    'x'.repeat(50),
    '',
    '## Section C',
    'y'.repeat(50),
    '',
].join('\n');

describe('sliceDocument — invariants', () => {
    it('concat of slices reproduces the original byte-for-byte', () => {
        const slices = sliceDocument(bigDoc, { maxChars: 40, parentPath: 'k/doc.md' });
        expect(slices.map((s) => s.text).join('')).toBe(bigDoc);
        expect(verifySlices(bigDoc, slices)).toBe(true);
    });

    it('slices are gap-free and non-overlapping (contiguous line ranges)', () => {
        const slices = sliceDocument(bigDoc, { maxChars: 40 });
        for (let i = 1; i < slices.length; i++) {
            expect(slices[i]!.startLine).toBe(slices[i - 1]!.endLine);
        }
        expect(slices[0]!.startLine).toBe(0);
    });

    it('stamps the parent path and a monotonic index on every slice', () => {
        const slices = sliceDocument(bigDoc, { maxChars: 40, parentPath: 'k/doc.md' });
        slices.forEach((s, i) => {
            expect(s.parentPath).toBe('k/doc.md');
            expect(s.index).toBe(i);
        });
    });

    it('prefers heading boundaries — a new ## opens a new slice', () => {
        const slices = sliceDocument(bigDoc, { maxChars: DEFAULT_MAX_CHARS });
        // With a generous budget, cuts happen only at headings.
        const starts = slices.map((s) => s.text.split('\n')[0]);
        expect(starts.filter((h) => h?.startsWith('## ')).length).toBeGreaterThan(0);
    });

    it('is deterministic', () => {
        expect(JSON.stringify(sliceDocument(bigDoc, { maxChars: 40 }))).toBe(
            JSON.stringify(sliceDocument(bigDoc, { maxChars: 40 })),
        );
    });

    it('empty input yields no slices; a single over-long line is emitted whole', () => {
        expect(sliceDocument('')).toEqual([]);
        const one = sliceDocument('z'.repeat(5000), { maxChars: 100 });
        expect(one).toHaveLength(1);
        expect(verifySlices('z'.repeat(5000), one)).toBe(true);
    });
});
