import { describe, expect, it } from 'vitest';

import {
    EVIDENCE_REL,
    type LifecycleEvidence,
    assertsSupervision,
    evidenceRefusal,
    normaliseLine,
} from '../../src/scripts/check_supervision_claim_atomicity.js';

/**
 * `road-to-runtime-governance-flip` step 3.4.
 *
 * The gate's own `--self-test` proves the CLI reds on three seeded negatives and
 * passes its positive control. These cases cover the half a self-test cannot
 * reach cheaply: the DISCRIMINATION of the pattern — which sentences are
 * capability claims and which are the adopted policy ADR-249 authorises.
 *
 * That boundary is the whole point of the step. A pattern that also matched the
 * policy statement would make the gate refuse the very sentence Phase 3 was
 * written to publish, and one that matched neither would be decorative.
 */
describe('assertsSupervision — capability claim vs adopted policy vs denial', () => {
    const MUST_MATCH = [
        'The resident process is supervised and auto-restarted.',
        'Our daemon is bounded and isolated.',
        'The collector runs sandboxed.',
        'The background worker stays crash-safe under load.',
        'Every resident process is always available.',
        'The supervisor is lifecycle-managed by the host.',
        // Emphasis is stripped before matching: `\b` does not match inside `**`,
        // so this escaped the first version entirely — a false negative on
        // exactly the formatting a README uses for the words that matter.
        'The resident process is **supervised**.',
        'The `daemon` is _bounded_.',
    ];

    const MUST_NOT_MATCH = [
        // The sentence Phase 3.1 actually publishes. If this ever matches, the
        // gate refuses the policy statement it exists to permit.
        'Resident processes are permitted only under the supervision contract ADR-249 establishes.',
        'ADR-249 establishes a supervision contract for resident processes.',
        'A supervised resident process is permitted in core under four governance conditions.',
        // Historical and negative statements are not present-tense property claims.
        'This package shipped no daemon before 2026-08-27.',
        'Swarm-runtime tools ship a background process by design.',
        // Adjacent vocabulary with no process subject.
        'The build is sandboxed.',
        'Every claim is machine-checked.',
        // DENIALS. The first version matched every one of these, and would have
        // refused a truthful statement that the property does NOT hold — an
        // inversion, not a false positive. Both council seats found it
        // independently; these rows are the regression.
        'The resident process is not supervised.',
        'The daemon is never supervised.',
        'No resident process is supervised here.',
        'There is no daemon that is supervised.',
        'The collector is not bounded.',
    ];

    it.each(MUST_MATCH)('matches a present-tense property claim: %s', (line) => {
        expect(assertsSupervision(line)).toBe(true);
    });

    it.each(MUST_NOT_MATCH)('does not match: %s', (line) => {
        expect(assertsSupervision(line)).toBe(false);
    });
});

/**
 * Four evidence conditions, four distinct refusals. They are separate because a
 * suite that ran on a parent commit, a suite that skipped everything, and a
 * suite that mocked the process layer are three different lies — and a gate
 * that collapses them into "the file is there" catches none of them.
 */
describe('evidenceRefusal', () => {
    const HEAD = 'a'.repeat(40);
    const sufficient: LifecycleEvidence = {
        suite: 'supervision-lifecycle',
        revision: HEAD,
        processes_exercised: true,
        cases_run: 12,
        cases_skipped: 1,
    };

    it('accepts sufficient evidence', () => {
        expect(evidenceRefusal(sufficient, HEAD)).toBeNull();
    });

    it('refuses an absent artifact', () => {
        expect(evidenceRefusal(null, HEAD)).toContain('does not exist');
    });

    it('refuses an unnamed suite', () => {
        // Built by omission rather than `suite: undefined` — `exactOptionalPropertyTypes`
        // makes those two different types, and the real artifact omits the key.
        const { suite: _dropped, ...withoutSuite } = sufficient;
        const r = evidenceRefusal(withoutSuite, HEAD);
        expect(r).toContain('names no');
    });

    it('refuses a result from another revision', () => {
        const r = evidenceRefusal({ ...sufficient, revision: 'b'.repeat(40) }, HEAD);
        expect(r).toContain('says nothing about the code being shipped');
    });

    it('refuses a suite that did not exercise real processes', () => {
        const r = evidenceRefusal({ ...sufficient, processes_exercised: false }, HEAD);
        expect(r).toContain('mocked the process layer');
    });

    it('refuses an empty suite', () => {
        const r = evidenceRefusal({ ...sufficient, cases_run: 0, cases_skipped: 0 }, HEAD);
        expect(r).toContain('empty suite is not evidence');
    });

    it('refuses a suite that skipped at least as much as it ran', () => {
        const r = evidenceRefusal({ ...sufficient, cases_run: 4, cases_skipped: 4 }, HEAD);
        expect(r).toContain('skipped at least as much as it ran');
    });

    it('names the artifact path in every refusal it can', () => {
        const { suite: _dropped, ...withoutSuite } = sufficient;
        for (const ev of [
            withoutSuite,
            { ...sufficient, revision: 'c'.repeat(40) },
            { ...sufficient, processes_exercised: false },
            { ...sufficient, cases_run: 0 },
        ]) {
            expect(evidenceRefusal(ev, HEAD)).toContain(EVIDENCE_REL);
        }
    });
});

/**
 * The negation guard, tested as its own unit rather than only through the
 * corpus rows above — because it is the fix for the one defect in this file
 * that inverted the gate's meaning rather than merely widening or narrowing it.
 */
describe('negation guard', () => {
    it('strips markdown emphasis before matching', () => {
        expect(normaliseLine('The **resident process** is _supervised_.')).toBe(
            'The resident process is supervised.',
        );
    });

    it('reads the determiner slot, not only the copula-to-property gap', () => {
        // "not" sits AFTER the copula; "No" sits BEFORE the subject. Two
        // different slots, both of which invert the sentence.
        expect(assertsSupervision('The resident process is not supervised.')).toBe(false);
        expect(assertsSupervision('No resident process is supervised.')).toBe(false);
    });

    it('does not let a negator in a previous clause suppress a real claim', () => {
        // The lookbehind is bounded at 24 chars for exactly this: a denial about
        // one subject must not excuse an assertion about another on the same line.
        expect(
            assertsSupervision(
                'That claim is not the point here, and yet the resident process is supervised.',
            ),
        ).toBe(true);
    });
});

/**
 * Evidence values are TYPED, not coerced. Review found `cases_run: "abc"`
 * passing every comparison — `"abc" <= 0` is false — so an unparsable count read
 * as sufficient evidence.
 */
describe('evidenceRefusal — type discipline', () => {
    const HEAD = 'a'.repeat(40);
    const base = {
        suite: 'supervision-lifecycle',
        revision: HEAD,
        processes_exercised: true,
        cases_run: 12,
        cases_skipped: 1,
    };

    it('refuses a non-integer case count instead of coercing it', () => {
        const r = evidenceRefusal({ ...base, cases_run: 'abc' as unknown as number }, HEAD);
        expect(r).toContain('non-integer');
    });

    it('refuses a numeric string, which the first version compared lexicographically', () => {
        const r = evidenceRefusal({ ...base, cases_run: '12' as unknown as number }, HEAD);
        expect(r).toContain('non-integer');
    });

    it('refuses a negative case count', () => {
        const r = evidenceRefusal({ ...base, cases_run: -5, cases_skipped: -9 }, HEAD);
        expect(r).toContain('negative');
    });

    it('refuses a whitespace-only suite name', () => {
        const r = evidenceRefusal({ ...base, suite: '   ' }, HEAD);
        expect(r).toContain('names no');
    });

    it('distinguishes a malformed artifact from an absent one', () => {
        expect(evidenceRefusal('malformed', HEAD)).toContain('does not parse');
        expect(evidenceRefusal(null, HEAD)).toContain('does not exist');
    });

    it('fails closed when HEAD cannot be determined, rather than reporting a mismatch', () => {
        const r = evidenceRefusal(base, '');
        expect(r).toContain('could not determine HEAD');
    });
});
