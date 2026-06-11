// Tests for src/scripts/lint_no_new_atomic_commands.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: a load_locked_clusters + check_file unit
// check against the REAL contract and a sandboxed command file (byte-identical
// violation messages), plus a golden-parity layer (python3 vs tsx on the REAL
// REPO across default + --all). Both binaries shell out to the SAME git state,
// so the comparison is deterministic within a run. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_no_new_atomic_commands.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_no_new_atomic_commands.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_no_new_atomic_commands.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_no_new_atomic_commands — constants + helpers', () => {
    it('CLUSTER_CONTRACT points at the locked-clusters doc', () => {
        expect(mod.CLUSTER_CONTRACT).toBe('docs/contracts/command-clusters.md');
    });

    it('load_locked_clusters parses a non-empty set from the real contract', () => {
        const clusters = mod.load_locked_clusters();
        expect(clusters.size).toBeGreaterThan(0);
    });

    it('check_file flags a missing cluster frontmatter', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lnac-'));
        try {
            const p = path.join(tmp, 'cmd.md');
            fs.writeFileSync(p, '---\ndescription: x\n---\nbody\n');
            const v = mod.check_file(p, new Set(['work', 'fix']));
            expect(v).not.toBeNull();
            expect(v!.reason).toContain('missing `cluster:` frontmatter');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('check_file exempts a superseded_by shim', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lnac-'));
        try {
            const p = path.join(tmp, 'shim.md');
            fs.writeFileSync(p, '---\nsuperseded_by: work\n---\nbody\n');
            expect(mod.check_file(p, new Set(['work']))).toBeNull();
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_no_new_atomic_commands — golden parity (python3 vs tsx)', () => {
    const runPy = (args: readonly string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: readonly string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    for (const args of [[], ['--all']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
