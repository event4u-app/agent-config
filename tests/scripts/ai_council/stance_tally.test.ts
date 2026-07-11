// Tests for src/scripts/ai_council/stance_tally.ts (Phase 1).
//
// Pure logic: parse stance lines, weight by confidence, decide consensus vs.
// split against the ⅔ threshold. No CLI, no network.
import { describe, expect, it } from 'vitest';

import {
    CONFIDENCE_FACTOR,
    parse_stance_line,
    render_vote_tally,
    tally_stances,
} from '../../../src/scripts/ai_council/stance_tally.js';

const stance = (label: string, conf: string, db = 'no'): string =>
    `Some reasoning prose here.\n\nSTANCE: ${label} | CONFIDENCE: ${conf} | DEALBREAKER: ${db}`;

describe('parse_stance_line — tolerant, explicit-only', () => {
    it('parses the canonical shape', () => {
        const p = parse_stance_line('STANCE: Option A | CONFIDENCE: high | DEALBREAKER: yes');
        expect(p).not.toBeNull();
        expect(p!.label).toBe('option a');
        expect(p!.display).toBe('Option A');
        expect(p!.confidence).toBe('high');
        expect(p!.dealbreaker).toBe(true);
    });

    it('tolerates whitespace + case and the medium alias', () => {
        const p = parse_stance_line('stance:   Option B   |   confidence:  MEDIUM  |  dealbreaker: NO');
        expect(p!.label).toBe('option b');
        expect(p!.confidence).toBe('med');
        expect(p!.dealbreaker).toBe(false);
    });

    it('returns null (repair marker) when there is no well-formed line — never infers from prose', () => {
        expect(parse_stance_line('I lean towards option A but I am not sure.')).toBeNull();
        expect(parse_stance_line('STANCE:  | CONFIDENCE: high | DEALBREAKER: no')).toBeNull();
    });

    it('takes the LAST stance line when several appear', () => {
        const text = 'STANCE: Draft | CONFIDENCE: low | DEALBREAKER: no\n\nOn reflection:\n\nSTANCE: Final | CONFIDENCE: high | DEALBREAKER: no';
        expect(parse_stance_line(text)!.label).toBe('final');
    });
});

describe('tally_stances — Source-G worked example (3-seat, one abstain)', () => {
    it('the abstain raises the bar so a 1.75-weight lead SPLITS (would clear without it)', () => {
        // Two members back the same option (one high, one med → 1.0 + 0.75 = 1.75),
        // the third abstains. W_total = 3 → threshold ⅔×3 = 2.0. 1.75 < 2.0 → split.
        const members = [
            { member: 'openai:gpt-4o', text: stance('Adopt', 'high') },
            { member: 'anthropic:claude', text: stance('Adopt', 'med') },
            { member: 'google:gemini', text: stance('abstain', 'low') },
        ];
        const r = tally_stances(members);
        expect(r.w_total).toBe(3);
        expect(r.threshold).toBeCloseTo(2.0, 9);
        expect(r.abstain_count).toBe(1);
        expect(r.options[0]!.weight).toBeCloseTo(1.75, 9);
        expect(r.consensus).toBeNull();
        expect(r.split).toBe(true);

        // Without the abstainer, the same two backers DO clear (⅔×2 = 1.333 < 1.75).
        const r2 = tally_stances(members.slice(0, 2));
        expect(r2.threshold).toBeCloseTo(4 / 3, 9);
        expect(r2.consensus).not.toBeNull();
        expect(r2.consensus!.label).toBe('Adopt');
    });

    it('two high-confidence backers + one abstain clear the raised bar exactly (2.0 ≥ 2.0)', () => {
        const members = [
            { member: 'openai:gpt-4o', text: stance('Adopt', 'high') },
            { member: 'anthropic:claude', text: stance('Adopt', 'high') },
            { member: 'google:gemini', text: stance('abstain', 'high') },
        ];
        const r = tally_stances(members);
        expect(r.consensus).not.toBeNull();
        expect(r.consensus!.weight).toBeCloseTo(2.0, 9);
    });
});

describe('tally_stances — splits, distinct labels, repair', () => {
    it('two different options never force a winner', () => {
        const r = tally_stances([
            { member: 'a:1', text: stance('Option X', 'high') },
            { member: 'b:2', text: stance('Option Y', 'high') },
        ]);
        expect(r.options).toHaveLength(2);
        expect(r.consensus).toBeNull();
        expect(r.split).toBe(true);
    });

    it('keeps unmatched labels distinct — no fuzzy merging in v1', () => {
        const r = tally_stances([
            { member: 'a:1', text: stance('rewrite', 'high') },
            { member: 'b:2', text: stance('re-write', 'high') },
        ]);
        expect(r.options).toHaveLength(2);
    });

    it('flags members with a missing/unparseable stance as needs_repair (excluded from W_total)', () => {
        const r = tally_stances([
            { member: 'a:1', text: stance('Adopt', 'high') },
            { member: 'b:2', text: 'I forgot to add a stance line.' },
        ]);
        expect(r.needs_repair).toEqual(['b:2']);
        expect(r.w_total).toBe(1);
    });

    it('confidence factors match the spec', () => {
        expect(CONFIDENCE_FACTOR).toEqual({ high: 1.0, med: 0.75, low: 0.5 });
    });
});

describe('render_vote_tally', () => {
    it('renders options, threshold, and an escalation line on a split', () => {
        const out = render_vote_tally(
            tally_stances([
                { member: 'a:1', text: stance('Option X', 'high') },
                { member: 'b:2', text: stance('Option Y', 'high') },
            ]),
        );
        expect(out).toContain('### Vote Tally');
        expect(out).toContain('Threshold: ⅔ × 2 = 1.33');
        expect(out).toContain('Escalated: no option cleared');
    });

    it('renders a cleared line on consensus', () => {
        const out = render_vote_tally(
            tally_stances([
                { member: 'a:1', text: stance('Adopt', 'high') },
                { member: 'b:2', text: stance('Adopt', 'high') },
            ]),
        );
        expect(out).toContain('Cleared: Adopt');
    });
});
