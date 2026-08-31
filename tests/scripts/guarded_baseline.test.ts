// Tests for the `guarded-baseline` step state (council 2026-08-31, 2/2
// convergent: anthropic/claude-sonnet-4-5 + openai/codex-default, option C).
//
// Both seats made the TOOLING a condition of the verdict — "C is acceptable only
// if its tooling lands atomically" — so what is pinned here is the enforcement,
// not the vocabulary: the four rejections, and the staleness trigger. The two
// consumer-level obligations (excluded from completed counts, blocks archival)
// are driven end-to-end through the real CLIs in
// `update_roadmap_progress.test.ts` and `archive_completed_roadmaps.test.ts`.
//
// Every guard below is paired with its POLARITY case — a well-formed record that
// must produce NO finding. A rejection count means nothing unless the same
// detector is known to stay silent on the legal shape.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    GUARDED_CATEGORIES,
    guardedBaselineProblems,
    guardedBaselineStaleness,
    parseGuardedBaselines,
    reportGuardedBaselines,
} from '../../src/agent-src/scripts/guarded_baseline.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** A well-formed guarded step. `over` replaces individual evidence lines. */
function fixture(over: Partial<Record<string, string>> = {}, glyph = ' '): string {
    const fields: Record<string, string> = {
        category: 'future-mechanism',
        scope: 'src/scripts/council_cli.ts',
        command: 'npx vitest run tests/scripts/ai_council/council_topology_surface.test.ts',
        red_proof: 'sabotage 2026-08-31 — 2 tests RED, restored GREEN',
        sabotage_model: 'added a --topology entry to the run option table',
        // Deliberately a path that does NOT exist: the guard is written against
        // its absence, so a fresh tree must read as not-stale.
        recheck_when: 'src/scripts/ai_council/topology_selector.ts',
        discharged_ac: 'the baseline is pinned and RED-proven',
        pending_ac: 'the constraint once topology selection exists',
        ...over,
    };
    const lines = [
        '# Fixture',
        '',
        '## Phase 12 — UX simplification',
        '',
        `- [${glyph}] <!-- roadmap-status: guarded-baseline -->`,
        '      **12.1** Keep `/council` as the main explicit user concept.',
        '      ```yaml',
        '      guarded_baseline:',
    ];
    for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) lines.push(`        ${k}: ${v}`);
    }
    lines.push('      ```', '');
    return lines.join('\n');
}

describe('guarded-baseline — the parser', () => {
    it('reads the annotation, the step label and every evidence field', () => {
        const items = parseGuardedBaselines(fixture());
        expect(items).toHaveLength(1);
        const it0 = items[0]!;
        expect(it0.glyph).toBe(' ');
        expect(it0.hasBlock).toBe(true);
        expect(it0.line).toBe(5);
        expect(it0.label).toContain('12.1');
        expect(it0.fields['category']).toBe('future-mechanism');
        expect(it0.fields['red_proof']).toContain('RED');
    });

    it('is silent on a roadmap that carries no annotation', () => {
        expect(parseGuardedBaselines('# R\n\n## Phase 1 — Go\n\n- [ ] open\n- [x] done\n')).toEqual(
            [],
        );
    });

    it('does not collide with a `[~]` deferred step on the following line', () => {
        // The sweep's DEFERRED_STEP_RE pins `[~]`; the span must stop there
        // rather than swallowing the deferral's own annotation.
        const text = fixture() + '- [~] deferred elsewhere\n';
        const items = parseGuardedBaselines(text);
        expect(items).toHaveLength(1);
        expect(items[0]!.glyph).toBe(' ');
    });
});

describe('guarded-baseline — the four rejections', () => {
    it('POLARITY: a well-formed record produces no finding', () => {
        expect(guardedBaselineProblems(parseGuardedBaselines(fixture()))).toEqual([]);
    });

    it('rejects a record with no `red_proof` — an unproven baseline is an ordinary open item', () => {
        const problems = guardedBaselineProblems(
            parseGuardedBaselines(fixture({ red_proof: undefined })),
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('red_proof');
    });

    it('rejects an empty `red_proof` the same way a missing one is rejected', () => {
        const problems = guardedBaselineProblems(parseGuardedBaselines(fixture({ red_proof: '' })));
        expect(problems.some((p) => p.includes('red_proof'))).toBe(true);
    });

    it('rejects a category outside the two legal values', () => {
        const problems = guardedBaselineProblems(
            parseGuardedBaselines(fixture({ category: 'pre-registration' })),
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('pre-registration');
        expect(problems[0]).toContain('future-mechanism');
    });

    it('rejects an absent category rather than defaulting it', () => {
        const problems = guardedBaselineProblems(
            parseGuardedBaselines(fixture({ category: undefined })),
        );
        expect(problems.some((p) => p.includes('no `category`'))).toBe(true);
    });

    it.each(GUARDED_CATEGORIES)('accepts the legal category %s', (category) => {
        expect(guardedBaselineProblems(parseGuardedBaselines(fixture({ category })))).toEqual([]);
    });

    it('rejects the annotation on a `- [x]` line — only the real mechanism permits `[x]`', () => {
        const problems = guardedBaselineProblems(parseGuardedBaselines(fixture({}, 'x')));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('[x]');
        expect(problems[0]).toContain('UNCHECKED');
    });

    it('rejects the annotation on a `- [~]` line too', () => {
        const problems = guardedBaselineProblems(parseGuardedBaselines(fixture({}, '~')));
        expect(problems.some((p) => p.includes('[~]'))).toBe(true);
    });

    it('rejects a LIST ITEM carrying the annotation with no checkbox', () => {
        const problems = guardedBaselineProblems(
            parseGuardedBaselines(
                '# R\n\n## Phase 1 — Go\n\n- <!-- roadmap-status: guarded-baseline -->\n',
            ),
        );
        expect(problems.some((p) => p.includes('not on a checkbox step'))).toBe(true);
    });

    // The three shapes that must stay INVISIBLE, measured against the real tree:
    // the roadmap specifying this state names the annotation in its own verdict
    // prose, and it reddened its own dashboard before these three were pinned.
    it.each([
        ['prose naming the annotation in an inline code span', 'The box stays `- [ ]` and carries `<!-- roadmap-status: guarded-baseline -->`.'],
        ['a prose line with no list marker', '<!-- roadmap-status: guarded-baseline -->'],
    ])('ignores %s', (_label, line) => {
        expect(parseGuardedBaselines(`# R\n\n## Phase 1 — Go\n\n${line}\n`)).toEqual([]);
    });

    it('ignores a fenced documentation example of the whole shape', () => {
        const text = [
            '# R',
            '',
            '## Phase 1 — Go',
            '',
            '```md',
            '- [ ] <!-- roadmap-status: guarded-baseline -->',
            '      **7.3** the documented example',
            '```',
            '',
        ].join('\n');
        expect(parseGuardedBaselines(text)).toEqual([]);
    });

    it('rejects a record with no evidence block at all', () => {
        const text = [
            '# R',
            '',
            '## Phase 1 — Go',
            '',
            '- [ ] <!-- roadmap-status: guarded-baseline -->',
            '      **1.1** no evidence anywhere',
            '',
        ].join('\n');
        const problems = guardedBaselineProblems(parseGuardedBaselines(text));
        expect(problems.some((p) => p.includes('no adjacent `guarded_baseline:`'))).toBe(true);
    });
});

describe('guarded-baseline — staleness', () => {
    it('POLARITY: a trigger that does not exist yet is not stale', () => {
        const s = guardedBaselineStaleness(parseGuardedBaselines(fixture()), REPO_ROOT);
        expect(s.stale).toEqual([]);
    });

    it('marks the evidence stale once the `recheck_when` path exists in the tree', () => {
        const s = guardedBaselineStaleness(
            parseGuardedBaselines(fixture({ recheck_when: 'src/scripts/council_cli.ts' })),
            REPO_ROOT,
        );
        expect(s.stale).toHaveLength(1);
        expect(s.stale[0]).toContain('src/scripts/council_cli.ts');
        expect(s.stale[0]).toContain('now exists');
    });

    it('reports a bare symbol trigger as not machine-checkable rather than as not-stale', () => {
        const s = guardedBaselineStaleness(
            parseGuardedBaselines(fixture({ recheck_when: 'selectTopology' })),
            REPO_ROOT,
        );
        expect(s.stale).toEqual([]);
        expect(s.unverifiable).toHaveLength(1);
        expect(s.unverifiable[0]).toContain('selectTopology');
    });
});

describe('guarded-baseline — the estate report', () => {
    it('renders no section and no output when nothing is annotated', () => {
        const out: string[] = [];
        const r = reportGuardedBaselines([], REPO_ROOT, (s) => out.push(s));
        expect(r.section).toBe('');
        expect(r.problems).toBe(0);
        expect(out).toEqual([]);
    });
});
