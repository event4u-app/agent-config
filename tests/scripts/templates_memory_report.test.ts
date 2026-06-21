// Tests for src/agent-src/templates/scripts/memory_report.ts — observability report.
//
// Golden-parity harness (ADR-094): runs python3 + tsx on the consumer-template
// twin against tmp `agents/memory` fixtures and asserts byte-identical
// stdout/stderr/exit for the text + `--format json` paths and the error paths.
// The backend probe is neutralised with an isolated PATH (node + python3 only,
// no `memory`-family CLI) so the `backend` block is the deterministic `absent`
// shape on both sides. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_report.ts');
const PY_SCRIPT = join(SCRIPTS_DIR, 'memory_report.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

describe.skipIf(!HAVE_PYTHON)('templates/memory_report — golden parity', () => {
    let goldenTmp: string;
    let emptyPathDir: string;

    beforeEach(() => {
        goldenTmp = mkdtempSync(join(tmpdir(), 'tpl-memrep-gold-'));
        emptyPathDir = mkdtempSync(join(tmpdir(), 'tpl-memrep-path-'));
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
        // Empty PATH (no `memory` CLI) + cleared cache → deterministic absent backend.
        const env = { HOME: process.env['HOME'] ?? '', PATH: emptyPathDir, AGENT_MEMORY_STATUS: '' };
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8', env });
        return { ts, py };
    }

    function seedMemoryTree(): void {
        const memRoot = join(goldenTmp, 'agents', 'memory');
        const intake = join(memRoot, 'intake');
        mkdirSync(intake, { recursive: true });
        // Intake JSONL: 2 active (one ownership, one historical), 1 supersede.
        const lines = [
            JSON.stringify({ entry_type: 'ownership', path: 'app/A.php', body: 'team-a' }),
            JSON.stringify({ entry_type: 'historical-patterns', path: 'app/B.php', body: 'flake' }),
            JSON.stringify({ type: 'supersede', id: 'old-1' }),
            '', // blank line — must be skipped
            'not-json', // malformed — must be skipped
        ];
        writeFileSync(join(intake, 'signals-2026-05.jsonl'), `${lines.join('\n')}\n`, 'utf-8');

        // Curated single-file layout with an overdue + a current entry.
        const ownership = [
            'entries:',
            '  - id: own-overdue',
            '    last_validated: 2000-01-01',
            '    review_after_days: 30',
            '  - id: own-current',
            '    last_validated: 2999-01-01',
            '    review_after_days: 30',
            '  - id: own-no-review',
            '    last_validated: 2000-01-01',
        ].join('\n');
        writeFileSync(join(memRoot, 'ownership.yml'), `${ownership}\n`, 'utf-8');
    }

    it('text output parity (populated tree)', () => {
        seedMemoryTree();
        const { ts, py } = envParity([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output parity (populated tree)', () => {
        seedMemoryTree();
        const { ts, py } = envParity(['--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('text output parity (empty tree)', () => {
        const { ts, py } = envParity([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('json output parity (empty tree)', () => {
        const { ts, py } = envParity(['--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('bad --format choice (exit 2) parity', () => {
        const { ts, py } = envParity(['--format', 'xml']);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });

    it('unrecognized argument (exit 2) parity', () => {
        const { ts, py } = envParity(['--bogus']);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
    });
});
