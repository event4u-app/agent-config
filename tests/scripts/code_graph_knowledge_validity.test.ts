/**
 * I.3 — validity on knowledge facts: supersession, deterministic contradiction
 * expiry, and retraction of derived claims whose basis is gone.
 */
import { describe, expect, it } from 'vitest';

import { type KnowledgeFact, resolveFacts } from '../../src/scripts/code_graph/knowledge_validity.js';

const f = (id: string, subject: string, value: string, from: string, extra: Partial<KnowledgeFact> = {}): KnowledgeFact => ({ id, subject, value, valid_from: from, valid_until: null, recorded_at: from, ...extra });

const state = (facts: KnowledgeFact[], at: string, known?: Set<string>) => Object.fromEntries(resolveFacts(facts, at, known).map((r) => [r.id, [r.state, r.valid_until]]));

describe('resolveFacts', () => {
    it('a superseding fact ends the old one where it starts', () => {
        const s = state([f('a', 'x', '1', '2026-01-01'), f('b', 'x', '1', '2026-03-01', { supersedes: ['a'] })], '2026-04-01');
        expect(s).toEqual({ a: ['superseded', '2026-03-01'], b: ['valid', null] });
    });

    it('contradictions expire by the interval rule, independent of input order', () => {
        const facts = [f('new', 'default-branch', 'main', '2026-05-01'), f('old', 'default-branch', 'master', '2026-01-01')];
        const forward = state(facts, '2026-06-01');
        const backward = state([...facts].reverse(), '2026-06-01');
        expect(forward).toEqual({ new: ['valid', null], old: ['expired', '2026-05-01'] });
        expect(backward).toEqual(forward);
        expect(state(facts, '2026-02-01')).toEqual({ new: ['expired', null], old: ['valid', '2026-05-01'] });
    });

    it('agreeing facts and non-overlapping intervals do not expire each other', () => {
        expect(state([f('a', 'x', '1', '2026-01-01'), f('b', 'x', '1', '2026-02-01')], '2026-03-01')).toEqual({ a: ['valid', null], b: ['valid', null] });
        expect(state([f('a', 'x', '1', '2026-01-01', { valid_until: '2026-02-01' }), f('b', 'x', '2', '2026-02-01')], '2026-03-01')).toEqual({ a: ['expired', '2026-02-01'], b: ['valid', null] });
    });

    it('deleting a memory entry’s only path retracts its claim, and the retraction cascades', () => {
        const facts = [
            f('claim', 'src/sum.ts', 'adds', '2026-01-01', { based_on: ['src/sum.ts'] }),
            f('derived', 'cart', 'uses sum', '2026-01-02', { based_on: ['claim'] }),
        ];
        expect(state(facts, '2026-02-01', new Set(['src/sum.ts']))).toEqual({ claim: ['valid', null], derived: ['valid', null] });
        const gone = resolveFacts(facts, '2026-02-01', new Set());
        expect(gone.map((r) => [r.id, r.state, r.reason])).toEqual([
            ['claim', 'retracted', 'based on src/sum.ts, which is gone'],
            ['derived', 'retracted', 'based on claim, which is gone'],
        ]);
    });
});
