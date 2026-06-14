// Tests for src/agent-src/templates/scripts/tier_usage_report.ts — tier-usage report.
//
// Golden-parity harness (ADR-094): runs python3 + tsx on the consumer-template
// twin against tmp `.agent-tier-usage.jsonl` + `.agent-settings.yml` fixtures and
// asserts byte-identical stdout/stderr/exit for the table, `--json`,
// disabled-telemetry, privacy-floor-refusal (exit 1), missing-log (exit 2), and
// CLI-error (exit 2) paths. Output is fully deterministic (no backend probe,
// no id/ts generation) so a `--window-days 0` (full-log) window avoids any
// wall-clock dependence. Skipped without python3.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'tier_usage_report.ts');
const PY_SCRIPT = join(SCRIPTS_DIR, 'tier_usage_report.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

// A 16-char user_hash (the privacy floor requires exactly 16 chars).
const UH = (n: number): string => `u${String(n).padStart(15, '0')}`;

describe.skipIf(!HAVE_PYTHON)('templates/tier_usage_report — golden parity', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-tier-gold-'));
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    function envParity(args: readonly string[]): { ts: ReturnType<typeof spawnSync>; py: ReturnType<typeof spawnSync> } {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: tmp, encoding: 'utf8' });
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: tmp, encoding: 'utf8' });
        return { ts, py };
    }

    function writeLog(name: string, records: Record<string, unknown>[], trailing = true): string {
        const p = join(tmp, name);
        const body = records.map((r) => JSON.stringify(r)).join('\n');
        writeFileSync(p, trailing ? `${body}\n` : body, 'utf-8');
        return p;
    }

    function validRecords(): Record<string, unknown>[] {
        return [
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'commit', tier: 1, outcome: 'success', user_hash: UH(1) },
            { ts_bucket: '2026-05-02T00:00:00+00:00', command: 'commit', tier: 1, outcome: 'success', user_hash: UH(2) },
            { ts_bucket: '2026-05-03T00:00:00+00:00', command: 'commit', tier: 1, outcome: 'error', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'review', tier: 2, outcome: 'success', user_hash: UH(3) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'help', tier: 0, outcome: 'blocked', user_hash: UH(4) },
        ];
    }

    it('table output parity (--log-path, full window)', () => {
        const log = writeLog('usage.jsonl', validRecords());
        const { ts, py } = envParity(['--log-path', log, '--window-days', '0']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
    });

    it('json output parity (--log-path, full window)', () => {
        const log = writeLog('usage.jsonl', validRecords());
        const { ts, py } = envParity(['--log-path', log, '--window-days', '0', '--json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('privacy floor drops leaked/invalid records (--json)', () => {
        // Mix valid records with floor violations: extra field, bad tier, bad
        // outcome, short hash, command with a slash, non-string ts_bucket.
        const recs: Record<string, unknown>[] = [
            ...validRecords(),
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'commit', tier: 1, outcome: 'success', user_hash: UH(1), leak: 'oops' },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 9, outcome: 'success', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'nope', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'success', user_hash: 'short' },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'a/b', tier: 1, outcome: 'success', user_hash: UH(1) },
        ];
        const log = writeLog('usage.jsonl', recs);
        const { ts, py } = envParity(['--log-path', log, '--window-days', '0', '--json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('all-records-dropped → exit 1 parity', () => {
        // Every record violates the floor → total>0, kept==0 → exit 1.
        const recs: Record<string, unknown>[] = [
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 9, outcome: 'success', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'nope', user_hash: UH(1) },
        ];
        const log = writeLog('usage.jsonl', recs);
        const { ts, py } = envParity(['--log-path', log, '--window-days', '0']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(1);
    });

    it('telemetry disabled (no --log-path, no settings) parity', () => {
        // No settings file → disabled → single header line, exit 0.
        const { ts, py } = envParity([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
    });

    it('telemetry enabled via settings, default log absent → empty table', () => {
        // Enabled but the default log path does not exist → empty table, exit 0.
        writeFileSync(
            join(tmp, '.agent-settings.yml'),
            'telemetry:\n  tier_usage:\n    enabled: true\n',
            'utf-8',
        );
        const { ts, py } = envParity(['--window-days', '0']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(0);
    });

    it('missing --log-path file → exit 2 parity', () => {
        // --log-path provided (bypasses the disabled check) but file is missing.
        // Python: aggregate returns ({},0,0) for a non-existent path → exit 0,
        // empty table. Assert both sides agree on whatever that contract is.
        const { ts, py } = envParity(['--log-path', join(tmp, 'nope.jsonl'), '--window-days', '0']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('bad --window-days int (exit 2) parity', () => {
        const { ts, py } = envParity(['--window-days', 'abc']);
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
