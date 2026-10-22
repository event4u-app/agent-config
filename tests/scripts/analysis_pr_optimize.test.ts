import { describe, expect, it } from 'vitest';

import {
    eligibility,
    MAX_OPTIMIZE_ROUNDS,
    optimizePr,
    OptimizeError,
    type Fix,
    type OptimizePort,
    type PrBranch,
} from '../../src/scripts/analysis_pr_optimize.js';

const sha = (c: string): string => c.repeat(40);

const OPEN: PrBranch = { pr: 9, state: 'OPEN', headRefName: 'feat/pay', headSha: sha('1'), isCrossRepository: false, viewerCanPush: true };

interface Probe extends OptimizePort {
    pushes: Array<{ branch: string; expected: string }>;
    patches: number;
    remote: string;
}

function port(over: Partial<OptimizePort> = {}): Probe {
    let n = 1;
    const p: Probe = {
        pushes: [],
        patches: 0,
        remote: sha('1'),
        remoteHead: () => p.remote,
        applyFixes: (_fixes, _base) => {
            n += 1;
            return sha(String(n));
        },
        push: (branch, expected) => {
            if (expected !== p.remote) throw new Error('lease refused');
            p.pushes.push({ branch, expected });
            p.remote = sha(String(n));
        },
        writePatch: () => {
            p.patches += 1;
            return '/tmp/analyze-pr-9.patch';
        },
        ...over,
    };
    return p;
}

const finding = (key: string) => ({ key, file: 'src/pay.ts', line: 12 });
const testFix = (key: string): Fix => ({
    findingKey: key,
    disposition: { kind: 'regression-test-red', test: `tests/pay.test.ts > ${key}` },
    paths: ['src/pay.ts', 'tests/pay.test.ts'],
});

describe('eligibility (step 5.3)', () => {
    it('pushes only to an open, writable, same-repository PR branch', () => {
        expect(eligibility(OPEN)).toEqual({ kind: 'push', branch: 'feat/pay' });
        expect(eligibility({ ...OPEN, isCrossRepository: true })).toMatchObject({ kind: 'patch' });
        expect(eligibility({ ...OPEN, viewerCanPush: false })).toMatchObject({ kind: 'patch' });
        expect(eligibility({ ...OPEN, state: 'MERGED' })).toMatchObject({ kind: 'patch' });
        expect(eligibility({ ...OPEN, headRefName: 'main:evil' })).toMatchObject({ kind: 'patch' });
    });
});

describe('optimizePr (step 5.3)', () => {
    it('converges in at most three rounds with one disposition per fix, pushing on the expected head', () => {
        const p = port();
        const rounds = [[finding('f1'), finding('f2')], [finding('f3')], []];
        let i = 0;
        const out = optimizePr(OPEN, p, () => rounds[i++] ?? [], (fs) => fs.map((f) => testFix(f.key)));
        expect(out.end).toBe('converged');
        expect(out.rounds).toBe(2);
        expect(out.fixes.map((f) => f.findingKey)).toEqual(['f1', 'f2', 'f3']);
        expect(p.pushes.map((x) => x.expected)).toEqual([sha('1'), sha('2')]);
    });

    it('stops at the round cap when every round finds something new', () => {
        let i = 0;
        const out = optimizePr(OPEN, port(), () => [finding(`f${i++}`)], (fs) => fs.map((f) => testFix(f.key)));
        expect(out).toMatchObject({ end: 'round-cap', rounds: MAX_OPTIMIZE_ROUNDS });
    });

    it('a moved head stops before pushing', () => {
        const p = port();
        p.remote = sha('f');
        const out = optimizePr(OPEN, p, () => [finding('f1')], (fs) => fs.map((f) => testFix(f.key)));
        expect(out.end).toBe('moved-head');
        expect(p.pushes).toEqual([]);
    });

    it('a fork yields a patch file and no push', () => {
        const p = port();
        const out = optimizePr({ ...OPEN, isCrossRepository: true }, p, () => [finding('f1')], (fs) => fs.map((f) => testFix(f.key)));
        expect(out).toMatchObject({ end: 'patch', patch: '/tmp/analyze-pr-9.patch' });
        expect(p.pushes).toEqual([]);
        expect(p.patches).toBe(1);
    });

    it('refuses a fix set without exactly one disposition per finding', () => {
        expect(() => optimizePr(OPEN, port(), () => [finding('f1'), finding('f2')], () => [testFix('f1')])).toThrow(OptimizeError);
        expect(() => optimizePr(OPEN, port(), () => [finding('f1')], () => [testFix('f1'), testFix('f1')])).toThrow(OptimizeError);
    });

    it('an infeasible disposition needs a known reason code and a reviewer', () => {
        const bad: Fix = { findingKey: 'f1', disposition: { kind: 'infeasible', reasonCode: 'because', reviewedBy: 'openai' }, paths: ['src/pay.ts'] };
        expect(() => optimizePr(OPEN, port(), () => [finding('f1')], () => [bad])).toThrow(OptimizeError);
        const unreviewed: Fix = { findingKey: 'f1', disposition: { kind: 'infeasible', reasonCode: 'no-test-harness', reviewedBy: '' }, paths: ['src/pay.ts'] };
        expect(() => optimizePr(OPEN, port(), () => [finding('f1')], () => [unreviewed])).toThrow(OptimizeError);
        let i = 0;
        const ok: Fix = { findingKey: 'f1', disposition: { kind: 'infeasible', reasonCode: 'no-test-harness', reviewedBy: 'openai' }, paths: ['src/pay.ts'] };
        const out = optimizePr(OPEN, port(), () => (i++ === 0 ? [finding('f1')] : []), () => [ok]);
        expect(out.end).toBe('converged');
    });

    it('refuses a fix that declares no paths, or a path that escapes the worktree', () => {
        const run = (paths: string[]): unknown =>
            optimizePr(OPEN, port(), () => [finding('f1')], () => [{ ...testFix('f1'), paths }]);
        expect(() => run([])).toThrow(/declares no paths/);
        for (const bad of ['../outside.ts', '/etc/passwd', 'a/../../b', '.git/config', 'C:/x', '']) {
            expect(() => run([bad])).toThrow(OptimizeError);
        }
    });

    it('a finding still present after its fix was pushed ends the run as fix-failed, never converged', () => {
        const p = port();
        const out = optimizePr(OPEN, p, () => [finding('f1')], (fs) => fs.map((f) => testFix(f.key)));
        expect(out).toMatchObject({ end: 'fix-failed', rounds: 1, persisting: ['f1'] });
        expect(p.pushes).toHaveLength(1);
    });

    it('a lease refused at push time ends as moved-head instead of throwing', () => {
        const p = port({
            push: () => {
                throw new Error('stale info');
            },
        });
        const out = optimizePr(OPEN, p, () => [finding('f1')], (fs) => fs.map((f) => testFix(f.key)));
        expect(out.end).toBe('moved-head');
        expect(out.reason).toMatch(/lease/u);
    });

    it('the patch path writes the patch against the pinned PR head', () => {
        let base = '';
        const p = port({
            writePatch: (_pr, headSha) => {
                base = headSha;
                return '/tmp/x.patch';
            },
        });
        optimizePr({ ...OPEN, isCrossRepository: true }, p, () => [finding('f1')], (fs) => fs.map((f) => testFix(f.key)));
        expect(base).toBe(sha('1'));
    });
});
