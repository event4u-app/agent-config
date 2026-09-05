/**
 * Polarity of the verification-tampering detector — BOTH directions.
 *
 * A detector only ever seen fire has unknown specificity; one only ever seen
 * silent has unknown sensitivity. Every case below is driven off the committed
 * corpus, so the fixture set and the assertions cannot drift apart: deleting a
 * fixture removes its case and trips the manifest-count floor at the bottom.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    analyze,
    assertionStrength,
    loadCorpus,
    normalizeAssertion,
    scanDiff,
    verdictIsStale,
} from '../../src/scripts/detect_verification_tampering.js';
import {
    TAMPER_DETECTOR_IDS,
    parseAllowDeclarations,
} from '../../src/scripts/_lib/tamper_vocabulary.js';

const CORPUS = path.resolve(__dirname, '../fixtures/tamper-corpus');
const fixtures = loadCorpus(CORPUS);
const read = (rel: string): string => fs.readFileSync(path.join(CORPUS, rel), 'utf-8');

describe('the corpus itself', () => {
    it('covers every id in the closed vocabulary with a positive fixture', () => {
        const covered = new Set(fixtures.filter((f) => f.kind === 'positive').flatMap((f) => f.expect));
        expect([...covered].sort()).toEqual([...TAMPER_DETECTOR_IDS].sort());
    });

    it('carries both kinds of negative, so neither half of polarity is untested', () => {
        const negatives = fixtures.filter((f) => f.kind === 'negative');
        const kinds = new Set(negatives.map((f) => (f as { negative_kind?: string }).negative_kind));
        expect(kinds).toEqual(new Set(['shape', 'declared']));
    });

    it('has not shrunk below the committed floor', () => {
        expect(fixtures.filter((f) => f.kind === 'positive').length).toBeGreaterThanOrEqual(7);
        expect(fixtures.filter((f) => f.kind === 'negative').length).toBeGreaterThanOrEqual(7);
    });
});

describe('sensitivity — every positive fires, by id and with a location', () => {
    for (const f of fixtures.filter((x) => x.kind === 'positive')) {
        it(`fires ${f.expect.join(', ')} on ${f.id}`, () => {
            const a = analyze(read(f.diff), f.message, null);
            expect(a.findings.map((x) => x.id).sort()).toEqual([...f.expect].sort());
            for (const finding of a.findings) {
                expect(finding.file).not.toBe('');
                expect(finding.line).toBeGreaterThan(0);
                expect(finding.evidence.trim()).not.toBe('');
            }
            expect(a.outcome).toBe('violations');
        });
    }
});

describe('specificity — every negative stays clean', () => {
    for (const f of fixtures.filter((x) => x.kind === 'negative')) {
        it(`stays silent on ${f.id}`, () => {
            const a = analyze(read(f.diff), f.message, null);
            expect(a.findings).toEqual([]);
            expect(a.outcome).toBe('clean');
        });
    }
});

describe('the declared negatives are silenced by the declaration, not by a blind spot', () => {
    for (const f of fixtures.filter(
        (x) => (x as { negative_kind?: string }).negative_kind === 'declared',
    )) {
        it(`${f.id} DOES fire once its declaration is removed`, () => {
            const withoutDeclaration = analyze(read(f.diff), 'fix: green it', null);
            expect(withoutDeclaration.findings.length).toBeGreaterThan(0);
            expect(withoutDeclaration.outcome).toBe('violations');
        });
    }
});

describe('the escape hatch cannot become an amnesty', () => {
    it('is scoped to the id it names', () => {
        const a = analyze(
            read('diffs/test-file-deleted.diff'),
            'fix: x\n\ntamper-allow: assertion-weakened — a real reason of sufficient length',
            null,
        );
        expect(a.findings.map((x) => x.id)).toEqual(['test-file-deleted']);
    });

    it('rejects a reason too short to be one', () => {
        const parsed = parseAllowDeclarations('tamper-allow: test-file-deleted — n/a');
        expect(parsed.allowed.size).toBe(0);
        expect(parsed.malformed).toHaveLength(1);
    });

    it('reports an unknown id instead of silently suppressing or silently ignoring', () => {
        const a = analyze(
            read('diffs/test-file-deleted.diff'),
            'fix: x\n\ntamper-allow: test-files-deleted — a plausible reason with a typo in the id',
            null,
        );
        expect(a.malformedAllows).toHaveLength(1);
        expect(a.findings.map((x) => x.id)).toEqual(['test-file-deleted']);
        expect(a.outcome).toBe('violations');
    });

    it('accepts a plain hyphen as the separator', () => {
        const parsed = parseAllowDeclarations(
            'tamper-allow: test-file-deleted - the subject function is deleted in this same diff',
        );
        expect([...parsed.allowed]).toEqual(['test-file-deleted']);
    });
});

describe('the strength ladder is read in both directions', () => {
    it('ranks an exact assertion above an existence one', () => {
        expect(assertionStrength('expect(total).toBe(42);')).toBeGreaterThan(
            assertionStrength('expect(total).toBeDefined();'),
        );
    });

    it('normalizes two literals of the same assertion to one shape', () => {
        expect(normalizeAssertion('expect(t).toBe(42);')).toBe(normalizeAssertion('expect(t).toBe(41);'));
    });

    it('does not normalize two different matchers to one shape', () => {
        expect(normalizeAssertion('expect(t).toBe(42);')).not.toBe(
            normalizeAssertion('expect(t).toBeDefined();'),
        );
    });
});

describe('phantom verification', () => {
    it('reports a green verdict that predates the last edit as its own outcome', () => {
        const verdict = JSON.parse(read('verdicts/stale-green.json')) as Record<string, string>;
        expect(verdictIsStale(verdict)).toBe(true);
        const a = analyze(read('diffs/neg-assertion-added.diff'), 'test: add a guard', verdict);
        expect(a.outcome).toBe('stale_verdict');
        expect(a.outcome).not.toBe('clean');
    });

    it('reports a stale RED as stale too, so the outcome does not depend on which way it landed', () => {
        const verdict = JSON.parse(read('verdicts/stale-red.json')) as Record<string, string>;
        expect(verdictIsStale(verdict)).toBe(true);
    });

    it('passes a verdict that ran after the last edit', () => {
        const verdict = JSON.parse(read('verdicts/fresh-green.json')) as Record<string, string>;
        expect(verdictIsStale(verdict)).toBe(false);
        const a = analyze(read('diffs/neg-assertion-added.diff'), 'test: add a guard', verdict);
        expect(a.outcome).toBe('clean');
    });

    it('does not invent staleness from an absent or unparseable timestamp', () => {
        expect(verdictIsStale({ status: 'green' })).toBe(false);
        expect(verdictIsStale({ ran_at: 'not-a-date', last_edit_at: 'also-not' })).toBe(false);
    });
});

describe('a wholly deleted test file reports once', () => {
    it('does not also report each assertion inside it as removed', () => {
        const found = scanDiff(read('diffs/test-file-deleted.diff'));
        expect(found.map((f) => f.id)).toEqual(['test-file-deleted']);
    });
});
