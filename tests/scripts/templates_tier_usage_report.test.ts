// Intent tests for src/agent-src/templates/scripts/tier_usage_report.ts.
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx template-script's own contract directly: the table + `--json`
// happy paths, the privacy floor (drop leaked/invalid records; refuse with
// exit 1 when none survive), disabled-telemetry, enabled-with-absent-log,
// missing-log-path, and the two argparse exit-2 paths. Output is fully
// deterministic (no backend probe, no id/ts generation) so `--window-days 0`
// (full log) avoids any wall-clock dependence. The `--json` output embeds the
// absolute `--log-path`, so `norm()` collapses the per-run tmp dir to `<TMP>`
// (and the macOS `/private` realpath prefix) for Linux-CI-stable snapshots.
// COLUMNS=200 keeps argparse usage from re-wrapping.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? resolve(REPO_ROOT, _TSX_ENV)
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'tier_usage_report.ts');

// A 16-char user_hash (the privacy floor requires exactly 16 chars).
const UH = (n: number): string => `u${String(n).padStart(15, '0')}`;

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}

describe('templates/tier_usage_report — template contract', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkdtempSync(join(tmpdir(), 'tpl-tier-'));
    });
    afterEach(() => {
        rmSync(tmp, { recursive: true, force: true });
    });

    // Mask the per-run tmp dir → `<TMP>`, collapsing the macOS `/private`
    // realpath prefix so snapshots match on Linux CI.
    function norm(s: string): string {
        let out = s.split(`/private${tmp}`).join('<TMP>');
        out = out.split(tmp).join('<TMP>');
        return out;
    }

    function runTs(args: readonly string[]): Run {
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            cwd: tmp,
            encoding: 'utf8',
            env: { ...process.env, COLUMNS: '200' },
        });
        return {
            status: r.status,
            stdout: norm(r.stdout ?? ''),
            stderr: norm(r.stderr ?? ''),
        };
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

    it('table output (--log-path, full window)', () => {
        const log = writeLog('usage.jsonl', validRecords());
        expect(runTs(['--log-path', log, '--window-days', '0'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "Tier  Command                            Calls   Users
          ------------------------------------------------------
          0     help                                   1       1
          1     commit                                 3       2
          2     review                                 1       1

          (window:(full log))
          ",
          }
        `);
    });

    it('json output (--log-path, full window)', () => {
        const log = writeLog('usage.jsonl', validRecords());
        expect(runTs(['--log-path', log, '--window-days', '0', '--json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "window_days": 0,
            "log_path": "<TMP>/usage.jsonl",
            "records_total": 5,
            "records_kept": 5,
            "rows": [
              {
                "tier": 0,
                "command": "help",
                "count": 1,
                "distinct_users": 1
              },
              {
                "tier": 1,
                "command": "commit",
                "count": 3,
                "distinct_users": 2
              },
              {
                "tier": 2,
                "command": "review",
                "count": 1,
                "distinct_users": 1
              }
            ]
          }
          ",
          }
        `);
    });

    it('privacy floor drops leaked/invalid records (--json)', () => {
        // Mix valid records with floor violations: extra field, bad tier, bad
        // outcome, short hash, command with a slash.
        const recs: Record<string, unknown>[] = [
            ...validRecords(),
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'commit', tier: 1, outcome: 'success', user_hash: UH(1), leak: 'oops' },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 9, outcome: 'success', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'nope', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'success', user_hash: 'short' },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'a/b', tier: 1, outcome: 'success', user_hash: UH(1) },
        ];
        const log = writeLog('usage.jsonl', recs);
        expect(runTs(['--log-path', log, '--window-days', '0', '--json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "window_days": 0,
            "log_path": "<TMP>/usage.jsonl",
            "records_total": 10,
            "records_kept": 5,
            "rows": [
              {
                "tier": 0,
                "command": "help",
                "count": 1,
                "distinct_users": 1
              },
              {
                "tier": 1,
                "command": "commit",
                "count": 3,
                "distinct_users": 2
              },
              {
                "tier": 2,
                "command": "review",
                "count": 1,
                "distinct_users": 1
              }
            ]
          }
          ",
          }
        `);
    });

    it('all-records-dropped → exit 1', () => {
        // Every record violates the floor → total>0, kept==0 → exit 1.
        const recs: Record<string, unknown>[] = [
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 9, outcome: 'success', user_hash: UH(1) },
            { ts_bucket: '2026-05-01T00:00:00+00:00', command: 'x', tier: 1, outcome: 'nope', user_hash: UH(1) },
        ];
        const log = writeLog('usage.jsonl', recs);
        const ts = runTs(['--log-path', log, '--window-days', '0']);
        expect(ts.status).toBe(1);
        expect(ts).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "❌  2 record(s) read; 0 survived the privacy floor — report refused
          ",
            "stdout": "",
          }
        `);
    });

    it('telemetry disabled (no --log-path, no settings)', () => {
        // No settings file → disabled → single header line, exit 0.
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "(tier-usage telemetry disabled; set \`telemetry.tier_usage.enabled: true\` in .agent-settings.yml)
          ",
          }
        `);
    });

    it('telemetry enabled via settings, default log absent → empty table', () => {
        // Enabled but the default log path does not exist → empty table, exit 0.
        writeFileSync(
            join(tmp, '.agent-settings.yml'),
            'telemetry:\n  tier_usage:\n    enabled: true\n',
            'utf-8',
        );
        expect(runTs(['--window-days', '0'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "(no tier-usage records (full log))
          ",
          }
        `);
    });

    it('missing --log-path file → empty table, exit 0', () => {
        // --log-path provided (bypasses the disabled check) but file is missing.
        expect(runTs(['--log-path', join(tmp, 'nope.jsonl'), '--window-days', '0'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "(no tier-usage records (full log))
          ",
          }
        `);
    });

    it('bad --window-days int → exit 2', () => {
        const ts = runTs(['--window-days', 'abc']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "usage: tier_usage_report.py [-h] [--window-days WINDOW_DAYS] [--json]
                                      [--log-path LOG_PATH]
                                      [--settings-file SETTINGS_FILE]
          tier_usage_report.py: error: argument --window-days: invalid int value: 'abc'
          "
        `);
    });

    it('unrecognized argument → exit 2', () => {
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toMatchInlineSnapshot(`
          "usage: tier_usage_report.py [-h] [--window-days WINDOW_DAYS] [--json]
                                      [--log-path LOG_PATH]
                                      [--settings-file SETTINGS_FILE]
          tier_usage_report.py: error: unrecognized arguments: --bogus
          "
        `);
    });
});
