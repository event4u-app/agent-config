/**
 * `failure_mode` as a projection key (road-to-number-truth P4).
 *
 * The point of the field is that membership in the adopter-facing view is a
 * DATA property. If a row's presence there ever became a curatorial decision,
 * the second view would drift from the comparison table it projects — the exact
 * synchronisation liability the field was chosen to avoid.
 */
import { describe, expect, it } from 'vitest';

import { findErrors, loadRows, type Row } from '../../src/scripts/check_comparison.js';

const base: Row = {
    claim: 'A claim.',
    our_evidence: 'docs/comparison.yaml',
    their_evidence: 'Observable about the category.',
    checkable: true,
};

/** Mirrors the filter build_proof uses to decide the second view's membership. */
const inSecondView = (r: Row): boolean => (r.failure_mode ?? '').trim() !== '';

describe('failure_mode — membership is a data property', () => {
    it('includes a row that carries one', () => {
        expect(inSecondView({ ...base, failure_mode: 'Something goes wrong.' })).toBe(true);
    });

    it('excludes a row with no field at all', () => {
        expect(inSecondView(base)).toBe(false);
    });

    it('excludes a row whose field is present but blank', () => {
        // Whitespace must not smuggle a row in with an empty cell.
        expect(inSecondView({ ...base, failure_mode: '   \n  ' })).toBe(false);
    });
});

describe('failure_mode — optional, and never weakens the evidence gate', () => {
    it('a row without the field still validates', () => {
        expect(findErrors([base])).toEqual([]);
    });

    it('a row with the field still validates', () => {
        expect(findErrors([{ ...base, failure_mode: 'Something goes wrong.' }])).toEqual([]);
    });

    it('a populated failure_mode cannot rescue an unresolvable pointer', () => {
        // The new view must not become a way for a cell to reach a public
        // surface without a resolving pointer behind it.
        const errs = findErrors([
            { ...base, our_evidence: 'docs/does-not-exist-anywhere.md', failure_mode: 'Something goes wrong.' },
        ]);
        expect(errs.length).toBe(1);
        expect(errs[0]).toMatch(/our_evidence/);
    });
});

describe('the live rows', () => {
    const rows = loadRows();

    it('all validate', () => {
        expect(findErrors(rows)).toEqual([]);
    });

    it('every populated failure_mode is prose, not a restatement of the claim', () => {
        for (const r of rows.filter(inSecondView)) {
            const fm = (r.failure_mode ?? '').trim();
            expect(fm.length).toBeGreaterThan(20);
            expect(fm).not.toBe(r.claim.trim());
        }
    });
});
