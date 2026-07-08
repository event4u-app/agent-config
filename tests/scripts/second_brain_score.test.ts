/**
 * Deterministic second-brain recall scorer
 * (road-to-second-brain-delta-proof Phase 1).
 */
import { describe, expect, it } from 'vitest';

import {
    dryRun,
    loadCorpus,
    scoreTask,
    type RecallTask,
} from '../../src/scripts/second_brain_score.js';

const TASK: RecallTask = {
    id: 'demo',
    metric: 'retrieval-accuracy',
    session_k: 'We chose REST for caching.',
    session_k1_prompt: 'Which API style?',
    answer_key: { must_contain: ['REST', 'caching'], must_not_contain: ['we chose GraphQL'] },
};

describe('scoreTask', () => {
    it('passes when every must_contain is present and no must_not_contain is', () => {
        expect(scoreTask('We picked REST for its caching story.', TASK).pass).toBe(true);
    });

    it('fails on a missing required phrase', () => {
        const s = scoreTask('We picked REST.', TASK);
        expect(s.pass).toBe(false);
        expect(s.missing).toEqual(['caching']);
    });

    it('fails on a present forbidden phrase', () => {
        const s = scoreTask('Actually we chose GraphQL, not REST, for caching.', TASK);
        expect(s.pass).toBe(false);
        expect(s.forbidden).toEqual(['we chose GraphQL']);
    });

    it('is case-insensitive', () => {
        expect(scoreTask('rest ... CACHING', TASK).pass).toBe(true);
    });
});

describe('corpus + dry run', () => {
    it('ships ≥8 tasks across all three metrics', () => {
        const tasks = loadCorpus();
        expect(tasks.length).toBeGreaterThanOrEqual(8);
        const metrics = new Set(tasks.map((t) => t.metric));
        expect(metrics).toEqual(
            new Set(['retrieval-accuracy', 'contradiction-catch', 'repair']),
        );
    });

    it('every task carries a non-empty deterministic answer key', () => {
        for (const t of loadCorpus()) {
            expect(t.answer_key.must_contain.length).toBeGreaterThan(0);
            expect(Array.isArray(t.answer_key.must_not_contain)).toBe(true);
        }
    });

    it('dry run: good transcripts pass, bad transcripts fail (discriminating)', () => {
        const r = dryRun();
        if (!r.ok) throw new Error('dry-run problems: ' + r.problems.join('; '));
        expect(r.ok).toBe(true);
        expect(r.goodScored).toBeGreaterThanOrEqual(8);
        expect(r.badScored).toBeGreaterThanOrEqual(1);
    });
});
