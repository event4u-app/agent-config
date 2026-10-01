// Tests for src/scripts/report_evidence_temperature.ts.
//
// Every assertion below pins one narrowing or one widening that the census
// depends on for correctness. The expensive mistake this instrument can make is
// classing a live file cold, so the tests that matter most are the ones that
// prove a citation form is NOT missed: a bare prose mention, a relative link, a
// JSON value. The cheap mistake — a dead file staying hot — is asserted too, but
// only to keep the rule honest about which direction it errs in.
import { describe, expect, it } from 'vitest';

import {
    citationKeys,
    classify,
    coldPathsIn,
    extractPathTokens,
    normaliseToken,
    parseAddDates,
    referrerClass,
    scanRootFor,
    subtreeOf,
} from '../../src/scripts/report_evidence_temperature.js';

describe('extractPathTokens — the citation forms that must not be missed', () => {
    it('reads a path out of bare prose, not only out of backticks', () => {
        // The resolver-misses-a-citation-form risk is the one that classes a
        // live file cold. Prose is where paths most often appear unquoted.
        expect(extractPathTokens('see agents/evidence/analysis/x.md for the figure')).toContain(
            'agents/evidence/analysis/x.md',
        );
    });

    it('reads a relative markdown link and an absolute path to the same key', () => {
        expect(extractPathTokens('[x](../../evidence/analysis/x.md)')).toContain('evidence/analysis/x.md');
        expect(extractPathTokens('`./analysis/x.md`')).toContain('analysis/x.md');
    });

    it('reads a path out of a JSON value', () => {
        expect(extractPathTokens('{"report": "agents/evidence/reports/y.json"}')).toContain(
            'agents/evidence/reports/y.json',
        );
    });

    it('reads a bare filename, because that is how half the tree is cited', () => {
        expect(extractPathTokens('recorded in cross-model-baseline.md')).toContain('cross-model-baseline.md');
    });

    it('does not invent a token out of a word with a dot in it', () => {
        expect(extractPathTokens('version 1.2 of the thing')).toEqual([]);
        expect(extractPathTokens('e.g. a sentence.')).toEqual([]);
    });

    it('does not truncate a longer extension into a known one', () => {
        // `x.mdx` must not register as `x.md`, or an unrelated file warms a
        // cold one and the move that follows is wrong.
        expect(extractPathTokens('see x.mdx')).toEqual([]);
    });
});

describe('normaliseToken', () => {
    it('collapses leading relative segments so one key serves every spelling', () => {
        expect(normaliseToken('../../evidence/x.md')).toBe('evidence/x.md');
        expect(normaliseToken('./x.md')).toBe('x.md');
    });
});

describe('citationKeys', () => {
    it('offers every suffix, so a deep path cited from anywhere still matches', () => {
        expect(citationKeys('agents/evidence/analysis/x.md')).toEqual([
            'agents/evidence/analysis/x.md',
            'evidence/analysis/x.md',
            'analysis/x.md',
            'x.md',
        ]);
    });
});

describe('referrerClass — what makes a citation live', () => {
    it('calls an archived or skipped roadmap historical, not live', () => {
        expect(referrerClass('agents/roadmaps/archive/road-to-x.md')).toBe('archived');
        expect(referrerClass('agents/roadmaps/skipped/road-to-y.md')).toBe('archived');
    });

    it('calls an active, later or stub roadmap live', () => {
        expect(referrerClass('agents/roadmaps/road-to-x.md')).toBe('live');
        expect(referrerClass('agents/roadmaps/later/road-to-x.md')).toBe('live');
        expect(referrerClass('agents/roadmaps/stubs/road-to-x.md')).toBe('live');
    });

    it('calls a contract, a gate and a test live', () => {
        expect(referrerClass('docs/contracts/agents-layout.md')).toBe('live');
        expect(referrerClass('src/scripts/check_references.ts')).toBe('live');
        expect(referrerClass('tests/scripts/x.test.ts')).toBe('live');
    });

    it('separates a citation from inside the evidence tree', () => {
        // Not live — but not nothing either: it is a link that would break.
        expect(referrerClass('agents/evidence/analysis/x.md')).toBe('evidence');
    });
});

describe('classify — the three classes', () => {
    it('is cold only with zero inbound references from anywhere', () => {
        expect(classify([], null, false)).toEqual({ temperature: 'cold', reason: 'uncited' });
    });

    it('is warm when the only citation is historical or intra-evidence', () => {
        expect(classify([{ from: 'agents/roadmaps/archive/a.md', cls: 'archived' }], null, false)).toEqual({
            temperature: 'warm',
            reason: 'historical-citation',
        });
        expect(classify([{ from: 'agents/evidence/analysis/a.md', cls: 'evidence' }], null, false)).toEqual({
            temperature: 'warm',
            reason: 'historical-citation',
        });
    });

    it('is hot on one live citation even among many historical ones', () => {
        expect(
            classify(
                [
                    { from: 'agents/roadmaps/archive/a.md', cls: 'archived' },
                    { from: 'docs/contracts/agents-layout.md', cls: 'live' },
                ],
                null,
                false,
            ),
        ).toEqual({ temperature: 'hot', reason: 'live-citation' });
    });

    it('lets a gate scan root outrank a total absence of citations', () => {
        // Phase 1.2's clause: a gate that relies on a file reclassifies it hot.
        expect(classify([], 'reviews', false)).toEqual({ temperature: 'hot', reason: 'scan-root' });
    });

    it('never classes a structural file cold', () => {
        expect(classify([], null, true)).toEqual({ temperature: 'hot', reason: 'structural' });
    });
});

describe('scanRootFor — which directories a gate enumerates', () => {
    it('claims the four corpora a gate walks', () => {
        expect(scanRootFor('agents/evidence/reviews/x.findings.md')).toBe('reviews');
        expect(scanRootFor('agents/evidence/release-findings/16.2.0.json')).toBe('release-findings');
        expect(scanRootFor('agents/evidence/archived-skills/x.md')).toBe('archived-skills');
        expect(scanRootFor('agents/evidence/ratifications/x.md')).toBe('ratifications');
    });

    it('claims no directory a gate merely allows by prefix', () => {
        // `analysis/` is named by two gates as an allowed prefix, not as a
        // corpus they derive a verdict from. Treating it as a scan root would
        // make 292 files hot for a reason that is not true of them.
        expect(scanRootFor('agents/evidence/analysis/x.md')).toBeNull();
        expect(scanRootFor('agents/evidence/reports/x.md')).toBeNull();
    });
});

describe('parseAddDates', () => {
    it('keeps the earliest add, which is the last one a newest-first walk sees', () => {
        const log = ['@2026-10-01', 'agents/evidence/a.md', '', '@2026-01-02', 'agents/evidence/a.md', ''].join('\n');
        expect(parseAddDates(log).get('agents/evidence/a.md')).toBe('2026-01-02');
    });
});

describe('coldPathsIn — reading a previous report back', () => {
    it('recovers exactly the paths a report listed', () => {
        const report = [
            '# x',
            '',
            '```text',
            'agents/evidence/analysis/a.md',
            'agents/evidence/reports/b.md',
            '```',
        ].join('\n');
        expect([...coldPathsIn(report)].sort()).toEqual([
            'agents/evidence/analysis/a.md',
            'agents/evidence/reports/b.md',
        ]);
    });
});

describe('subtreeOf', () => {
    it('names the top-level subtree and the root itself', () => {
        expect(subtreeOf('agents/evidence/reviews/a/b.md')).toBe('reviews');
        expect(subtreeOf('agents/evidence/README.md')).toBe('(root)');
    });
});
