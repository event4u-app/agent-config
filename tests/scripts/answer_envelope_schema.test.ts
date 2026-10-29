/**
 * J.1 — one answer envelope with budgets on the serialized form.
 */
import { describe, expect, it } from 'vitest';

import { FORMAT_BUDGET, envelopeTokens, makeEnvelope, validateEnvelope } from '../../src/scripts/code_graph/answer_envelope.js';

const witness = { generation: 'g1', commit: 'abc123', staleness: 'fresh' as const, confirm: 'agent-config code-graph confirm' };
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `src/file_${i}.ts#symbol_${i}`, text: `src/file_${i}.ts:${i + 1} symbol_${i} is called by ${i} places in the checkout flow` }));

describe('makeEnvelope', () => {
    it('a small answer is complete, valid and carries every field', () => {
        const e = makeEnvelope({ items: items(3), confidence: 'high', witness, evidence: ['src/a.ts:1', 'not evidence'], next: ['a', 'b', 'c', 'd'] });
        expect(validateEnvelope(e)).toEqual([]);
        expect(e).toMatchObject({ complete: true, truncated_by: null, counts: { shown: 3, total: 3, text_only: 0 }, evidence: ['src/a.ts:1'], next: ['a', 'b', 'c'], format: 'concise', ttl_seconds: 3600 });
        expect(e.packet_id).toMatch(/^pk_[0-9a-f]{16}$/);
    });

    for (const format of ['hint', 'concise', 'detailed'] as const) {
        it(`${format}: a large answer is packed inside ${FORMAT_BUDGET[format]} tokens and says it was cut`, () => {
            const e = makeEnvelope({ items: items(400), confidence: 'medium', witness, evidence: Array.from({ length: 9 }, (_, i) => `src/x.ts:${i + 1}`) }, format);
            expect(envelopeTokens(e)).toBeLessThanOrEqual(FORMAT_BUDGET[format]);
            expect(e.complete).toBe(false);
            expect(e.truncated_by).toBe('budget');
            expect(e.counts.total).toBe(400);
            expect(e.counts.shown).toBeGreaterThan(0);
            expect(e.notice).toMatch(/narrow your question/);
            expect(validateEnvelope(e)).toEqual([]);
        });
    }

    it('hint carries ids only and more ids fit than concise lines', () => {
        const hint = makeEnvelope({ items: items(400), confidence: 'low', witness }, 'hint');
        const concise = makeEnvelope({ items: items(400), confidence: 'low', witness }, 'concise');
        expect(hint.answer.every((a) => a.text === undefined)).toBe(true);
        expect(concise.counts.shown).toBeGreaterThan(0);
    });

    it('a page of a larger set is incomplete by limit', () => {
        const e = makeEnvelope({ items: items(2), total: 10, confidence: 'high', witness });
        expect(e).toMatchObject({ complete: false, truncated_by: 'limit', counts: { shown: 2, total: 10 } });
    });

    it('the packet id is content-addressed: same answer same id, different commit different id', () => {
        const a = makeEnvelope({ items: items(2), confidence: 'high', witness });
        const b = makeEnvelope({ items: items(2), confidence: 'high', witness });
        const c = makeEnvelope({ items: items(2), confidence: 'high', witness: { ...witness, commit: 'def456' } });
        expect(a.packet_id).toBe(b.packet_id);
        expect(a.packet_id).not.toBe(c.packet_id);
    });
});

describe('validateEnvelope', () => {
    it('names every broken invariant', () => {
        const e = makeEnvelope({ items: items(2), confidence: 'high', witness });
        expect(validateEnvelope({ ...e, complete: false })).toContain('complete disagrees with the counts');
        expect(validateEnvelope({ ...e, next: ['a', 'b', 'c', 'd'] })).toContain('at most three next commands');
        expect(validateEnvelope({ ...e, packet_id: 'x' })).toContain('packet_id is not content-addressed');
        expect(validateEnvelope({ ...e, format: 'hint' })).toContain('hint carries ids only');
    });
});
