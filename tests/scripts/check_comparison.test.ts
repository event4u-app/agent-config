/**
 * Tests for src/scripts/check_comparison.ts — the B7 comparison-honesty lock.
 *
 * Two layers:
 *  1. Pure `findErrors()` over synthetic rows — proves the falsifiability lock
 *     actually catches an unresolving `our_evidence` pointer and a malformed row.
 *  2. The committed docs/comparison.yaml passes (`main() === 0`) — the real gate
 *     CI runs, asserted here so a rot in the data file fails the suite too.
 */
import { describe, expect, it } from 'vitest';

import { findErrors, loadRows, main, type Row } from '../../src/scripts/check_comparison.js';

describe('check_comparison — findErrors()', () => {
    it('passes a row whose our_evidence resolves', () => {
        const rows: Row[] = [
            {
                claim: 'No runtime.',
                our_evidence: 'docs/CLAIMS.md',
                their_evidence: 'The category ships a daemon.',
                checkable: true,
            },
        ];
        expect(findErrors(rows)).toEqual([]);
    });

    it('flags an our_evidence pointer that does not resolve', () => {
        const rows: Row[] = [
            {
                claim: 'Phantom claim.',
                our_evidence: 'docs/this-file-does-not-exist.md',
                their_evidence: 'category prose',
                checkable: true,
            },
        ];
        const errs = findErrors(rows);
        expect(errs.length).toBe(1);
        expect(errs[0]).toContain('our_evidence');
    });

    it('flags missing/empty fields', () => {
        const rows = [{ claim: '', our_evidence: '', their_evidence: '', checkable: 'yes' }] as unknown as Row[];
        const errs = findErrors(rows);
        expect(errs.some((e) => e.includes('claim'))).toBe(true);
        expect(errs.some((e) => e.includes('their_evidence'))).toBe(true);
        expect(errs.some((e) => e.includes('checkable'))).toBe(true);
        expect(errs.some((e) => e.includes('our_evidence'))).toBe(true);
    });
});

describe('check_comparison — committed data', () => {
    it('docs/comparison.yaml has rows and all resolve', () => {
        const rows = loadRows();
        expect(rows.length).toBeGreaterThan(0);
        expect(findErrors(rows)).toEqual([]);
    });

    it('main() returns 0 on the committed data', () => {
        expect(main(['--quiet'])).toBe(0);
    });
});
