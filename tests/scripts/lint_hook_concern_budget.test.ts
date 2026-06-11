// Tests for src/scripts/lint_hook_concern_budget.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_hook_concern_budget.py exists. This is a focused
// differential suite over the exported `_read_settings_block` minimal-YAML
// walk + the default constants, plus a golden-parity layer running python3 vs
// tsx on the REAL REPO (the linter's real CI invocation), skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as hcb from '../../src/scripts/lint_hook_concern_budget.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hook_concern_budget.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_hook_concern_budget.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_hook_concern_budget — defaults', () => {
    it('mirrors the Python default constants', () => {
        expect(hcb.DEFAULT_MAX_PER_EVENT).toBe(8);
        expect(hcb.DEFAULT_TIER1).toEqual([]);
        expect(hcb.DEFAULT_HARD_FAIL).toBe(false);
    });
});

describe('lint_hook_concern_budget._read_settings_block', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hcb-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(body: string): string {
        const p = path.join(tmp, 'settings.yml');
        fs.writeFileSync(p, body);
        return p;
    }

    it('returns {} for a missing file', () => {
        expect(hcb._read_settings_block(path.join(tmp, 'nope.yml'))).toEqual({});
    });
    it('returns {} when there is no hooks block', () => {
        expect(hcb._read_settings_block(write('other:\n  x: 1\n'))).toEqual({});
    });
    it('reads max_per_event + hard_fail', () => {
        const p = write('hooks:\n  concern_budget:\n    max_per_event: 5\n    hard_fail: true\n');
        expect(hcb._read_settings_block(p)).toEqual({ max_per_event: 5, hard_fail: true });
    });
    it('reads an empty tier1_concerns list', () => {
        const p = write('hooks:\n  concern_budget:\n    tier1_concerns: []\n');
        expect(hcb._read_settings_block(p)).toEqual({ tier1_concerns: [] });
    });
    it('reads a block tier1_concerns list', () => {
        const p = write(
            'hooks:\n  concern_budget:\n    tier1_concerns:\n      - alpha\n      - beta\n',
        );
        expect(hcb._read_settings_block(p)).toEqual({ tier1_concerns: ['alpha', 'beta'] });
    });
    it('stops the hooks block at the next top-level key', () => {
        const p = write(
            'hooks:\n  concern_budget:\n    max_per_event: 3\nother:\n  concern_budget:\n    max_per_event: 99\n',
        );
        expect(hcb._read_settings_block(p)).toEqual({ max_per_event: 3 });
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_hook_concern_budget — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run (real CI invocation) matches byte-for-byte', () => same([]));
    it('--strict matches byte-for-byte', () => same(['--strict']));
});
