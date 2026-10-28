/**
 * H.6 — a printed bisect plan, and a cause confirmed only on test evidence.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bisectPlan, causesPath, confirmCause, readCauses } from '../../src/scripts/code_graph/bisect_plan.js';

describe('bisectPlan', () => {
    it('prints a detached-worktree plan between the oldest candidate parent and the newest', () => {
        const p = bisectPlan({ candidates: ['aaa1111', 'bbb2222', 'ccc3333'], test: 'npx vitest run tests/sum.test.ts' });
        expect(p.ok).toBe(true);
        const lines = p.ok ? p.lines : [];
        expect(lines[0]).toBe('git worktree add --detach ../bisect-tmp ccc3333');
        expect(lines).toContain('git bisect start ccc3333 aaa1111^');
        expect(lines).toContain('git bisect run npx vitest run tests/sum.test.ts');
        expect(lines.join('\n')).not.toMatch(/push|checkout|switch/);
    });

    it('refuses one candidate, no test, or a test command with a push or shell metacharacters', () => {
        expect(bisectPlan({ candidates: ['a'], test: 't' }).ok).toBe(false);
        expect(bisectPlan({ candidates: ['a', 'b'], test: null }).ok).toBe(false);
        expect(bisectPlan({ candidates: ['a', 'b'], test: 'make test && git push' }).ok).toBe(false);
        expect(bisectPlan({ candidates: ['a', 'b'], test: 'git push origin x' }).ok).toBe(false);
    });
});

describe('confirmCause', () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bisect-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('stays a hypothesis unless the test fails at the cause and passes at the fix', () => {
        expect(confirmCause(dir, { bug: 'sentry:a/b/1', test: 'tests/sum.test.ts', cause: 'abc', failsAtCause: false, passesAtFix: true }).state).toBe('hypothesis');
        expect(confirmCause(dir, { bug: 'sentry:a/b/1', test: 'tests/sum.test.ts', cause: 'abc', failsAtCause: true, passesAtFix: false }).state).toBe('hypothesis');
        expect(fs.existsSync(causesPath(dir))).toBe(false);
    });

    it('a confirmed cause is a test_guards_against edge from the test to the bug, stored 0600', () => {
        const v = confirmCause(dir, { bug: 'sentry:a/b/1', test: 'tests/sum.test.ts', cause: 'abc', failsAtCause: true, passesAtFix: true, now: new Date('2026-10-01T00:00:00Z') });
        expect(v.state).toBe('confirmed');
        expect(readCauses(dir)).toEqual([{ source: 'tests/sum.test.ts', target: 'sentry:a/b/1', relation: 'test_guards_against', cause: 'abc', confirmed_at: '2026-10-01T00:00:00.000Z' }]);
        expect(fs.statSync(causesPath(dir)).mode & 0o777).toBe(0o600);
        confirmCause(dir, { bug: 'sentry:a/b/1', test: 'tests/sum.test.ts', cause: 'def', failsAtCause: true, passesAtFix: true });
        expect(readCauses(dir).map((e) => e.cause)).toEqual(['def']);
    });
});
