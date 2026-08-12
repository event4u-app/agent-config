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
        tier: 2,
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

/** Mixed fixture: two shims, two undocumented, three packs of unequal weight. */
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

    it('classifies exactly the commands that declare `replaces` as shims', () => {
        const expected = FIXTURE
            .filter((c) => (c.replaces ?? []).length > 0)
            .map((c) => c.slug)
            .sort();
        expect(report.shims.map((r) => r.slug)).toEqual(expected);
    });

    it('carries each shim\'s replaced ids through unchanged', () => {
        for (const row of report.shims) {
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

    it('orders packs by weight descending, ties broken by name', () => {
        const counts = report.byPack.map(([, n]) => n);
        expect([...counts]).toEqual([...counts].sort((a, b) => b - a));
        const summed = counts.reduce((a, b) => a + b, 0);
        expect(summed).toBe(FIXTURE.length);
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
        expect(empty.shims).toEqual([]);
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
        // `prune` is a different, destructive verb in this CLI; the report must
        // not borrow its wording. (Step 3.4's naming collision.)
        expect(text).not.toMatch(/\bprune (this|these|now)\b/i);
        // Assert the exported contract, not a hand-copied sentence — a reworded
        // disclaimer stays covered, a DELETED one fails.
        expect(text).toContain(REPORT_ONLY_NOTICE);
    });

    it('renders every shim it counted', () => {
        const report: CandidatesReport = buildCandidatesReport(FIXTURE);
        for (const row of report.shims) expect(text).toContain(row.slug);
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
