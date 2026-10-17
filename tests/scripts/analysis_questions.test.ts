import { describe, expect, it } from 'vitest';

import { QuestionError, nextOwnerAsk, routeQuestions, type Question } from '../../src/scripts/analysis_questions.js';

const SET: Question[] = [
    { id: 'q-order', text: 'Run the adversary lens before coverage?', ownership: 'reversible-technical' },
    { id: 'q-priority', text: 'Which of two conflicting roadmaps lands first?', ownership: 'contested-technical' },
    { id: 'q-push', text: 'Push the run branch to the shared remote?', ownership: 'destructive-owned', gates: 'push', recommendation: 'yes, the run branch only' },
    { id: 'q-fetch', text: 'Fetch the private mirror named in the brief?', ownership: 'product-owned', gates: 'fetch', recommendation: 'no' },
    { id: 'q-scope', text: 'Should the billing module join the next run?', ownership: 'product-owned', recommendation: 'yes, as its own run' },
    { id: 'q-budget', text: 'The analyst budget is spent.', ownership: 'spend-exhaustion' },
];

describe('questions: council first, owner once', () => {
    it('routes council-decidable items to the council and agent-decidable ones to nobody', () => {
        const r = routeQuestions(SET);
        expect(r.council.map((q) => q.id)).toEqual(['q-priority']);
        expect(r.agent.map((q) => q.id)).toEqual(['q-order']);
    });

    it('asks a pre-action item before its action, alone, and nothing before an action it does not gate', () => {
        const r = routeQuestions(SET);
        expect(nextOwnerAsk(r, 'push')?.id).toBe('q-push');
        expect(nextOwnerAsk(r, 'fetch')?.id).toBe('q-fetch');
        expect(nextOwnerAsk(r, 'destructive')).toBeNull();
    });

    it('batches the remaining owner items for the end, each with its recommendation', () => {
        const r = routeQuestions(SET);
        expect(r.endBatch).toEqual([{ id: 'q-scope', text: 'Should the billing module join the next run?', recommendation: 'yes, as its own run' }]);
    });

    it('pauses and reports on spend exhaustion instead of asking', () => {
        const r = routeQuestions(SET);
        expect(r.pause.map((q) => q.id)).toEqual(['q-budget']);
        expect(JSON.stringify(r.endBatch)).not.toContain('q-budget');
    });

    it('refuses an owner end-batch item without a recommendation and an unknown class', () => {
        expect(() => routeQuestions([{ id: 'x', text: 't', ownership: 'product-owned' }])).toThrow(QuestionError);
        expect(() => routeQuestions([{ id: 'y', text: 't', ownership: 'high-stakes' }])).toThrow(/unknown ownership class/);
    });
});
