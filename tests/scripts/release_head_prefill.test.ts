/**
 * Generator ↔ gate agreement on the curated release head.
 *
 * The regression these pin: `release.ts` wrote `_none_` into all five head
 * fields while `check_release_highlights` rejected exactly that default the
 * moment the span carried evidence. Because every release of this package
 * touches `src/rules/` or `src/scripts/schemas/`, "Behaviour changes" is
 * always substantiated — so every release PR was red on its first run by
 * construction (9.17.0 run 30871194277, 9.18.0 run 30909511315).
 *
 * The load-bearing test is `generated head clears the gate`: it runs the real
 * generator output through the real gate over a span shaped like a normal
 * release of this repo, and asserts zero contradictions.
 */
import { describe, expect, it } from 'vitest';

import {
    DERIVED_MARKER,
    DERIVED_SHA_CAP,
    HEAD_LABELS,
    HEAD_NONE,
    type SpanCommit,
    derive_category_hits,
    publication_blockers,
    render_derived_head_values,
    stale_draft_labels,
} from '../../src/scripts/_lib/release_highlights.js';
import {
    highlight_contradictions,
    parse_curated_head,
} from '../../src/scripts/check_release_highlights.js';
import {
    RELEASE_HEAD_CAP_LINES,
    release_head_line_count,
    render_release_head,
} from '../../src/scripts/release.js';

function commit(over: Partial<SpanCommit> & { sha: string; subject: string }): SpanCommit {
    return {
        body: '',
        files: [],
        breaking: false,
        ...over,
    };
}

/** A span shaped like a routine release of this repo. */
const TYPICAL_SPAN: SpanCommit[] = [
    commit({
        sha: '71c3527aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        subject: 'refactor(rules): merge brand pair, disjoin security triggers',
        files: [{ status: 'M', path: 'src/rules/brand-consistency.md' }],
    }),
    commit({
        sha: 'b3cc0adbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        subject: "fix(skills): keep required sections in existing-ui-audit's body",
        files: [{ status: 'D', path: 'src/skills/existing-ui-audit/references/output.md' }],
    }),
    commit({
        sha: '6c6fc15ccccccccccccccccccccccccccccccccc',
        subject: 'docs(review): binding R2 verdict for the merge scope',
        body: 'The reviewer returned an honest-null for this scope.',
    }),
];

describe('render_derived_head_values', () => {
    it('fills every label the span substantiates', () => {
        const values = render_derived_head_values(derive_category_hits(TYPICAL_SPAN));
        expect(Object.keys(values).sort()).toEqual(
            ['Behaviour changes', 'Honest nulls', 'Security and correctness'].sort(),
        );
    });

    it('cites the substantiating SHAs AND the commit subjects behind them', () => {
        const values = render_derived_head_values(derive_category_hits(TYPICAL_SPAN));
        const behaviour = values['Behaviour changes']!;
        expect(behaviour).toContain('71c3527');
        expect(behaviour).toContain('b3cc0ad');
        // The subject, not the name of the rule that classified it. "rule/schema
        // diffs in 71c3527" restates why the classifier fired; the claim a
        // reader can use is the sentence the committer wrote.
        expect(behaviour).toContain('merge brand pair, disjoin security triggers');
        // And the conventional-commit prefix is dropped: `refactor(rules):` is
        // metadata the changelog's own commit list already carries.
        expect(behaviour).not.toContain('refactor(rules):');
    });

    it('emits NO draft marker — the writer never produces text that cannot ship', () => {
        // The whole subject of the 2026-09-03 fix. Every release of this package
        // touches `src/rules/` or `src/scripts/schemas/`, so **Behaviour
        // changes** is always substantiated; with the marker in the emission and
        // a gate refusing the marker, every release halted BY CONSTRUCTION. This
        // is the assertion that keeps that combination from returning.
        const values = render_derived_head_values(derive_category_hits(TYPICAL_SPAN));
        for (const [label, value] of Object.entries(values)) {
            expect(value, `${label} carries the draft marker`).not.toContain(DERIVED_MARKER);
        }
    });

    it('renders a section the publication guards accept — no halt on the writer output', () => {
        // One rung above the marker assertion: not "the marker is absent" but
        // "the four guard sites would let this through". Asserting the blockers
        // directly is what pins the property the operator actually feels.
        const head = render_release_head(
            render_derived_head_values(derive_category_hits(TYPICAL_SPAN)),
        ).join('\n');
        expect(publication_blockers(head, '9.9.9')).toEqual([]);
    });

    it('omits a label the span does not substantiate, so `_none_` survives there', () => {
        const values = render_derived_head_values(derive_category_hits(TYPICAL_SPAN));
        expect(values['Known limitations']).toBeUndefined();
        const head = render_release_head(values).join('\n');
        expect(head).toContain(`- **Known limitations:** ${HEAD_NONE}`);
    });

    it('never emits a value for a label with no evidence at all', () => {
        const values = render_derived_head_values(derive_category_hits([]));
        expect(values).toEqual({});
    });

    it('caps cited SHAs and states the remainder instead of truncating silently', () => {
        const wide = Array.from({ length: DERIVED_SHA_CAP + 3 }, (_, i) =>
            commit({
                sha: `${String(i).repeat(7)}0000000000000000000000000000000`,
                subject: `fix(rules): change ${i}`,
                files: [{ status: 'M', path: 'src/rules/some-rule.md' }],
            }),
        );
        const line = render_derived_head_values(derive_category_hits(wide))['Behaviour changes']!;
        expect(line).toContain('+3 more');
        // Count citations, not commas — the reason prose carries one itself.
        expect(line.match(/\b[0-9a-f]{7}\b/gu) ?? []).toHaveLength(DERIVED_SHA_CAP);
    });
});

describe('generated head clears the gate', () => {
    it('produces no contradiction for a span that carries evidence', () => {
        const hits = derive_category_hits(TYPICAL_SPAN);
        const head = render_release_head(render_derived_head_values(hits)).join('\n');
        const curated = parse_curated_head(head);
        expect(curated).not.toBeNull();

        const derived: Record<string, string[]> = {};
        for (const label of HEAD_LABELS) {
            derived[label] = (hits[label] ?? []).map((h) => `${h.sha.slice(0, 7)} ${h.text}`);
        }
        expect(highlight_contradictions(curated!, derived)).toEqual([]);
    });

    it('still contradicts when a human edits a substantiated line back to `_none_`', () => {
        const hits = derive_category_hits(TYPICAL_SPAN);
        const values = render_derived_head_values(hits);
        values['Behaviour changes'] = HEAD_NONE;
        const curated = parse_curated_head(render_release_head(values).join('\n'))!;

        const derived: Record<string, string[]> = {};
        for (const label of HEAD_LABELS) {
            derived[label] = (hits[label] ?? []).map((h) => `${h.sha.slice(0, 7)} ${h.text}`);
        }
        const found = highlight_contradictions(curated, derived);
        expect(found.map((c) => c.label)).toEqual(['Behaviour changes']);
    });

    it('keeps the pre-filled head inside the operator-facing line cap', () => {
        const head = render_release_head(
            render_derived_head_values(derive_category_hits(TYPICAL_SPAN)),
        );
        expect(release_head_line_count(head)).toBeLessThanOrEqual(RELEASE_HEAD_CAP_LINES);
    });
});

describe('stale_draft_labels', () => {
    it('names every label carrying a HAND-WRITTEN marker', () => {
        // Rewritten 2026-09-03. This used to feed the GENERATOR's output, which
        // is exactly what stopped carrying the marker — so the old form asserted
        // a state the writer can no longer produce. The function is not dead:
        // its four guard sites now cover a marker somebody types by hand, and
        // that is the state fed here. Deleting the test would have dropped the
        // only coverage of the marker path.
        const values = render_derived_head_values(derive_category_hits(TYPICAL_SPAN));
        values['Behaviour changes'] = `${DERIVED_MARKER} someone typed this by hand.`;
        values['Honest nulls'] = `${DERIVED_MARKER} and this one too.`;
        const curated = parse_curated_head(render_release_head(values).join('\n'))!;
        expect(stale_draft_labels(curated).sort()).toEqual(
            ['Behaviour changes', 'Honest nulls'].sort(),
        );
    });

    it('is silent once a human has rewritten the lines', () => {
        const curated = parse_curated_head(
            render_release_head({
                'Behaviour changes': 'the brand rules merged; one rule loads where two did.',
            }).join('\n'),
        )!;
        expect(stale_draft_labels(curated)).toEqual([]);
    });
});
