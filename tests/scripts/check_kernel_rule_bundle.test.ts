// Tests for src/scripts/check_kernel_rule_bundle.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (_kernel_changes, KERNEL_RULES) plus a golden-parity layer
// (python3 vs tsx) using the deterministic `--files` override so the result
// does not depend on the local git graph (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { KERNEL_RULES, _kernel_changes } from '../../src/scripts/check_kernel_rule_bundle.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_kernel_rule_bundle.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_kernel_rule_bundle.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const R = '.agent-src.uncondensed/rules';

describe('check_kernel_rule_bundle — _kernel_changes', () => {
    it('counts kernel rules under the kernel dir only', () => {
        expect(_kernel_changes([`${R}/scope-control.md`])).toEqual([`${R}/scope-control.md`]);
        expect(
            _kernel_changes([`${R}/scope-control.md`, `${R}/commit-policy.md`]).length,
        ).toBe(2);
    });

    it('ignores non-kernel rules and files outside the kernel dir', () => {
        expect(_kernel_changes([`${R}/some-auto-rule.md`])).toEqual([]);
        expect(_kernel_changes(['docs/foo.md', 'src/scripts/x.ts'])).toEqual([]);
    });

    it('dedupes and sorts', () => {
        expect(
            _kernel_changes([`${R}/commit-policy.md`, `${R}/commit-policy.md`, `${R}/scope-control.md`]),
        ).toEqual([`${R}/commit-policy.md`, `${R}/scope-control.md`]);
    });

    it('the kernel set has exactly 9 rules', () => {
        expect(KERNEL_RULES.size).toBe(9);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_kernel_rule_bundle — golden parity (python3 vs tsx)', () => {
    const cases: ReadonlyArray<readonly string[]> = [
        ['--files'], // empty list → git diff fallback (deterministic at HEAD)
        ['--files', `${R}/scope-control.md`],
        ['--files', `${R}/scope-control.md`, `${R}/commit-policy.md`],
        ['--files', 'docs/unrelated.md'],
    ];
    it.each(cases.map((c) => [c] as const))('matches byte-for-byte for %j', (args) => {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
