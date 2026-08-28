import { describe, expect, it } from 'vitest';

import {
    EVIDENCE_REL,
    type LifecycleEvidence,
    SUPERVISION_CLAIM_RE,
    evidenceRefusal,
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
describe('SUPERVISION_CLAIM_RE — capability claim vs adopted policy', () => {
    const MUST_MATCH = [
        'The resident process is supervised and auto-restarted.',
        'Our daemon is bounded and isolated.',
        'The collector runs sandboxed.',
        'The background worker stays crash-safe under load.',
        'Every resident process is always available.',
        'The supervisor is lifecycle-managed by the host.',
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
    ];

    it.each(MUST_MATCH)('matches a present-tense property claim: %s', (line) => {
        expect(SUPERVISION_CLAIM_RE.test(line)).toBe(true);
    });

    it.each(MUST_NOT_MATCH)('does not match: %s', (line) => {
        expect(SUPERVISION_CLAIM_RE.test(line)).toBe(false);
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
