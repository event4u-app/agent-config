// Tests for src/scripts/ai_council/confidence_gate.ts (py2ts Phase 1).
//
// Heuristics are regex + length only.
import { describe, expect, it } from 'vitest';

import {
    extract_confidence,
    is_refusal,
    is_split_response,
    should_escalate,
} from '../../../src/scripts/ai_council/confidence_gate.js';

// Representative response corpus exercising every branch + edge.
const CORPUS: Record<string, string> = {
    empty: '',
    whitespace: '   \n  ',
    refusal_en: 'I cannot decide on this right now, sorry.',
    refusal_de: 'Das kann ich nicht entscheiden ohne mehr Kontext.',
    refusal_unclear: 'This is unclear to me at the moment honestly.',
    refusal_insufficient: 'There is insufficient context to answer this fully.',
    split_options: 'I would go option A here, but option B is also strong and could work well.',
    split_either: 'You could either ship it or hold it — both would be defensible choices here.',
    split_variante: 'Variante 1 ist schnell, Variante 2 ist sauber, beides denkbar wirklich.',
    short: 'Yes, do it.',
    marker_decimal: 'Confidence: 0.92 — the plan is solid and the rollback path is clear enough.',
    marker_percent: 'Confidence = 75% overall; the migration ordering is well understood here.',
    marker_zero: 'Confidence: 0 — I really would not trust this answer at all whatsoever today.',
    hedged: 'Maybe this works, perhaps it does, I think possibly it could be fine probably though.',
    confident:
        'Ship it. The migration is reversible, the tests cover the critical path, and the blast radius is contained.',
    marker_bad: 'Confidence: abc but the rest of this is a perfectly long and useful response here.',
};

describe('confidence_gate — extract_confidence unit', () => {
    it('null on empty / whitespace', () => {
        expect(extract_confidence('')).toBeNull();
        expect(extract_confidence('   \n ')).toBeNull();
    });
    it('explicit decimal marker', () => {
        expect(extract_confidence('Confidence: 0.8 plus a long enough tail here')).toBe(0.8);
    });
    it('percent marker normalised to 0..1', () => {
        expect(extract_confidence('Confidence = 75% padding padding padding')).toBe(0.75);
    });
    it('no hedge words → 1.0', () => {
        expect(extract_confidence('A crisp factual statement with zero hedging at all.')).toBe(1.0);
    });
});

describe('confidence_gate — is_refusal / is_split unit', () => {
    it('empty is a refusal', () => {
        expect(is_refusal('')).toBe(true);
    });
    it('detects EN + DE refusals', () => {
        expect(is_refusal('I cannot answer that')).toBe(true);
        expect(is_refusal('weiß ich nicht')).toBe(true);
        expect(is_refusal('a perfectly fine answer')).toBe(false);
    });
    it('detects splits', () => {
        expect(is_split_response('option A vs option B')).toBe(true);
        expect(is_split_response('a single clear recommendation')).toBe(false);
        expect(is_split_response('')).toBe(false);
    });
});

describe('confidence_gate — should_escalate ordering', () => {
    it('null/empty → refusal', () => {
        expect(should_escalate(null, 0.5).reason).toBe('refusal');
        expect(should_escalate('  ', 0.5).reason).toBe('refusal');
    });
    it('short response below threshold (but not refusal/split)', () => {
        const d = should_escalate('Yes, ship it now.', 0.5);
        expect(d).toEqual({ escalate: true, reason: 'short_response', confidence: null });
    });
    it('confident long answer → ok', () => {
        const d = should_escalate(CORPUS.confident as string, 0.5);
        expect(d.escalate).toBe(false);
        expect(d.reason).toBe('ok');
    });
});
