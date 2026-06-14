// Tests for src/agent-src/templates/scripts/memory_signal.ts — write-side helper.
//
// Golden-parity harness (ADR-094): runs python3 + tsx on the consumer-template
// twin and asserts byte-identical behaviour. The generated `id` (secrets.token_hex)
// and `ts` (wall clock) are non-deterministic, so the emit-success stdout is
// compared with id normalised, and the written-record key set + non-id/ts
// values are asserted equal. Error paths are byte-compared directly. The
// template `memory_signal.py` always writes the JSONL trail (it has no backend
// skip path), so no backend stub is needed. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_signal.ts');
const PY_SCRIPT = join(SCRIPTS_DIR, 'memory_signal.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

describe.skipIf(!HAVE_PYTHON)('templates/memory_signal — golden parity', () => {
    function run(bin: 'py' | 'ts', cwd: string, args: string[]): ReturnType<typeof spawnSync> {
        const env = { ...process.env, AGENT_MEMORY_STATUS: '' };
        if (bin === 'py') {
            return spawnSync('python3', [PY_SCRIPT, ...args], { cwd, encoding: 'utf8', env });
        }
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8', env });
    }

    function writtenRecordKeys(dir: string): string[] {
        const root = join(dir, 'agents', 'memory', 'intake');
        const f = readdirSync(root).find((n) => n.endsWith('.jsonl')) as string;
        const obj = JSON.parse(readFileSync(join(root, f), 'utf-8').trim()) as Record<string, unknown>;
        return Object.keys(obj).sort();
    }

    function nonVolatileValues(dir: string): Record<string, unknown> {
        const root = join(dir, 'agents', 'memory', 'intake');
        const f = readdirSync(root).find((n) => n.endsWith('.jsonl')) as string;
        const obj = JSON.parse(readFileSync(join(root, f), 'utf-8').trim()) as Record<string, unknown>;
        // id + ts are non-deterministic (token_hex + wall clock).
        delete obj['id'];
        delete obj['ts'];
        return obj;
    }

    it('emit stdout shape parity (id normalised)', () => {
        const pyDir = mkdtempSync(join(tmpdir(), 'tpl-memsig-py-'));
        const tsDir = mkdtempSync(join(tmpdir(), 'tpl-memsig-ts-'));
        try {
            const args = ['--type', 'historical-patterns', '--path', 'app/Foo.php', '--body', 'null deref'];
            const py = run('py', pyDir, args);
            const ts = run('ts', tsDir, args);
            const norm = (s: string): string => s.replace(/id=sig-[0-9a-f]+/g, 'id=sig-XXX');
            expect(norm(String(ts.stdout))).toBe(norm(String(py.stdout)));
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
            expect(writtenRecordKeys(tsDir)).toEqual(writtenRecordKeys(pyDir));
            expect(nonVolatileValues(tsDir)).toEqual(nonVolatileValues(pyDir));
        } finally {
            rmSync(pyDir, { recursive: true, force: true });
            rmSync(tsDir, { recursive: true, force: true });
        }
    });

    it('emit with extra preserves extra keys (id normalised)', () => {
        const pyDir = mkdtempSync(join(tmpdir(), 'tpl-memsig-py-'));
        const tsDir = mkdtempSync(join(tmpdir(), 'tpl-memsig-ts-'));
        try {
            const args = [
                '--type',
                'ownership',
                '--path',
                'app/Bill',
                '--body',
                'team-x',
                '--extra',
                '{"symptom":"flaky","owner":"team-x"}',
            ];
            const py = run('py', pyDir, args);
            const ts = run('ts', tsDir, args);
            const norm = (s: string): string => s.replace(/id=sig-[0-9a-f]+/g, 'id=sig-XXX');
            expect(norm(String(ts.stdout))).toBe(norm(String(py.stdout)));
            expect(ts.status).toBe(py.status);
            expect(writtenRecordKeys(tsDir)).toEqual(writtenRecordKeys(pyDir));
            expect(nonVolatileValues(tsDir)).toEqual(nonVolatileValues(pyDir));
        } finally {
            rmSync(pyDir, { recursive: true, force: true });
            rmSync(tsDir, { recursive: true, force: true });
        }
    });

    it('error-path stderr/exit parity', () => {
        const cases: string[][] = [
            ['--type', 'bogus', '--path', 'x', '--body', 'y'], // invalid choice
            ['--path', 'x'], // missing required
            ['--type', 'ownership', '--path', 'x', '--body', 'y', '--bogus'], // unrecognized
            ['--type', 'ownership', '--path', 'x', '--body', 'y', '--extra', '[1,2]'], // --extra not an object
            [], // no args → required-args error
        ];
        for (const args of cases) {
            const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
            try {
                const py = run('py', dir, args);
                const ts = run('ts', dir, args);
                expect(ts.stdout, `stdout ${args.join(' ')}`).toBe(py.stdout);
                expect(ts.stderr, `stderr ${args.join(' ')}`).toBe(py.stderr);
                expect(ts.status, `exit ${args.join(' ')}`).toBe(py.status);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        }
    });
});
