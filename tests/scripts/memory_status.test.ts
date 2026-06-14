// Tests for src/scripts/memory_status.ts — file-backed status.
//
// 1:1 port of tests/test_memory_status.py (pytest → vitest, ADR-094 parity
// contract). Memory is entirely file-backed (no external backend); status()
// and health() are constant. The former package-detection machinery
// (`_find_cli`, `_probe_health`, present/misconfigured states) was removed
// with the agent-memory package. A trailing golden-parity block runs python3
// + tsx and asserts byte-identical output, skipped without python3.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ms from '../../src/scripts/memory_status.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_status.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_status.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

describe('memory_status.ts — status() / health()', () => {
    it('status is file-backed', () => {
        const r = ms.status();
        expect(r.status).toBe('file');
        expect(r.backend).toBe('file');
        expect(r.reason).toBeTruthy();
        expect(r.elapsed_ms).toBe(0);
    });

    it('status never raises', () => {
        // Constant + side-effect-free; refresh flag is a back-compat no-op.
        expect(ms.status(true).status).toBe('file');
    });

    it('health envelope shape', () => {
        const h = ms.health();
        expect(h['contract_version']).toBe(ms.CONTRACT_VERSION);
        expect(h['status']).toBe('ok');
        expect(h['backend_version']).toBe('0.0.0-file');
        expect((h['features'] as string[]).includes('file-fallback')).toBe(true);
    });
});

// --- golden parity vs python3 --------------------------------------------

describe.skipIf(!HAVE_PYTHON)('memory_status — golden parity', () => {
    let goldenTmp: string;
    beforeEach(() => {
        goldenTmp = mkdtempSync(join(tmpdir(), 'memstat-gold-'));
    });
    afterEach(() => {
        rmSync(goldenTmp, { recursive: true, force: true });
    });

    function parity(args: readonly string[]): { ts: ReturnType<typeof spawnSync>; py: ReturnType<typeof spawnSync> } {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8' });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8' });
        return { ts, py };
    }

    it('text output parity', () => {
        const { ts, py } = parity(['--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output parity', () => {
        const { ts, py } = parity(['--refresh', '--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--health parity', () => {
        const { ts, py } = parity(['--health', '--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('bad --format choice (exit 2) parity', () => {
        const { ts, py } = parity(['--format', 'xml']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
