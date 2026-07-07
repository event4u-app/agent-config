/**
 * Bench matrix expansion + composite renderer — road-to-flow-learnings
 * Phase 3. Deterministic exit-gate coverage:
 *   - matrix expansion is snapshot-stable (family × host × arm),
 *   - marker splice preserves everything outside the markers byte-for-byte,
 *   - the composite render is byte-stable across two runs from the same
 *     pinned inputs (skipped when the operator-local reports are absent).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    MatrixConfigError,
    expandMatrix,
    familyTaskIds,
    parseMatrixSpec,
    planLines,
} from '../../src/scripts/bench_matrix.js';
import {
    CompositeConfigError,
    REPO_ROOT,
    markerBounds,
    parseManifest,
    renderSection,
    spliceMarkers,
    type PinnedSection,
} from '../../src/scripts/render_benchmark_composite.js';

const FIXTURE_CORPUS = [
    'tasks:',
    '  - id: fam-a-01',
    '    archetype: fam-a',
    '  - id: fam-a-02',
    '    archetype: fam-a',
    '  - id: fam-b-01',
    '    archetype: fam-b',
].join('\n');

describe('parseMatrixSpec', () => {
    it('parses a full spec and applies defaults', () => {
        const spec = parseMatrixSpec('families: [fam-a]\nhosts: [claude]\narms: [vanilla]\n');
        expect(spec.seeds).toBe(3);
        expect(spec.model).toBe('claude-haiku-4-5');
        expect(spec.budget).toBe(1.0);
    });

    it.each([
        ['unknown host', 'families: [x]\nhosts: [gpt-oss]\narms: [vanilla]\n'],
        ['unknown arm', 'families: [x]\nhosts: [claude]\narms: [warp-drive]\n'],
        ['codex-invalid arm', 'families: [x]\nhosts: [codex]\narms: [package]\n'],
        ['zero seeds', 'families: [x]\nhosts: [claude]\narms: [vanilla]\nseeds: 0\n'],
        ['missing arms', 'families: [x]\nhosts: [claude]\n'],
    ])('rejects %s', (_name, text) => {
        expect(() => parseMatrixSpec(text)).toThrow(MatrixConfigError);
    });
});

describe('expandMatrix — snapshot', () => {
    it('expands host × family cells in document order, all arms per cell (paired design)', () => {
        const spec = parseMatrixSpec(
            'families: [fam-a, fam-b]\nhosts: [claude]\narms: [vanilla, package]\nseeds: 2\n',
        );
        const cells = expandMatrix(spec, FIXTURE_CORPUS, 'dry-run');
        const lines = planLines(cells).map((l) => l.replace(/--tasks \S+/, '--tasks <ids>'));
        expect(lines).toEqual([
            'cell host=claude family=fam-a tasks=2 :: bench_ab_v2_run --arms vanilla,package ' +
                '--tasks <ids> --seeds 2 --model claude-haiku-4-5 --budget 1 --timeout 180 ' +
                '--host claude --mode dry-run',
            'cell host=claude family=fam-b tasks=1 :: bench_ab_v2_run --arms vanilla,package ' +
                '--tasks <ids> --seeds 2 --model claude-haiku-4-5 --budget 1 --timeout 180 ' +
                '--host claude --mode dry-run',
        ]);
    });

    it('groups corpus tasks by archetype', () => {
        const byFamily = familyTaskIds(FIXTURE_CORPUS);
        expect(byFamily.get('fam-a')).toEqual(['fam-a-01', 'fam-a-02']);
        expect(byFamily.get('fam-b')).toEqual(['fam-b-01']);
    });

    it('refuses a family with zero corpus tasks (no silent empty cells)', () => {
        const spec = parseMatrixSpec('families: [ghost]\nhosts: [claude]\narms: [vanilla]\n');
        expect(() => expandMatrix(spec, FIXTURE_CORPUS, 'dry-run')).toThrow(MatrixConfigError);
    });
});

describe('spliceMarkers', () => {
    const doc = [
        'curated intro',
        '<!-- pinned:x -->',
        'old generated',
        '<!-- /pinned:x -->',
        'curated outro',
    ].join('\n');

    it('replaces marker interiors and preserves everything else byte-for-byte', () => {
        const out = spliceMarkers(doc, new Map([['x', 'NEW CONTENT']]));
        expect(out).toBe(
            ['curated intro', '<!-- pinned:x -->', 'NEW CONTENT', '<!-- /pinned:x -->', 'curated outro'].join(
                '\n',
            ),
        );
    });

    it('is idempotent for identical content', () => {
        const once = spliceMarkers(doc, new Map([['x', 'SAME']]));
        expect(spliceMarkers(once, new Map([['x', 'SAME']]))).toBe(once);
    });

    it('throws on a missing marker pair (drift never passes silently)', () => {
        expect(() => spliceMarkers(doc, new Map([['ghost', 'c']]))).toThrow(CompositeConfigError);
    });

    it('exposes stable marker bounds', () => {
        expect(markerBounds('a')).toEqual(['<!-- pinned:a -->', '<!-- /pinned:a -->']);
    });
});

describe('composite manifest + pinned render', () => {
    const manifestPath = path.join(REPO_ROOT, 'docs', 'benchmark.pinned.yml');

    it('the shipped manifest parses and every section id has a marker pair in the doc', () => {
        const sections = parseManifest(fs.readFileSync(manifestPath, 'utf-8'));
        expect(sections.length).toBeGreaterThanOrEqual(4);
        const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'benchmark.md'), 'utf-8');
        for (const s of sections) {
            const [b, e] = markerBounds(s.id);
            expect(doc.includes(b), `missing ${b}`).toBe(true);
            expect(doc.includes(e), `missing ${e}`).toBe(true);
        }
    });

    it('rejects a malformed manifest', () => {
        expect(() => parseManifest('sections: []')).toThrow(CompositeConfigError);
        expect(() => parseManifest('sections:\n  - id: x\n    mode: nope\n    report: r\n')).toThrow(
            CompositeConfigError,
        );
    });

    // Pinned reports are operator-local (untracked) — verify byte-stability
    // only where they exist; CI skips cleanly.
    const sections = parseManifest(fs.readFileSync(manifestPath, 'utf-8'));
    const reportsPresent = sections.every((s) => fs.existsSync(path.join(REPO_ROOT, s.report)));

    it.skipIf(!reportsPresent)(
        'renders every pinned section byte-stably across two runs',
        () => {
            for (const s of sections as PinnedSection[]) {
                const first = renderSection(s);
                const second = renderSection(s);
                expect(second).toBe(first);
                expect(first.length).toBeGreaterThan(50);
            }
        },
    );
});
