/**
 * K.6 — learnings into retros and reviews: digest, held-or-recurred, and
 * checklist inputs that cite a contract or test, never signal text.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type TopicSignal, emptyFold, foldSignal } from '../../src/scripts/_lib/feedback_candidates.js';
import type { FeedbackSignal } from '../../src/scripts/_lib/feedback_signals.js';
import { citeFor, heldOrRecurred, retroDigest, reviewChecklist } from '../../src/scripts/_lib/learning_inputs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sig = (kind: TopicSignal['kind'], session: string, ts: string, topic = 'rule:commit-policy'): TopicSignal => ({ kind, topic, session, task: null, ts });
const sigs = [sig('complaint', 's1', '2026-09-01'), sig('complaint', 's2', '2026-09-03'), sig('complaint', 's3', '2026-09-20'), sig('approval', 's9', '2026-09-02', 'rule:no-such-rule')];
const fold = sigs.slice(0, 2).reduce(foldSignal, emptyFold('repo-a'));

describe('retro', () => {
    it('the digest lists topics with kinds counted, no spans', () => {
        expect(retroDigest(fold)).toEqual([{ topic: 'rule:commit-policy', state: 'candidate', seen_count: 2, for: 0, against: 2 }]);
    });

    it('held or recurred reports before and after an accepted learning', () => {
        expect(heldOrRecurred(sigs, 'rule:commit-policy', '2026-09-10', '2026-10-01')).toEqual({ topic: 'rule:commit-policy', accepted_at: '2026-09-10', before: 2, after: 1, verdict: 'recurred' });
        expect(heldOrRecurred(sigs.slice(0, 2), 'rule:commit-policy', '2026-09-10', '2026-10-01').verdict).toBe('held');
        expect(heldOrRecurred(sigs.slice(0, 2), 'rule:commit-policy', '2026-09-28', '2026-10-01').verdict).toBe('too early');
    });
});

describe('review checklist', () => {
    const correction = (at: string): FeedbackSignal => ({ kind: 'correction', about: 'edit', rules: [], skills: [], area: 'src/scripts', at, span: 'PRIVATE frustrated words' });

    it('lists the recurring finding citing its contract and a correction hot spot citing a test — never signal text', () => {
        const items = reviewChecklist(ROOT, fold, [correction('s1:3'), correction('s2:9')], 'src/scripts', () => ['tests/scripts/commit_policy.test.ts']);
        expect(items).toEqual([
            { item: 'recurring finding on rule:commit-policy (candidate)', cites: 'src/rules/commit-policy.md', evidence: { sessions: 2, at: ['s1', 's2'] } },
            { item: 'correction hot spot: agent lines in src/scripts were corrected 2 times', cites: 'tests/scripts/commit_policy.test.ts', evidence: { sessions: 2, at: ['s1:3', 's2:9'] } },
        ]);
        expect(JSON.stringify(items)).not.toMatch(/PRIVATE|frustrated/);
    });

    it('a topic with nothing to cite is left out', () => {
        expect(citeFor(ROOT, 'rule:no-such-rule')).toBeNull();
        expect(citeFor(ROOT, 'rule:../../etc/passwd')).toBeNull();
        const f = [sig('complaint', 'a', '2026-09-01', 'rule:no-such-rule'), sig('complaint', 'b', '2026-09-02', 'rule:no-such-rule')].reduce(foldSignal, emptyFold('r'));
        expect(reviewChecklist(ROOT, f, [], 'src')).toEqual([]);
    });
});
