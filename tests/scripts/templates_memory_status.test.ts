// Tests for src/agent-src/templates/scripts/memory_status.ts — backend probe.
//
// Golden-parity harness (ADR-094): runs python3 + tsx on the consumer-template
// twin against a deterministic `absent` probe (isolated PATH with node +
// python3 only, no `memory`-family CLI) and asserts byte-identical
// stdout/stderr/exit. The template `.ts` is byte-identical to the dev-side
// `src/scripts/memory_status.ts` apart from the header doc-comment path, so the
// behavioural contract is identical; this suite re-verifies it at the template
// path. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_status.ts');
const PY_SCRIPT = join(SCRIPTS_DIR, 'memory_status.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

describe.skipIf(!HAVE_PYTHON)('templates/memory_status — golden parity', () => {
    let goldenTmp: string;
    let emptyPathDir: string;
    beforeEach(() => {
        goldenTmp = mkdtempSync(join(tmpdir(), 'tpl-memstat-gold-'));
        // A PATH dir with node + python3 symlinks but NO `memory`-family CLI,
        // so both implementations resolve the deterministic `absent` probe.
        emptyPathDir = mkdtempSync(join(tmpdir(), 'tpl-memstat-path-'));
        const nodeBin = process.execPath;
        const py = spawnSync('which', ['python3'], { encoding: 'utf8' }).stdout.trim();
        spawnSync('ln', ['-s', nodeBin, join(emptyPathDir, 'node')]);
        if (py) {
            spawnSync('ln', ['-s', py, join(emptyPathDir, 'python3')]);
        }
    });
    afterEach(() => {
        rmSync(goldenTmp, { recursive: true, force: true });
        rmSync(emptyPathDir, { recursive: true, force: true });
    });

    function envParity(args: readonly string[]): { ts: ReturnType<typeof spawnSync>; py: ReturnType<typeof spawnSync> } {
        // Empty PATH (no `memory` CLI) + cleared cache env → deterministic absent.
        const env = { HOME: process.env['HOME'] ?? '', PATH: emptyPathDir, AGENT_MEMORY_STATUS: '' };
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        return { ts, py };
    }

    it('text output (absent) parity', () => {
        const { ts, py } = envParity(['--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output (absent) parity', () => {
        const { ts, py } = envParity(['--refresh', '--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('--health (absent) parity', () => {
        const { ts, py } = envParity(['--health', '--refresh']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    // Argparse error-path divergence (KNOWN, pre-existing in the dev-side
    // src/scripts/memory_status.ts which this template twin is byte-identical
    // to): the Python twin emits the full argparse block — a `usage:` line plus
    // `memory_status.py: error: …`; the TS twin emits only `memory_status:
    // error: …` (no usage line, prog `memory_status`, not `.py`). Exit code (2)
    // and the error wording match. These cases therefore assert exit-code
    // parity only, mirroring the dev twin's own golden test, not stderr bytes.
    // Re-flagged as a divergence candidate by this port, not introduced by it.
    it('bad --format choice (exit 2) parity', () => {
        const { ts, py } = envParity(['--format', 'xml']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });

    it('unrecognized argument (exit 2) parity', () => {
        const { ts, py } = envParity(['--bogus']);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
