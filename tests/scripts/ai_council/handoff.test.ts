// Tests for src/scripts/ai_council/handoff.ts (road-to-always-on-orchestration
// Phase 4.1 — verdict → handoff envelope).
//
// Pure logic: build a HandoffEnvelope from a StanceTallyResult, or the honest
// all-null envelope when nothing structured exists. No CLI, no network.
import { describe, expect, it } from 'vitest';

import { tally_stances } from '../../../src/scripts/ai_council/stance_tally.js';
import {
    buildHandoffFromStanceTally,
    EMPTY_HANDOFF,
    isEmptyHandoff,
} from '../../../src/scripts/ai_council/handoff.js';

const stance = (label: string, conf: string, db = 'no'): string =>
    `Some reasoning prose here.\n\nSTANCE: ${label} | CONFIDENCE: ${conf} | DEALBREAKER: ${db}`;

describe('isEmptyHandoff', () => {
    it('true for the shared empty constant', () => {
        expect(isEmptyHandoff(EMPTY_HANDOFF)).toBe(true);
    });

    it('false as soon as any single field is populated', () => {
        expect(isEmptyHandoff({ decision: 'x', rejected_alternatives: null, constraints: null })).toBe(false);
        expect(
            isEmptyHandoff({ decision: null, rejected_alternatives: [{ option: 'a', reason: 'r' }], constraints: null }),
        ).toBe(false);
        expect(isEmptyHandoff({ decision: null, rejected_alternatives: null, constraints: ['c'] })).toBe(false);
    });
});

describe('buildHandoffFromStanceTally — honest nulls', () => {
    it('a null tally (stance tally never ran) returns the all-null envelope', () => {
        expect(buildHandoffFromStanceTally(null)).toEqual(EMPTY_HANDOFF);
    });

    it('a split tally (no option cleared the threshold) returns the all-null envelope — never a guessed winner', () => {
        // Two options, one backer each at low confidence: neither clears ⅔.
        const tally = tally_stances([
            { member: 'a', text: stance('Option A', 'low') },
            { member: 'b', text: stance('Option B', 'low') },
        ]);
        expect(tally.split).toBe(true);
        expect(buildHandoffFromStanceTally(tally)).toEqual(EMPTY_HANDOFF);
    });
});

describe('buildHandoffFromStanceTally — a concluded tally', () => {
    it('decision is the winning option; no other option → rejected_alternatives is null, not []', () => {
        const tally = tally_stances([
            { member: 'a', text: stance('Ship now', 'high') },
            { member: 'b', text: stance('Ship now', 'high') },
        ]);
        expect(tally.consensus).not.toBeNull();
        const h = buildHandoffFromStanceTally(tally);
        expect(h.decision).toBe('Ship now');
        expect(h.rejected_alternatives).toBeNull();
        expect(h.constraints).toBeNull(); // no structured constraint source exists yet
    });

    it('every other non-abstain option becomes a rejected alternative with a factual, tally-derived reason', () => {
        const tally = tally_stances([
            { member: 'a', text: stance('Ship now', 'high') },
            { member: 'b', text: stance('Ship now', 'high') },
            { member: 'c', text: stance('Ship now', 'high') },
            { member: 'd', text: stance('Wait a sprint', 'low') },
        ]);
        expect(tally.consensus?.label).toBe('Ship now');
        const h = buildHandoffFromStanceTally(tally);
        expect(h.decision).toBe('Ship now');
        expect(h.rejected_alternatives).toHaveLength(1);
        const rejected = h.rejected_alternatives?.[0];
        expect(rejected?.option).toBe('Wait a sprint');
        // The reason is derived strictly from the tally's own numbers — a
        // backer count and a weight against the SAME threshold the winner
        // had to clear — never a narrative guess at member motivation.
        // w_total = 4 (all four responses parsed) → threshold = ⅔ × 4 = 2.67.
        expect(rejected?.reason).toBe('backed by 1 member(s), weight 0.50 of 2.67 needed to conclude');
    });

    it('an abstaining member never appears as a rejected alternative', () => {
        const tally = tally_stances([
            { member: 'a', text: stance('Ship now', 'high') },
            { member: 'b', text: stance('Ship now', 'high') },
            { member: 'c', text: stance('abstain', 'high') },
        ]);
        const h = buildHandoffFromStanceTally(tally);
        expect(h.decision).toBe('Ship now');
        expect(h.rejected_alternatives).toBeNull();
    });
});
