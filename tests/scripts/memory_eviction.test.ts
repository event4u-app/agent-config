// Tests for src/scripts/memory_eviction.ts (road-to-context-fidelity Phase 2).
//
// The ladder's arithmetic is the part a reader is most likely to disagree
// with, so `classify` is exercised directly rather than through the store: the
// thresholds are the claim, and a test that only ran the CLI would assert the
// plumbing instead.
import { describe, expect, it } from 'vitest';

import { classify } from '../../src/scripts/memory_eviction.js';

const TODAY = new Date('2026-08-19T00:00:00Z');

function entry(over: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: 'e', last_validated: '2026-08-01', review_after_days: 30, ...over };
}

describe('classify — age axis', () => {
    it('is active inside its window', () => {
        expect(classify(entry(), TODAY, false).state).toBe('active');
    });

    it('is due past one window', () => {
        const c = classify(entry({ last_validated: '2026-07-01' }), TODAY, false);
        expect(c.state).toBe('due');
        expect(c.age).toBe(49);
    });

    it('quarantines past two windows', () => {
        expect(classify(entry({ last_validated: '2026-06-01' }), TODAY, false).state).toBe('quarantine');
    });

    it('deletes only from quarantine, and only past three windows', () => {
        // 2026-05-01 is 110 days back — past 3 × 30 = 90.
        expect(classify(entry({ last_validated: '2026-05-01' }), TODAY, true).state).toBe('delete');
        // The same entry OUTSIDE quarantine is never deleted, only demoted.
        expect(classify(entry({ last_validated: '2026-05-01' }), TODAY, false).state).toBe('quarantine');
    });

    it('stays active when the age axis is unusable', () => {
        expect(classify({ id: 'e' }, TODAY, false).state).toBe('active');
        expect(classify(entry({ review_after_days: undefined }), TODAY, false).state).toBe('active');
    });
});

describe('classify — contradiction outranks retention', () => {
    it('quarantines a recorded stale verdict regardless of age', () => {
        const fresh = entry({ last_validated: '2026-08-19', semantic_verdict: 'stale' });
        const c = classify(fresh, TODAY, false);
        expect(c.state).toBe('quarantine');
        expect(c.reason).toMatch(/contradiction outranks age/);
    });

    it('does not escalate a quarantined stale entry to delete on the verdict alone', () => {
        // Deletion is an AGE decision taken inside quarantine. A verdict must
        // never be the thing that erases an entry — otherwise one recorded
        // reading, right or wrong, is unappealable.
        const c = classify(entry({ last_validated: '2026-05-01', semantic_verdict: 'stale' }), TODAY, true);
        expect(c.state).toBe('quarantine');
    });
});

describe('classify — unverifiable entries', () => {
    it('surfaces on age but never quarantines', () => {
        // The tree can never confirm an external event, so an age threshold
        // would evict on a schedule for a reason nothing can discharge.
        const old = entry({ last_validated: '2026-01-01', semantic_verdict: 'unverifiable' });
        const c = classify(old, TODAY, false);
        expect(c.state).toBe('due');
        expect(c.reason).toMatch(/never quarantined/);
    });

    it('is active while inside its window', () => {
        expect(classify(entry({ semantic_verdict: 'unverifiable' }), TODAY, false).state).toBe('active');
    });
});
