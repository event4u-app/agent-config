/**
 * `commands ls --candidates` — the surface-reduction report of roadmap step 3.4
 * (`road-to-inbox-harvest-2026-08-b-release-integrity`).
 *
 * Every assertion derives its expectation from the synthetic input rather than
 * pinning a literal the implementation happens to emit, so the suite cannot go
 * green for the wrong reason. The report is deliberately built from the
 * discovery manifest ALONE — no census file, no `utilization_report` import —
 * and the tests pin exactly that: the honesty band must survive, and the
 * ownership pointers must not be dropped by a later edit.
 */
import { describe, expect, it } from 'vitest';

import {
    buildCandidatesReport,
    renderCandidates,
    runCommandsLs,
    CANDIDATES_INCOMPATIBLE,
    REDUCTION_OWNERS,
    REPORT_ONLY_NOTICE,
    TEXT_LIST_CAP,
    type CandidatesReport,
} from './commands.js';
import type { DiscoveryArtefact } from '../discovery/loadManifest.js';

function cmd(
    slug: string,
    pack: string,
    extra: Partial<DiscoveryArtefact> = {},
): DiscoveryArtefact {
    return {
        path: `src/domains/${pack}/${slug}/command.md`,
        category: 'command',
        name: slug,
        slug,
        pack,
        visibility: 'internal',
        workspaces: [],
        packs: [pack],
        lifecycle: 'stable',
        trust: { level: 'core', confidence: 'high', human_review_required: false },
        install: { default: true, removable: false },
        intent: `do ${slug}`,
        ...extra,
    };
}

/** An artefact with NO `intent` key at all — distinct from `intent: ''`, and the
 * shape `exactOptionalPropertyTypes` forces us to build by omission. */
function cmdWithoutIntent(slug: string, pack: string, visibility: string): DiscoveryArtefact {
    const { intent: _omitted, ...rest } = cmd(slug, pack, { visibility });
    return rest;
}

/** Mixed fixture: two absorbed-name commands, two undocumented, three packs of
 * unequal weight. */
const FIXTURE: readonly DiscoveryArtefact[] = [
    cmd('alpha', 'engineering-base', { visibility: 'visible' }),
    cmd('bravo', 'engineering-base', { visibility: 'advanced' }),
    cmd('charlie', 'engineering-base', { visibility: 'internal', intent: '' }),
    cmd('delta', 'frontend-design', { visibility: 'visible', replaces: ['old-delta'] }),
    cmd('echo', 'frontend-design', { visibility: 'internal', replaces: ['old-echo', 'older-echo'] }),
    cmdWithoutIntent('foxtrot', 'finance-basic', 'advanced'),
];

describe('buildCandidatesReport', () => {
    const report = buildCandidatesReport(FIXTURE);

    it('counts the whole estate it was given', () => {
        expect(report.total).toBe(FIXTURE.length);
    });

    it('partitions visibility exhaustively — the buckets sum to the total', () => {
        const summed = Object.values(report.byVisibility).reduce((a, b) => a + b, 0);
        expect(summed).toBe(FIXTURE.length);
    });

    it('collects the commands that ABSORBED prior names, named explicitly', () => {
        // Named rather than recomputed from the implementation predicate: the
        // first version of this bucket inverted the field's meaning, and a test
        // that re-derives `(replaces ?? []).length > 0` certifies whatever the
        // code does — including the inversion.
        expect(report.absorbedNames.map((r) => r.slug)).toEqual(['delta', 'echo']);
        expect(report.absorbedNames.map((r) => r.slug)).not.toContain('alpha');
    });

    it('carries each absorbed-name list through unchanged', () => {
        for (const row of report.absorbedNames) {
            const source = FIXTURE.find((c) => c.slug === row.slug);
            expect(row.replaces).toEqual(source?.replaces ?? []);
        }
    });

    it('treats an empty-string intent as undocumented, not as documented', () => {
        const expected = FIXTURE
            .filter((c) => (c.intent ?? '').trim() === '')
            .map((c) => c.slug)
            .sort();
        expect(report.noIntent.map((r) => r.slug)).toEqual(expected);
        // Guard the boundary the implementation could get wrong in either
        // direction: '' and undefined both count, a real string never does.
        expect(expected).toContain('charlie');
        expect(expected).toContain('foxtrot');
        expect(expected).not.toContain('alpha');
    });

    it('orders packs by weight descending', () => {
        const counts = report.byPack.map(([, n]) => n);
        expect([...counts]).toEqual([...counts].sort((a, b) => b - a));
        const summed = counts.reduce((a, b) => a + b, 0);
        expect(summed).toBe(FIXTURE.length);
    });

    it('breaks a pack tie by name — exercised on an actual tie', () => {
        // The mixed fixture has counts 3/2/1 and never hits the tie-break, so
        // the previous version of this test asserted a branch it never reached.
        const tied = buildCandidatesReport([
            cmd('one', 'zulu'),
            cmd('two', 'alpha'),
        ]);
        expect(tied.byPack.map(([p]) => p)).toEqual(['alpha', 'zulu']);
    });

    it('is byte-stable across input permutations — the report is a set view', () => {
        const shuffled = [...FIXTURE].reverse();
        expect(renderCandidates(buildCandidatesReport(shuffled)))
            .toBe(renderCandidates(buildCandidatesReport(FIXTURE)));
    });
});

describe('buildCandidatesReport — empty estate', () => {
    it('reports a measured zero rather than throwing or omitting sections', () => {
        const empty = buildCandidatesReport([]);
        expect(empty.total).toBe(0);
        expect(empty.absorbedNames).toEqual([]);
        expect(empty.noIntent).toEqual([]);
        expect(empty.byPack).toEqual([]);
        const text = renderCandidates(empty);
        // An absent section would let a real zero read as a missing check.
        expect(text).toContain('measured zero');
    });
});

describe('renderCandidates — the honesty band', () => {
    const text = renderCandidates(buildCandidatesReport(FIXTURE));

    it('states up front that it decides nothing', () => {
        expect(text.split('\n')[0]).toMatch(/report-only/i);
    });

    it('names the usage-evidence owner it deliberately does not import', () => {
        expect(text).toContain('utilization_report');
    });

    it('warns that both census snapshots are dated, not current', () => {
        expect(text).toContain('docs/SKILL_CENSUS.md');
        expect(text).toContain('docs/artefact-census.md');
        expect(text).toMatch(/point-in-time|do not\s+read their numbers as current/i);
    });

    it('hands the reduction targets to their owning roadmaps, all of them', () => {
        for (const owner of REDUCTION_OWNERS) expect(text).toContain(owner);
        expect(REDUCTION_OWNERS.length).toBeGreaterThan(0);
    });

    it('never presents itself as a prune instruction', () => {
        // Assert the exported contract, not a hand-copied sentence — a reworded
        // disclaimer stays covered, a DELETED one fails.
        expect(text).toContain(REPORT_ONLY_NOTICE);
    });

    it('states that the absorbed-name bucket is NOT a retirement class', () => {
        // The defect this pins: the bucket was first labelled "deprecation
        // shims", i.e. the exact inverse of what `replaces` means.
        expect(text).not.toMatch(/deprecation shims +\d/);
        expect(text).toMatch(/NOT a retirement class/);
        expect(text).toContain('absorbed prior names');
    });

    it('reports the real shim class as not computable, with its canonical figure', () => {
        expect(text).toMatch(/deprecation shims\s+not computable/);
        expect(text).toContain('superseded_by');
        expect(text).toContain('0 shims of 196');
    });

    it('renders every absorbed-name row it counted, with its absorbed ids', () => {
        const report: CandidatesReport = buildCandidatesReport(FIXTURE);
        for (const row of report.absorbedNames) {
            expect(text).toContain(row.slug);
            for (const prior of row.replaces) expect(text).toContain(prior);
        }
    });
});

describe('runCommandsLs — --candidates refuses the narrowing flags', () => {
    // Regression: each of these silently produced a whole-estate report, and a
    // typo'd --profile exited 0 where plain `ls` exits 1.
    for (const flag of CANDIDATES_INCOMPATIBLE) {
        it(`exits 1 when combined with ${flag}`, () => {
            const opts: Record<string, unknown> = { candidates: true };
            if (flag === '--pack') opts['pack'] = 'git';
            if (flag === '--visible') opts['visible'] = true;
            if (flag === '--profile') opts['profile'] = 'bogus';
            if (flag === '--expanded') opts['expanded'] = true;
            expect(runCommandsLs(opts)).toBe(1);
        });
    }
});

describe('renderCandidates — an unrecognised visibility value cannot vanish', () => {
    // `visibility` is a free string in the manifest (ADR-092 named the field,
    // nothing pins its domain). Rendering only the three known labels made the
    // printed breakdown silently disagree with the total — the exact false-green
    // shape a report must not have.
    const withUnknown: readonly DiscoveryArtefact[] = [
        cmd('known', 'engineering-base', { visibility: 'visible' }),
        cmd('odd-one', 'engineering-base', { visibility: 'experimental' }),
        cmd('odd-two', 'engineering-base', { visibility: 'experimental' }),
    ];
    const report = buildCandidatesReport(withUnknown);
    const text = renderCandidates(report);

    it('counts the unrecognised value rather than dropping it', () => {
        expect(report.byVisibility['experimental']).toBe(2);
        const summed = Object.values(report.byVisibility).reduce((a, b) => a + b, 0);
        expect(summed).toBe(withUnknown.length);
    });

    it('renders it, so the printed breakdown sums to the printed total', () => {
        expect(text).toContain('experimental');
        // Sum only the visibility block: the run of bucket lines directly
        // following the `surface` line. (A wider filter also matched the
        // owning-packs block, which is why the earlier version of this test
        // carried a variable that did not hold what its name claimed.)
        const rows = text.split('\n');
        const start = rows.findIndex((l) => l.startsWith('surface '));
        const block: number[] = [];
        for (const line of rows.slice(start + 1)) {
            const m = line.match(/^ {2}(\S+) +(\d+)$/);
            if (!m) break;
            block.push(Number(m[2]));
        }
        expect(block).toHaveLength(4);
        expect(block.reduce((a, b) => a + b, 0)).toBe(report.total);
    });

    it('keeps the JSON record key order deterministic too, not just the render', () => {
        // The fix first sorted unknowns in the renderer only, leaving the record
        // a --json consumer reads in first-seen order.
        const forward = buildCandidatesReport([
            cmd('a', 'p', { visibility: 'zeta' }),
            cmd('b', 'p', { visibility: 'alpha' }),
        ]);
        const reversed = buildCandidatesReport([
            cmd('b', 'p', { visibility: 'alpha' }),
            cmd('a', 'p', { visibility: 'zeta' }),
        ]);
        expect(Object.keys(forward.byVisibility)).toEqual(Object.keys(reversed.byVisibility));
        expect(Object.keys(forward.byVisibility).slice(-2)).toEqual(['alpha', 'zeta']);
    });

    it('keeps the known labels ahead of the unrecognised one, for byte stability', () => {
        const order = [...text.matchAll(/^ {2}(visible|advanced|internal|experimental) +\d+$/gm)]
            .map((m) => m[1]);
        expect(order[order.length - 1]).toBe('experimental');
    });
});

describe('renderCandidates — the text-mode cap is named, never silent', () => {
    /** One more undocumented command than the cap allows, so truncation bites. */
    const over: readonly DiscoveryArtefact[] = Array.from(
        { length: TEXT_LIST_CAP + 3 },
        (_unused, i) => cmd(`undoc-${String(i).padStart(3, '0')}`, 'engineering-base', { intent: '' }),
    );
    const report = buildCandidatesReport(over);
    const text = renderCandidates(report);

    it('keeps the COUNT honest even though the list is truncated', () => {
        expect(report.noIntent.length).toBe(over.length);
        expect(text).toContain(`no stated intent           ${over.length}`);
    });

    it('states how many rows it withheld, derived from the input', () => {
        expect(text).toContain(`… and ${over.length - TEXT_LIST_CAP} more`);
    });

    it('caps the enumeration at exactly TEXT_LIST_CAP rows', () => {
        const listed = over.filter((c) => text.includes(`  ${c.slug}  (`)).length;
        expect(listed).toBe(TEXT_LIST_CAP);
    });

    it('never caps the structured payload', () => {
        // --json consumers get the whole set; the cap is a text-mode concern.
        expect(report.noIntent).toHaveLength(over.length);
    });

    it('adds no truncation notice when the set fits', () => {
        const fits = renderCandidates(buildCandidatesReport(over.slice(0, TEXT_LIST_CAP)));
        expect(fits).not.toContain('more — the full set is in --json');
    });
});
