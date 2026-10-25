/**
 * `review_by` on the claim ledger: what is overdue, and that the report says so
 * (road-to-a-policy-the-measurements-write 2.1, 2.2).
 */
import { describe, expect, it } from 'vitest';

import {
    type LedgerEntry,
    local_today,
    overdue_entries,
    render_overdue,
    render_status,
} from '../../src/scripts/check_claims.js';

function entry(id: string, status: string, review_by: string): LedgerEntry {
    return {
        id,
        claim: '',
        kind: 'quant',
        evidence: '',
        status,
        last_verified: '',
        superseded_by: '',
        retired_by: '',
        measured_on: '',
        non_inference: '',
        retires_phrasings: '',
        promotion_evidence: '',
        retires_phrasings_present: false,
        review_by,
    };
}

const ledger = new Map(
    [
        entry('past', 'unbacked', '2026-10-24'),
        entry('today', 'unbacked', '2026-10-25'),
        entry('ahead', 'measured-in-repo', '2026-12-15'),
        entry('closed', 'backed', '2026-01-01'),
        entry('undated', 'unbacked', ''),
    ].map((e) => [e.id, e]),
);

describe('overdue_entries', () => {
    it('is exactly the open entries whose date lies before today', () => {
        expect(overdue_entries(ledger, '2026-10-25').map((e) => e.id)).toEqual(['past']);
    });

    it('moves with the date, so the comparison is not inverted', () => {
        expect(overdue_entries(ledger, '2026-12-16').map((e) => e.id)).toEqual(['past', 'today', 'ahead']);
        expect(overdue_entries(ledger, '2026-10-24')).toEqual([]);
    });
});

describe('render_overdue', () => {
    it('names each overdue claim and its date', () => {
        const text = render_overdue(overdue_entries(ledger, '2026-10-25'));
        expect(text).toContain('Overdue: 1 open claim(s)');
        expect(text).toContain('past — review_by 2026-10-24');
    });

    it('prints nothing when nothing is overdue', () => {
        expect(render_overdue([])).toBe('');
    });
});

describe('render_status', () => {
    it('lists every open entry with its date and marks the overdue one', () => {
        const text = render_status(ledger, '2026-10-25');
        expect(text).toContain('open claims: 4');
        expect(text).toMatch(/past {2}unbacked .*review_by 2026-10-24 {2}OVERDUE/);
        expect(text).toMatch(/undated {2}unbacked .*review_by -$/m);
        expect(text).not.toContain('closed');
    });
});

describe('local_today', () => {
    it('reads the local calendar date', () => {
        expect(local_today(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
    });
});
