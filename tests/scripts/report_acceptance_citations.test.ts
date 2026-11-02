/**
 * Tests for `src/scripts/report_acceptance_citations.ts` — the report-only
 * acceptance-citation resolver (road-to-a-grade-that-saw-the-evidence 2.1).
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { anchorsOf, buildReport, citationsIn, main, renderReport, roadmapIndex } from '../../src/scripts/report_acceptance_citations.js';

function tree(files: Record<string, string>): string {
    const d = mkdtempSync(join(tmpdir(), 'rac-'));
    for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(join(d, rel)), { recursive: true });
        writeFileSync(join(d, rel), body);
    }
    return d;
}

const ROADMAPS = {
    'agents/roadmaps/road-to-alpha.md': '# alpha\n\n- [x] AC-1 — one\n- [ ] **AC-2** — two\n',
    'agents/roadmaps/archive/road-to-beta.md': '# beta\n\n| AC-1 | table row |\n\nprose that mentions AC-9 is not an anchor\n',
    'agents/roadmaps/later/road-to-gamma.md': '# gamma\n\n- [x] AC-1 — also one\n',
    'agents/roadmaps/stubs/road-to-delta.md': '# delta\n\n### AC-3 heading anchor\n',
};

describe('report_acceptance_citations — anchors', () => {
    it('reads definition lines, never a mention inside prose', () => {
        expect([...anchorsOf('- [x] AC-1 — a\n- [~] **AC-4** b\n| AC-5 | c |\n')].sort()).toEqual([1, 4, 5]);
        expect(anchorsOf('this text cites AC-7 in passing\n').size).toBe(0);
    });

    it('indexes active, archive, later and stub roadmaps by slug', () => {
        const idx = roadmapIndex(tree(ROADMAPS));
        expect([...idx.keys()].sort()).toEqual(['road-to-alpha', 'road-to-beta', 'road-to-delta', 'road-to-gamma']);
        expect(idx.get('road-to-beta')?.[0]?.anchors.has(9)).toBe(false);
    });
});

describe('report_acceptance_citations — classification', () => {
    const idx = roadmapIndex(tree(ROADMAPS));

    it('an explicit citation resolves against its own slug only', () => {
        const [c] = citationsIn("it('x (archive/road-to-beta#AC-1)')", idx);
        expect(c?.form).toBe('explicit');
        expect(c?.status).toBe('resolved');
        expect(c?.hits).toEqual(['agents/roadmaps/archive/road-to-beta.md']);
    });

    it('an explicit citation to an anchor the roadmap lacks is dangling', () => {
        expect(citationsIn('road-to-alpha#AC-3', idx)[0]?.status).toBe('dangling');
        expect(citationsIn('road-to-nowhere#AC-1', idx)[0]?.status).toBe('dangling');
    });

    it('a bare citation resolves when exactly one named roadmap declares it', () => {
        const cs = citationsIn('// road-to-alpha and road-to-delta\n// AC-2 is pinned here', idx);
        expect(cs).toHaveLength(1);
        expect(cs[0]?.status).toBe('resolved');
        expect(cs[0]?.hits).toEqual(['agents/roadmaps/road-to-alpha.md']);
    });

    it('a bare citation two named roadmaps both declare is ambiguous', () => {
        expect(citationsIn('// road-to-alpha, road-to-gamma: AC-1', idx)[0]?.status).toBe('ambiguous');
    });

    it('a bare citation with no roadmap named is dangling', () => {
        const [c] = citationsIn('// AC-1 with no slug in the file', idx);
        expect(c?.status).toBe('dangling');
        expect(c?.candidates).toEqual([]);
    });
});

describe('report_acceptance_citations — the report', () => {
    const root = tree({
        ...ROADMAPS,
        'tests/a.test.ts': '// road-to-alpha AC-1\n',
        'tests/sub/b.test.ts': '// road-to-alpha, road-to-gamma AC-1\n',
        'tests/c.test.ts': '// AC-1 alone\n',
        'tests/d.test.ts': '// no citation\n',
        'tests/fixtures/e.test.ts': '// road-to-alpha AC-1 — a fixture, not a citing test\n',
        'tests/README.md': 'road-to-alpha AC-1 — not a test file\n',
    });

    it('counts citing test files by worst status, skipping fixtures and non-tests', () => {
        const r = buildReport(root);
        expect(r.files.map((f) => [f.rel, f.status])).toEqual([
            ['tests/a.test.ts', 'resolved'],
            ['tests/c.test.ts', 'dangling'],
            ['tests/sub/b.test.ts', 'ambiguous'],
        ]);
        const out = renderReport(r, false);
        expect(out).toContain('test files citing AC-n: 3');
        expect(out).toContain('files    resolved 1 · ambiguous 1 · dangling 1');
        expect(out).toContain('report-only');
    });

    it('exits 0 whatever the counts — no ratchet', () => {
        expect(main(['--root', root])).toBe(0);
        expect(main(['--root', root, '--list'])).toBe(0);
        expect(main(['--root', root, '--json'])).toBe(0);
    });

    it('rejects an unknown argument as a usage error, not a finding', () => {
        expect(main(['--definitely-not-a-flag'])).toBe(2);
    });
});
