/**
 * 7.1 — the guardrail watch, observation-only floor.
 *
 * Two properties carry the step, and both are asserted against the direction
 * they could plausibly have gone wrong:
 *
 *   · the first mode takes NO action — there is no branch in `observe` that
 *     acts, so no configuration flips it into one that does;
 *   · enforcement refuses to unlock without the false-positive artefact, and an
 *     ABSENT measurement is a refusal rather than a pass. A gate that unlocks
 *     when it cannot measure is what K5 kills.
 */

import { describe, expect, it } from 'vitest';

import {
    MAX_FALSE_POSITIVE_RATE,
    REQUIRED_SESSIONS,
    TYPED_OPS,
    actionFor,
    classifyLine,
    enforcementAllowed,
    observe,
    type FalsePositiveMeasurement,
} from '../../src/scripts/_lib/typed_op_watch.js';

describe('the observation-only floor', () => {
    it('observe NEVER acts, whatever the measurement says', () => {
        const perfect: FalsePositiveMeasurement = {
            sessions: 100,
            observations: 1000,
            falsePositives: 0,
            artefact: 'x.md',
        };
        expect(actionFor('observe', perfect)).toBe('record');
        expect(actionFor('observe', null)).toBe('record');
    });

    it('enforce degrades to record when the measurement does not clear the bar', () => {
        expect(actionFor('enforce', null)).toBe('record');
        expect(
            actionFor('enforce', { sessions: 30, observations: 100, falsePositives: 5, artefact: 'x' }),
        ).toBe('record');
    });

    it('enforce acts only on a cleared measurement', () => {
        expect(
            actionFor('enforce', { sessions: 30, observations: 1000, falsePositives: 2, artefact: 'x' }),
        ).toBe('record-and-ask');
    });
});

describe('enforcementAllowed', () => {
    it('an ABSENT measurement is a refusal, never a pass', () => {
        const v = enforcementAllowed(null);
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/not a control/);
    });

    it('a short corpus is refused, and the reason names the shortfall', () => {
        const v = enforcementAllowed({ sessions: 5, observations: 50, falsePositives: 0, artefact: 'x' });
        expect(v.allowed).toBe(false);
        expect(v.reason).toContain(String(REQUIRED_SESSIONS));
    });

    it('ZERO observations is refused — an empty denominator is not a measurement', () => {
        // And it is exactly the reading a broken recogniser produces, which is
        // the case a naive `falsePositives / observations` would score as 0/0.
        const v = enforcementAllowed({ sessions: 30, observations: 0, falsePositives: 0, artefact: 'x' });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/empty denominator/);
    });

    it('a rate exactly AT the threshold is refused — the bar is "below"', () => {
        const at = Math.round(1000 * MAX_FALSE_POSITIVE_RATE);
        const v = enforcementAllowed({ sessions: 30, observations: 1000, falsePositives: at, artefact: 'x' });
        expect(v.allowed).toBe(false);
    });

    it('a cleared measurement names the artefact, so the claim is checkable', () => {
        const v = enforcementAllowed({
            sessions: 30,
            observations: 1000,
            falsePositives: 2,
            artefact: 'agents/evidence/analysis/fp.md',
        });
        expect(v.allowed).toBe(true);
        expect(v.reason).toContain('agents/evidence/analysis/fp.md');
    });
});

describe('classification', () => {
    it.each([
        ['git push --force origin main', 'force-push'],
        ['git push --force-with-lease', 'force-push'],
        ['git push origin feat/x', 'push'],
        ['git rebase -i origin/main', 'history-rewrite'],
        ['git reset --hard HEAD~5', 'history-rewrite'],
        ['gh pr merge 123 --squash', 'merge-to-trunk'],
        ['gh release create v1.2.3', 'tag-or-release'],
        ['terraform apply -auto-approve', 'deploy'],
        ['kubectl apply -f prod.yaml', 'deploy'],
        ['rm -rf ./dist', 'bulk-delete'],
        ['DROP TABLE users;', 'bulk-delete'],
        ['npm publish', 'publish'],
    ])('%s is %s', (line, op) => {
        expect(classifyLine(line, 'shell-history')?.op).toBe(op);
    });

    it('the MORE SPECIFIC class wins — a forced push is not a push', () => {
        // Order in the recogniser table is load-bearing: a misordered table
        // reports the milder op for the more dangerous line, which is the wrong
        // direction for every downstream reader.
        expect(classifyLine('git push --force', 'reflog')?.op).toBe('force-push');
    });

    it('an ordinary command is not a typed op', () => {
        for (const line of ['git status', 'npm test', 'ls -la', 'git log --oneline']) {
            expect(classifyLine(line, 'shell-history')).toBeNull();
        }
    });

    it('at most ONE op per line — double-counting would corrupt the denominator', () => {
        const obs = observe(['git push --force origin main'], 'reflog');
        expect(obs).toHaveLength(1);
    });

    it('carries the source, because the sources differ in reliability', () => {
        expect(classifyLine('git push', 'forge-event')?.source).toBe('forge-event');
    });

    it('truncates evidence rather than storing an unbounded line', () => {
        const long = `git push ${'x'.repeat(5000)}`;
        expect((classifyLine(long, 'shell-history')?.evidence ?? '').length).toBeLessThanOrEqual(200);
    });

    it('recognises every declared op at least once, so none is vocabulary-only', () => {
        const lines = [
            'git push origin x',
            'git push --force origin x',
            'gh pr merge 1',
            'gh release create v1',
            'terraform apply',
            'rm -rf x',
            'git rebase main',
            'sendmail -t',
            'npm publish',
            'stripe charge create',
            'curl -X POST https://x/submit',
        ];
        const seen = new Set(observe(lines, 'shell-history').map((o) => o.op));
        for (const op of TYPED_OPS) expect(seen.has(op)).toBe(true);
    });
});
