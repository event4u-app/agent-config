/**
 * K.3 — from signals to candidates, incremental per project.
 */
import { describe, expect, it } from 'vitest';

import { type TopicSignal, acceptLearning, emptyFold, foldSignal, reviewQueue } from '../../src/scripts/_lib/feedback_candidates.js';

const s = (kind: TopicSignal['kind'], session: string, ts: string, extra: Partial<TopicSignal> = {}): TopicSignal => ({ kind, topic: 'rule:commit-policy', session, task: null, ts, ...extra });
const fold = (...sigs: TopicSignal[]) => sigs.reduce(foldSignal, emptyFold('repo-a'));

describe('foldSignal', () => {
    it('one session is a signal; two distinct sessions a candidate; repeats in one session do not count', () => {
        expect(fold(s('complaint', 's1', '2026-10-01'), s('complaint', 's1', '2026-10-01T01')).topics['rule:commit-policy']).toMatchObject({ state: 'signal', seen_count: 1 });
        expect(fold(s('complaint', 's1', '2026-10-01'), s('complaint', 's2', '2026-10-02')).topics['rule:commit-policy']).toMatchObject({ state: 'candidate', seen_count: 2 });
    });

    it('complaint then approval is contested, resolved by recency, not count', () => {
        const r = fold(s('complaint', 's1', '2026-10-01'), s('complaint', 's2', '2026-10-02'), s('complaint', 's3', '2026-10-03'), s('approval', 's4', '2026-10-04')).topics['rule:commit-policy'];
        expect(r).toMatchObject({ state: 'contested', current: 'for', for: 1, against: 3 });
    });

    it('a single severe event goes straight to review and stays there', () => {
        const f = fold(s('correction', 's1', '2026-10-01', { severe: true }), s('approval', 's2', '2026-10-02'));
        expect(f.topics['rule:commit-policy']?.state).toBe('review');
        expect(reviewQueue(f)[0]?.state).toBe('review');
    });

    it('an accepted learning followed by its complaint is recurred', () => {
        let f = fold(s('complaint', 's1', '2026-10-01'), s('complaint', 's2', '2026-10-02'));
        f = acceptLearning(f, 'rule:commit-policy', '2026-10-03');
        f = foldSignal(f, s('complaint', 's3', '2026-10-05'));
        expect(f.topics['rule:commit-policy']?.state).toBe('recurred');
    });

    it('a topic about a person is dropped; the fold is per project and incremental', () => {
        const f = fold(s('complaint', 's1', '2026-10-01', { topic: 'person:someone' }), s('complaint', 's2', '2026-10-02', { topic: '@someone review style' }));
        expect(f).toMatchObject({ repo_id: 'repo-a', topics: {}, dropped: 2 });
        const base = emptyFold('repo-a');
        foldSignal(base, s('complaint', 's1', '2026-10-01'));
        expect(base.topics).toEqual({});
    });

    it('tasks are counted distinctly beside sessions', () => {
        const r = fold(s('complaint', 's1', '2026-10-01', { task: 't1' }), s('complaint', 's2', '2026-10-02', { task: 't1' })).topics['rule:commit-policy'];
        expect(r?.tasks).toEqual(['t1']);
        expect(r?.sessions).toEqual(['s1', 's2']);
    });
});
