/**
 * `test_authorship` — and specifically that ABSENCE resolves to `unknown`.
 *
 * The asymmetry is the whole reason the field exists. The claim it keeps
 * measurable is that a suite written by the same context as the implementation
 * inherits its blind spots, so `from-spec` is the valuable state — and a default
 * that let an absent field read as `from-spec` would report the claim as
 * satisfied by silence, which is the failure this test pins.
 *
 * Seen RED before the change landed: with `resolveTestAuthorship` returning the
 * raw value, the absent case yields `undefined` and the first assertion fails.
 * Recorded because a test nobody has watched fail is a claim, not evidence —
 * which is the same gate this roadmap's Phase 0.3 census applied to the tree.
 */
import { describe, expect, it } from 'vitest';

import {
    resolveTestAuthorship,
    RESPONSE_REQUIRED_FIELDS,
    TEST_AUTHORSHIP,
    type TestAuthorship,
} from '../../src/scripts/_lib/subagent_response.js';

describe('test_authorship — absence is unknown, never the valuable state', () => {
    it('an absent field resolves to unknown', () => {
        expect(resolveTestAuthorship({ summary: 's' })).toBe('unknown');
    });

    it('a null or non-object envelope resolves to unknown', () => {
        expect(resolveTestAuthorship(null)).toBe('unknown');
        expect(resolveTestAuthorship('from-spec')).toBe('unknown');
    });

    it('each declared value round-trips', () => {
        for (const v of ['from-spec', 'from-diff', 'unknown'] as TestAuthorship[]) {
            expect(resolveTestAuthorship({ test_authorship: v })).toBe(v);
        }
    });

    it('an unrecognised value resolves to unknown rather than throwing', () => {
        // A producer emitting `from_spec` with an underscore must show up in the
        // distribution as unrecorded, not stop a dispatch. The report is what
        // surfaces it: a spike of `unknown` IS the finding that the field is not
        // reaching its producers.
        expect(resolveTestAuthorship({ test_authorship: 'from_spec' })).toBe('unknown');
        expect(resolveTestAuthorship({ test_authorship: '' })).toBe('unknown');
    });

    it('the enum is exactly three states', () => {
        expect([...TEST_AUTHORSHIP].sort()).toEqual(['from-diff', 'from-spec', 'unknown']);
    });

    it('it is NOT a required contract field', () => {
        // RESPONSE_REQUIRED_FIELDS is calibrated against a recorded ledger
        // equivalence (every `fail` carries error_count: 5). A sixth required
        // field would break that, and a metric is not worth invalidating a
        // measurement for.
        expect(RESPONSE_REQUIRED_FIELDS).not.toContain('test_authorship');
        expect(RESPONSE_REQUIRED_FIELDS.length).toBe(5);
    });
});
