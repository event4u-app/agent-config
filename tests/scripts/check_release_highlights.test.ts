/**
 * Highlight plausibility gate (release-truth Phase 2) — the three
 * pre-registered fixtures:
 *
 *   - span with a `fix(security)` commit + curated
 *     `Security and correctness: _none_` → red
 *   - correctly curated head → green
 *   - empty span with `_none_` everywhere → green
 */
import { describe, expect, it } from 'vitest';

import {
    _parse_git_log,
    derive_categories,
    HEAD_LABELS,
    highlight_contradictions,
    parse_curated_head,
    type SpanCommit,
} from '../../src/scripts/check_release_highlights.js';
import { render_release_head } from '../../src/scripts/release.js';

const SHA = 'a'.repeat(40);

function commit(overrides: Partial<SpanCommit>): SpanCommit {
    return {
        sha: SHA,
        subject: 'chore: routine',
        body: '',
        files: [],
        breaking: false,
        ...overrides,
    };
}

const ALL_NONE: Record<string, string> = Object.fromEntries(
    HEAD_LABELS.map((label) => [label, '_none_']),
);

describe('label parity with the generator', () => {
    it('parses every label render_release_head emits, and no other', () => {
        const head = render_release_head({}).join('\n');
        const parsed = parse_curated_head(head)!;
        expect(Object.keys(parsed).sort()).toEqual([...HEAD_LABELS].sort());
        expect(new Set(Object.values(parsed))).toEqual(new Set(['_none_']));
    });
});

describe('highlight_contradictions — pre-registered fixtures', () => {
    it('red: fix(security) commit meets a _none_ security field', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security): confine symlink traversal in catalog walk' }),
        ]);
        const contradictions = highlight_contradictions(ALL_NONE, derived);
        expect(contradictions.map((c) => c.label)).toEqual(['Security and correctness']);
        expect(contradictions[0]!.evidence[0]).toContain('fix(security)');
    });

    it('green: correctly curated head (field filled, not _none_)', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security): confine symlink traversal in catalog walk' }),
        ]);
        const curated = {
            ...ALL_NONE,
            'Security and correctness': 'symlink traversal in the catalog walk confined',
        };
        expect(highlight_contradictions(curated, derived)).toEqual([]);
    });

    it('green: empty span with _none_ everywhere', () => {
        expect(highlight_contradictions(ALL_NONE, derive_categories([]))).toEqual([]);
    });
});

describe('derive_categories — per-label rules', () => {
    it('behaviour changes from breaking commits, rule/schema diffs, removed public surface', () => {
        const derived = derive_categories([
            commit({ subject: 'feat!: change default routing', breaking: true }),
            commit({
                subject: 'feat(rules): tighten scope-control',
                files: [{ status: 'M', path: 'src/rules/scope-control.md' }],
            }),
            commit({
                subject: 'chore: drop the intent trigger type',
                files: [{ status: 'D', path: 'src/skills/old-skill/SKILL.md' }],
            }),
        ]);
        expect(derived['Behaviour changes']).toHaveLength(3);
        expect(derived['Behaviour changes']!.at(-1)).toContain('removes src/skills/old-skill/SKILL.md');
    });

    it('honest nulls from subject or multi-line body markers', () => {
        const derived = derive_categories([
            commit({ subject: 'docs: record honest null for A3 validator' }),
            commit({ subject: 'chore: verdict', body: 'first line\nrecorded as an honest-null.' }),
        ]);
        expect(derived['Honest nulls']).toHaveLength(2);
    });

    it('default changes from whole-word default/migration subjects only', () => {
        const derived = derive_categories([
            commit({ subject: 'feat: flip subagents.auto default to on' }),
            commit({ subject: 'fix: defaulting logic refactor' }), // no whole-word match
        ]);
        expect(derived['Default changes + migration']).toHaveLength(1);
    });

    it('never derives Known limitations', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security)!: everything at once — known limitation' }),
        ]);
        expect(derived['Known limitations']).toEqual([]);
    });
});

describe('_parse_git_log', () => {
    it('parses records with name-status lines and multi-line bodies', () => {
        const raw =
            `\u001e${SHA}\u001ffix(security): patch walk\u001fbody line 1\n` +
            'body line 2 with honest null marker\n' +
            'M\tsrc/rules/x.md\n' +
            `D\tsrc/skills/gone/SKILL.md\n` +
            `\u001e${'b'.repeat(40)}\u001fchore: noop\u001f\n`;
        const commits = _parse_git_log(raw);
        expect(commits).toHaveLength(2);
        expect(commits[0]!.files).toEqual([
            { status: 'M', path: 'src/rules/x.md' },
            { status: 'D', path: 'src/skills/gone/SKILL.md' },
        ]);
        expect(commits[0]!.body).toContain('honest null marker');
        const derived = derive_categories(commits);
        expect(derived['Security and correctness']).toHaveLength(1);
        expect(derived['Honest nulls']).toHaveLength(1);
    });
});
