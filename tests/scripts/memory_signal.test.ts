// Tests for src/scripts/memory_signal.ts — the write-side helper.
//
// 1:1 port of tests/test_memory_signal.py (pytest → vitest, ADR-090 parity
// contract). The pytest suite monkeypatches `INTAKE_ROOT`, `SETTINGS_FILE`,
// `_backend_status`, and `_monthly_file`; the TS twin exposes the same
// override surface via setter seams + the `_setBackendStatus` hook. A
// trailing golden-parity block runs python3 + tsx and asserts byte-identical
// behaviour (structural, since id/ts vary per run), skipped without python3.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as sig from '../../src/scripts/memory_signal.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_signal.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_signal.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'memsig-'));
    sig._setIntakeRoot(join(tmp, 'agents', 'memory', 'intake'));
    sig._setSettingsFile(join(tmp, '.agent-settings.yml'));
    // Default backend probe → absent (the pytest default has no CLI on PATH).
    sig._setBackendStatus(() => 'absent');
});
afterEach(() => {
    sig._setIntakeRoot(join('agents', 'memory', 'intake'));
    sig._setSettingsFile('.agent-settings.yml');
    sig._setBackendStatus(null);
    rmSync(tmp, { recursive: true, force: true });
});

function readAllLines(): Record<string, unknown>[] {
    const root = join(tmp, 'agents', 'memory', 'intake');
    if (!existsSync(root)) {
        return [];
    }
    const lines: Record<string, unknown>[] = [];
    for (const name of readdirSync(root)) {
        if (!(name.startsWith('signals-') && name.endsWith('.jsonl'))) {
            continue;
        }
        const text = readFileSync(join(root, name), 'utf-8');
        for (const line of text.split('\n')) {
            if (line.trim()) {
                lines.push(JSON.parse(line));
            }
        }
    }
    return lines;
}

describe('memory_signal.ts — emit()', () => {
    it('emit writes append-only jsonl', () => {
        const rec = sig.emit('historical-patterns', 'app/Foo.php', 'null deref when X is missing');
        expect(rec).not.toBeNull();
        const all = readAllLines();
        expect(all.length).toBe(1);
        const written = all[0] as Record<string, unknown>;
        expect(written['entry_type']).toBe('historical-patterns');
        expect(written['path']).toBe('app/Foo.php');
        expect(written['body']).toBe('null deref when X is missing');
        expect((written['id'] as string).startsWith('sig-')).toBe(true);
        expect(written['origin']).toBe('agent');
    });

    it('rate limit skips duplicate within window', () => {
        sig.emit('incident-learnings', 'queue/x.php', 'timeout on retry');
        const second = sig.emit('incident-learnings', 'queue/x.php', 'timeout on retry');
        expect(second, 'second emit within window must be skipped').toBeNull();
        expect(readAllLines().length).toBe(1);
    });

    it('force bypasses rate limit', () => {
        sig.emit('ownership', 'app/Http/Billing', 'team-payments');
        const again = sig.emit('ownership', 'app/Http/Billing', 'team-payments', { force: true });
        expect(again).not.toBeNull();
        expect(readAllLines().length).toBe(2);
    });

    it('rate limit does not skip different body', () => {
        sig.emit('historical-patterns', 'app/A.php', 'bug 1');
        const second = sig.emit('historical-patterns', 'app/A.php', 'bug 2');
        expect(second).not.toBeNull();
        expect(readAllLines().length).toBe(2);
    });

    it('rate limit window expiry', () => {
        // An entry older than the window must not block a fresh emit.
        sig.emit('historical-patterns', 'app/B.php', 'flake');
        const target = sig._monthly_file();
        const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const records = readFileSync(target, 'utf-8')
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // isoformat(timespec="seconds") with +00:00 offset.
        (records[0] as Record<string, unknown>)['ts'] = _isoSeconds(stale);
        writeFileSync(target, `${records.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
        const second = sig.emit('historical-patterns', 'app/B.php', 'flake');
        expect(second, 'emit outside rate-limit window must proceed').not.toBeNull();
    });

    it('unknown type raises', () => {
        expect(() => sig.emit('not-a-type', 'x', 'y')).toThrowError(/unknown memory type/);
    });

    it('missing fields raise', () => {
        expect(() => sig.emit('ownership', '', 'body')).toThrowError();
        expect(() => sig.emit('ownership', 'app/x', '')).toThrowError();
    });

    it('extra fields are preserved', () => {
        const rec = sig.emit('historical-patterns', 'app/Foo.php', 'off-by-one', {
            extra: { symptom: 'returns wrong count', severity: 'medium' },
        });
        expect(rec).not.toBeNull();
        expect((rec as Record<string, unknown>)['symptom']).toBe('returns wrong count');
        expect((rec as Record<string, unknown>)['severity']).toBe('medium');
    });

    it('extra cannot overwrite reserved', () => {
        const rec = sig.emit('ownership', 'app/x', 'team-x', {
            extra: { id: 'hijack', path: 'other' },
        });
        expect(rec).not.toBeNull();
        expect((rec as { id: string }).id.startsWith('sig-'), 'reserved id must not be overwritten').toBe(true);
        expect((rec as { path: string }).path).toBe('app/x');
    });

    it('skip_when_present true suppresses jsonl', () => {
        writeFileSync(join(tmp, '.agent-settings.yml'), 'memory:\n  intake:\n    skip_when_present: true\n', 'utf-8');
        sig._setBackendStatus(() => 'present');
        const rec = sig.emit('historical-patterns', 'app/Foo.php', 'x');
        expect(rec).not.toBeNull();
        expect((rec as Record<string, unknown>)['_backend']).toBe('package-only');
        const root = join(tmp, 'agents', 'memory', 'intake');
        const hasFiles =
            existsSync(root) && readdirSync(root).some((n) => n.startsWith('signals-') && n.endsWith('.jsonl'));
        expect(hasFiles).toBe(false);
    });

    it('skip_when_present false still writes', () => {
        writeFileSync(join(tmp, '.agent-settings.yml'), 'memory:\n  intake:\n    skip_when_present: false\n', 'utf-8');
        sig._setBackendStatus(() => 'present');
        const rec = sig.emit('historical-patterns', 'app/Bar.php', 'y');
        expect(rec).not.toBeNull();
        expect('_backend' in (rec as Record<string, unknown>)).toBe(false);
        expect(readAllLines().length).toBeGreaterThan(0);
    });

    it('backend absent writes regardless', () => {
        sig._setBackendStatus(() => 'absent');
        const rec = sig.emit('product-rules', 'app/Baz.php', 'z');
        expect(rec).not.toBeNull();
        expect('_backend' in (rec as Record<string, unknown>)).toBe(false);
        expect(readAllLines().length).toBeGreaterThan(0);
    });

    it('missing settings file defaults to writing', () => {
        // No settings file → never skip.
        sig._setBackendStatus(() => 'present');
        const rec = sig.emit('ownership', 'app/x', 'team-y');
        expect(rec).not.toBeNull();
        expect('_backend' in (rec as Record<string, unknown>)).toBe(false);
    });
});

function _isoSeconds(d: Date): string {
    const p = (n: number, w = 2): string => n.toString().padStart(w, '0');
    return (
        `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
        `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
    );
}

// --- golden parity vs python3 --------------------------------------------

describe.skipIf(!HAVE_PYTHON)('memory_signal — golden parity', () => {
    function run(bin: 'py' | 'ts', cwd: string, args: string[]): ReturnType<typeof spawnSync> {
        const env = { ...process.env, AGENT_MEMORY_STATUS: '' };
        if (bin === 'py') {
            return spawnSync('python3', [PY_SCRIPT, ...args], { cwd, encoding: 'utf8', env });
        }
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8', env });
    }

    it('emit stdout shape parity (id normalised)', () => {
        const pyDir = mkdtempSync(join(tmpdir(), 'memsig-gp-py-'));
        const tsDir = mkdtempSync(join(tmpdir(), 'memsig-gp-ts-'));
        try {
            const args = ['--type', 'historical-patterns', '--path', 'app/Foo.php', '--body', 'null deref'];
            const py = run('py', pyDir, args);
            const ts = run('ts', tsDir, args);
            const norm = (s: string): string => s.replace(/id=sig-[0-9a-f]+/g, 'id=sig-XXX');
            expect(norm(String(ts.stdout))).toBe(norm(String(py.stdout)));
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
            // Written record keys + non-id/ts values must match.
            const keysOf = (dir: string): string[] => {
                const root = join(dir, 'agents', 'memory', 'intake');
                const f = readdirSync(root).find((n) => n.endsWith('.jsonl')) as string;
                const obj = JSON.parse(readFileSync(join(root, f), 'utf-8').trim()) as Record<string, unknown>;
                return Object.keys(obj).sort();
            };
            expect(keysOf(tsDir)).toEqual(keysOf(pyDir));
        } finally {
            rmSync(pyDir, { recursive: true, force: true });
            rmSync(tsDir, { recursive: true, force: true });
        }
    });

    it('error-path stderr/exit parity', () => {
        const cases: string[][] = [
            ['--type', 'bogus', '--path', 'x', '--body', 'y'],
            ['--path', 'x'],
            ['--type', 'ownership', '--path', 'x', '--body', 'y', '--bogus'],
            ['--type', 'ownership', '--path', 'x', '--body', 'y', '--extra', '[1,2]'],
        ];
        for (const args of cases) {
            const dir = mkdtempSync(join(tmpdir(), 'memsig-err-'));
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
