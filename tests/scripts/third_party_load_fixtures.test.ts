// The frozen corpus of road-to-a-page-that-says-what-it-loads 1.2 holds what its
// ground truth says it holds. Written before the detector: if a planted line
// moves, this fails before a detector score can silently change meaning.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', 'fixtures', 'third-party-load');

interface Finding {
    id: string;
    row: number;
    check: string;
    file: string;
    line?: number;
    origin?: string;
    provider?: string;
}
interface Truth {
    findings: Finding[];
    twins: string[];
    decoys: { id: string; file: string }[];
    undecided: { id: string; file: string; line: number }[];
}

const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ground-truth.json'), 'utf8')) as Truth;
const lineAt = (rel: string, n: number): string =>
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')[n - 1] ?? '';

describe('third-party-load corpus', () => {
    it('plants eight rows, nine entries, six twins, five decoys', () => {
        expect(new Set(truth.findings.map((f) => f.row)).size).toBe(8);
        expect(truth.findings).toHaveLength(9);
        expect(truth.twins).toHaveLength(6);
        expect(truth.decoys).toHaveLength(5);
    });

    it('every located planted entry points at the line carrying its defect', () => {
        for (const f of truth.findings.filter((x) => x.line !== undefined)) {
            const text = lineAt(f.file, f.line!);
            if (f.origin !== undefined) expect(text, f.id).toContain(f.origin);
            if (f.check === 'superseded-statute-in-legal-page') expect(text, f.id).toMatch(/§\s*5\s*TMG/);
            if (f.check === 'placeholder-in-legal-page') expect(text, f.id).toMatch(/\[Firmenname\]/);
        }
    });

    it('the privacy page of the planted build names neither unnamed provider', () => {
        const text = fs.readFileSync(path.join(ROOT, 'planted/datenschutz.html'), 'utf8');
        expect(text).not.toMatch(/Maps|YouTube/);
    });

    it('every planted file has a twin at the same relative path', () => {
        for (const f of truth.findings) {
            const twin = f.file.replace(/^planted\//, 'safe/');
            expect(truth.twins, f.id).toContain(twin);
            expect(fs.existsSync(path.join(ROOT, twin)), twin).toBe(true);
        }
    });

    it('no twin or decoy loads a third-party origin in a loadable context', () => {
        const loadable = /<(link|script|iframe|img|video|audio|source)\b[^>]*\b(href|src)\s*=\s*["']https?:|@import\s+url\(\s*["']?https?:/i;
        for (const rel of [...truth.twins, ...truth.decoys.map((d) => d.file)]) {
            const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            const hits = text.split('\n').filter((l) => loadable.test(l) && !/dns-prefetch/.test(l));
            expect(hits, rel).toEqual([]);
        }
    });

    it('the undecided decoy is a dns-prefetch line', () => {
        for (const u of truth.undecided) expect(lineAt(u.file, u.line)).toMatch(/rel="dns-prefetch"/);
    });
});
