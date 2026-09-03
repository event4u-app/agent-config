/**
 * `doctor --strict`, `--strict-level`, the kill switch, and the `can_proceed`
 * / `status` payload fields.
 *
 * WHY THE PREDICATES ARE TESTED IN ISOLATION. `main()` reaches its exit through
 * two paths — the drift branch and the no-manifest branch — and the first
 * implementation of `--strict` lived in only one of them, so it exited 0 on a
 * tree carrying a `fail` check row. That bug is invisible to a test that drives
 * one path. `_strictExit` is not exported (it is internal to the exit shape), so
 * what is pinned here is the two decision functions it composes, plus the
 * end-to-end CLI over both paths.
 */
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { canProceed, strictTripping } from '../../../src/scripts/_cli/_doctor_strict.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const ok = { id: 'a', status: 'ok' };
const warn = { id: 'b', status: 'warn' };
const fail = { id: 'c', status: 'fail' };
const skipped = { id: 'd', status: 'skipped' };

describe('strictTripping — the configurable severity threshold', () => {
    it('defaults to failing on `fail` only', () => {
        const t = strictTripping('fail');
        expect(t.has('fail')).toBe(true);
        expect(t.has('warn')).toBe(false);
        expect(t.has('ok')).toBe(false);
        expect(t.has('skipped')).toBe(false);
    });

    it('`warn` widens the bar to include warnings', () => {
        const t = strictTripping('warn');
        expect(t.has('fail')).toBe(true);
        expect(t.has('warn')).toBe(true);
        expect(t.has('ok')).toBe(false);
    });

    it('never trips on `ok` or `skipped` at either level', () => {
        for (const level of ['fail', 'warn']) {
            expect(strictTripping(level).has('ok')).toBe(false);
            expect(strictTripping(level).has('skipped')).toBe(false);
        }
    });
});

describe('canProceed — a fact about the tree, not a policy', () => {
    it('is true on a clean tree with warnings', () => {
        expect(canProceed(false, [ok, warn, skipped])).toBe(true);
    });

    it('is false when any check failed', () => {
        expect(canProceed(false, [ok, fail])).toBe(false);
    });

    it('is false on manifest drift even with every check ok', () => {
        expect(canProceed(true, [ok, ok])).toBe(false);
    });

    it('is true on an empty check set with no drift', () => {
        expect(canProceed(false, [])).toBe(true);
    });
});

describe('the CLI contract', () => {
    const run = (args: readonly string[], env: Record<string, string> = {}): number => {
        try {
            execFileSync(
                path.join(REPO_ROOT, 'scripts-run'),
                ['src/scripts/_cli/cmd_doctor', ...args],
                { cwd: REPO_ROOT, env: { ...process.env, ...env }, stdio: 'pipe' },
            );
            return 0;
        } catch (e) {
            return (e as { status?: number }).status ?? -1;
        }
    };

    it('the default run keeps its exit contract — the whole point of option (b)', () => {
        // Unchanged behaviour for every existing caller. If this ever fails,
        // the council's decision has been reversed by accident.
        expect(run([])).toBe(0);
    });

    /**
     * DERIVED, never hardcoded. Asserting "this tree has a fail row, so strict
     * exits 1" would pin a fact about today's checkout — the day somebody
     * repairs the failing check, the test breaks while the code is correct.
     * The payload answers what the tree currently is, and the exit code is
     * asserted against THAT. The relationship is the invariant.
     */
    const expectedStrictExit = (): number => {
        const out = execFileSync(
            path.join(REPO_ROOT, 'scripts-run'),
            ['src/scripts/_cli/cmd_doctor', '--json'],
            { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
        );
        return (JSON.parse(out) as { can_proceed: boolean }).can_proceed ? 0 : 1;
    };

    it('--strict exits non-zero exactly when the tree is not proceedable', () => {
        expect(run(['--strict'])).toBe(expectedStrictExit());
    });

    it('the kill switch suppresses the exit without suppressing the finding', () => {
        expect(run(['--strict'], { AGENT_CONFIG_DOCTOR_NO_FAIL: '1' })).toBe(0);
    });

    it('the kill switch only fires on the literal "1"', () => {
        const expected = expectedStrictExit();
        expect(run(['--strict'], { AGENT_CONFIG_DOCTOR_NO_FAIL: 'true' })).toBe(expected);
        expect(run(['--strict'], { AGENT_CONFIG_DOCTOR_NO_FAIL: '0' })).toBe(expected);
    });

    it('rejects an unknown --strict-level rather than treating it as the default', () => {
        expect(run(['--strict', '--strict-level', 'nope'])).toBe(2);
    });

    it('--json carries can_proceed and status', () => {
        const out = execFileSync(
            path.join(REPO_ROOT, 'scripts-run'),
            ['src/scripts/_cli/cmd_doctor', '--json'],
            { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
        );
        const payload = JSON.parse(out) as Record<string, unknown>;
        expect(Object.keys(payload)).toContain('can_proceed');
        expect(Object.keys(payload)).toContain('status');
        expect(typeof payload['can_proceed']).toBe('boolean');
        expect(['ok', 'warn', 'fail']).toContain(payload['status']);
        // The two agree by construction: `status: fail` is exactly not-proceedable.
        expect(payload['can_proceed']).toBe(payload['status'] !== 'fail');
    });
});
