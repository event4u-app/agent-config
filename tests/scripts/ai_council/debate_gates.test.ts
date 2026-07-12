// Tests for src/scripts/ai_council/debate_gates.ts (Phase 3 — pure detectors).
import { describe, expect, it } from 'vitest';

import {
    count_dissenters,
    repair_action,
    dissent_quota_met,
    is_near_duplicate,
} from '../../../src/scripts/ai_council/debate_gates.js';

describe('is_near_duplicate (novelty gate)', () => {
    it('flags a round-N reply that barely changed from round-(N-1)', () => {
        const prev = 'The migration must run inside a transaction with a rollback path and an index on tenant_id.';
        const curr = 'The migration must run inside a transaction with a rollback path and an index on tenant_id.';
        expect(is_near_duplicate(prev, curr)).toBe(true);
    });

    it('does not flag a genuinely different reply', () => {
        const prev = 'Option A: ship the adapter behind a feature flag.';
        const curr = 'Actually option B is stronger — the queue backpressure invalidates A on burst load.';
        expect(is_near_duplicate(prev, curr)).toBe(false);
    });

    it('empty text is never a duplicate', () => {
        expect(is_near_duplicate('', 'anything')).toBe(false);
        expect(is_near_duplicate('anything', '')).toBe(false);
    });
});

describe('dissent quota', () => {
    it('counts members carrying an objection marker', () => {
        const texts = [
            'I disagree — the ordering assumption is a flaw.',
            'Agreed, ship it.',
            'However, the tenant scope is wrong here.',
        ];
        expect(count_dissenters(texts)).toBe(2);
        expect(dissent_quota_met(texts)).toBe(true);
    });

    it('is not met when fewer than the quota object', () => {
        const texts = ['Agreed.', 'Sounds right to me.', 'I concur with the plan.'];
        expect(count_dissenters(texts)).toBe(0);
        expect(dissent_quota_met(texts)).toBe(false);
    });

    it('ignores empty replies', () => {
        expect(count_dissenters(['', 'I object to the schema change.'])).toBe(1);
        expect(dissent_quota_met(['', 'I object.'])).toBe(false);
    });
});

describe('repair_action (council 2026-07-12 policy)', () => {
    it('auto-continue → fire under the cap', () => {
        expect(repair_action({ auto_continue: true, already_repaired: false })).toBe('fire');
    });
    it('interactive → one-line confirm', () => {
        expect(repair_action({ auto_continue: false, already_repaired: false })).toBe('confirm');
    });
    it('cap is absolute: already-repaired member is skipped in every mode', () => {
        expect(repair_action({ auto_continue: true, already_repaired: true })).toBe('skip');
        expect(repair_action({ auto_continue: false, already_repaired: true })).toBe('skip');
    });
});
