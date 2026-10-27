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

describe('wiring: retro triage, recurrence and review routing read the library', () => {
    it('retro triage lifts a low-signal unit when a feedback topic is a candidate', async () => {
        const { withFeedback } = await import('../../src/scripts/_lib/learning_inputs.js');
        const base = { class: 'skip:low-signal', score: 1, signals: ['20 turns +1'] };
        const lifted = withFeedback(base, retroDigest(fold), 3);
        expect(lifted).toMatchObject({ class: 'analyse', score: 3 });
        expect(lifted.signals.at(-1)).toBe('feedback: rule:commit-policy candidate +2');
        expect(withFeedback(base, [], 3)).toBe(base);
    });

    it('composeRetro and readRecurrence read signals; a complaint after acceptance is recurred', async () => {
        const { composeRetro, readRecurrence } = await import('../../src/scripts/retro.js');
        const fs = await import('node:fs');
        const os = await import('node:os');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-fb-'));
        try {
            const r = readRecurrence(root, 'rule:commit-policy', { signals: sigs, acceptedAt: '2026-09-10', now: '2026-10-01' });
            expect(r.feedback).toEqual({ topic: 'rule:commit-policy', accepted_at: '2026-09-10', before: 2, after: 1, verdict: 'recurred' });
            expect(readRecurrence(root, 'rule:commit-policy').feedback).toBeUndefined();
            expect(typeof composeRetro).toBe('function');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('review routing: ask answers a review-checklist question from the user signals, cited, only for that user', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const { vi } = await import('vitest');
        const { ask, fetchById, routeIntent } = await import('../../src/scripts/code_graph/ask.js');
        const { reviewSources } = await import('../../src/scripts/code_graph/cli_ask.js');
        const { appendUserRow } = await import('../../src/scripts/_lib/user_data_control.js');
        const { userProjectDir } = await import('../../src/scripts/_lib/ownership_model.js');
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'review-home-'));
        vi.stubEnv('EVENT4U_CONFIG_HOME', home);
        try {
            const dir = userProjectDir('repo-r');
            for (const [i, s] of sigs.slice(0, 2).entries()) appendUserRow(dir, 'signals', { id: `s${i}`, ...s });
            const g = { byId: new Map(), in: new Map(), out: new Map(), idsInFiles: () => [], idsByLabel: () => [] } as never;
            const scope = { repoId: 'repo-r', branch: 'main', worktree: ROOT, user: 'u1' };
            expect(routeIntent('review checklist for src/scripts')).toBe('review');
            const r = ask('review checklist for src/scripts', reviewSources(ROOT, g, scope, 'u1'), scope);
            expect(r.envelope.answer.map((a) => a.text)).toEqual([expect.stringContaining('cites src/rules/commit-policy.md')]);
            expect(JSON.stringify(r)).not.toMatch(/frustrat/);
            const id = r.envelope.answer[0]?.id as string;
            expect(fetchById(id, reviewSources(ROOT, g, scope, 'u1'), scope)).toMatchObject({ ok: true });
            expect(fetchById(id, reviewSources(ROOT, g, { ...scope, user: 'u2' }, 'u1'), { ...scope, user: 'u2' })).toEqual({ ok: false, reason: 'refused: owned by another user' });
        } finally {
            vi.unstubAllEnvs();
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});
