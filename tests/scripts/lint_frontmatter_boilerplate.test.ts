// Tests for src/scripts/lint_frontmatter_boilerplate.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (the inlined _same type-safe equality and
// _plan_drops planner — see DC-1 in the source) plus a golden-parity layer
// that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as lfb from '../../src/scripts/lint_frontmatter_boilerplate.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_frontmatter_boilerplate.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_frontmatter_boilerplate.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_frontmatter_boilerplate — _same (type-safe equality)', () => {
    it('bool default: only matches a bool of the same value', () => {
        expect(lfb._same(true, true)).toBe(true);
        expect(lfb._same(false, false)).toBe(true);
        expect(lfb._same(1, true)).toBe(false); // True == 1 must NOT match
        expect(lfb._same(true, false)).toBe(false);
    });

    it('numeric default: a bool value never matches', () => {
        expect(lfb._same(1, 1)).toBe(true);
        expect(lfb._same(true, 1)).toBe(false); // bool value short-circuits to false
    });

    it('string default: matches equal strings only', () => {
        expect(lfb._same('x', 'x')).toBe(true);
        expect(lfb._same('x', 'y')).toBe(false);
        expect(lfb._same(0, 'x')).toBe(false);
    });

    it('null default matches only null', () => {
        expect(lfb._same(null, null)).toBe(true);
        expect(lfb._same('x', null)).toBe(false);
    });

    it('list / object defaults match structurally', () => {
        expect(lfb._same([1, 2], [1, 2])).toBe(true);
        expect(lfb._same([1, 2], [2, 1])).toBe(false);
        expect(lfb._same({ a: 1 }, { a: 1 })).toBe(true);
        expect(lfb._same({ a: 1 }, { a: 2 })).toBe(false);
    });
});

describe('lint_frontmatter_boilerplate — _plan_drops', () => {
    it('drops a top-level field equal to its schema default', () => {
        const schema = { properties: { kind: { default: 'plain' } } };
        const plan = lfb._plan_drops({ kind: 'plain' }, schema);
        expect([...plan.top]).toEqual(['kind']);
        expect([...plan.full]).toEqual([]);
        expect(plan.partial.size).toBe(0);
    });

    it('keeps a top-level field that differs from the default', () => {
        const schema = { properties: { kind: { default: 'plain' } } };
        const plan = lfb._plan_drops({ kind: 'fancy' }, schema);
        expect([...plan.top]).toEqual([]);
    });

    it('drops a whole object block when every present sub-key is defaulted', () => {
        const schema = {
            properties: {
                opts: { type: 'object', properties: { a: { default: 1 }, b: { default: 2 } } },
            },
        };
        const plan = lfb._plan_drops({ opts: { a: 1, b: 2 } }, schema);
        expect([...plan.full]).toEqual(['opts']);
        expect(plan.partial.size).toBe(0);
    });

    it('partial-drops an object block when only some sub-keys are defaulted', () => {
        const schema = {
            properties: {
                opts: { type: 'object', properties: { a: { default: 1 }, b: { default: 2 } } },
            },
        };
        const plan = lfb._plan_drops({ opts: { a: 1, b: 99 } }, schema);
        expect([...plan.full]).toEqual([]);
        expect([...(plan.partial.get('opts') ?? [])]).toEqual(['a']);
    });

    it('exposes the _CATEGORIES inventory', () => {
        const subdirs = lfb._CATEGORIES.map((c) => c[0]);
        expect(subdirs).toEqual(['skills', 'rules', 'commands', 'personas']);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_frontmatter_boilerplate — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches the --quiet run byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
