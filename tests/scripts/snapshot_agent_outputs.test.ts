// Tests for src/scripts/snapshot_agent_outputs.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helper (_logical_path) plus a golden-parity layer that runs python3 vs
// tsx and compares stdout + the written snapshot JSON byte-for-byte. The
// snapshot is written to an absolute in-tree temp path (the default + relative
// paths fail in Python's `relative_to(ROOT)` print site); the temp file is
// removed afterwards so the test leaves zero git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { _logical_path } from '../../src/scripts/snapshot_agent_outputs.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'snapshot_agent_outputs.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'snapshot_agent_outputs.py');
const TMP_DIR = path.join(REPO_ROOT, 'dist', 'migration');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('snapshot_agent_outputs — _logical_path', () => {
    it('strips the legacy source-root prefix', () => {
        expect(_logical_path('.agent-src.uncondensed/rules/foo.md')).toBe('rules/foo.md');
    });
    it('strips the packages/<pkg>/.agent-src.uncondensed/ prefix', () => {
        expect(_logical_path('packages/core/.agent-src.uncondensed/skills/x/SKILL.md')).toBe(
            'skills/x/SKILL.md',
        );
    });
    it('returns non-source paths unchanged', () => {
        expect(_logical_path('dist/agent-src/rules/foo.md')).toBe('dist/agent-src/rules/foo.md');
    });
    it('normalises backslashes to posix', () => {
        expect(_logical_path('.agent-src.uncondensed\\rules\\foo.md')).toBe('rules/foo.md');
    });
});

describe.runIf(hasPython3())('snapshot_agent_outputs — golden parity (python3 vs tsx)', () => {
    const pyOut = path.join(TMP_DIR, '_snap.py.test.json');
    const tsOut = path.join(TMP_DIR, '_snap.ts.test.json');

    afterEach(() => {
        for (const f of [pyOut, tsOut]) {
            if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
    });

    it('stdout + written snapshot match for an absolute in-tree --out', () => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        // The "Snapshot: <rel>" line differs only in the temp filename stem.
        expect(ts.stdout.replace('_snap.ts.test', '_snap')).toBe(
            py.stdout.replace('_snap.py.test', '_snap'),
        );
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });

    it('exits non-zero for an out-of-tree --out (matches Python relative_to)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--out', '/tmp/_oot.py.json'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', '/tmp/_oot.ts.json'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        for (const f of ['/tmp/_oot.py.json', '/tmp/_oot.ts.json']) {
            if (fs.existsSync(f)) {
                fs.rmSync(f);
            }
        }
        expect(py.status).not.toBe(0);
        expect(ts.status).not.toBe(0);
    });
});
