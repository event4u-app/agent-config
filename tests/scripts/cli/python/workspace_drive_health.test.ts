// Intent tests for src/cli/python/workspace_drive_health.ts (py2ts ADR-200 —
// the drive-health + kill-switch CLI, ADR-073).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly via normalized inline snapshots.
//
// The CLI keeps a tiny per-host JSON cache under `<root>/<host>.json`, so each
// test gets its OWN per-test temp health root (beforeEach/afterEach) — no shared
// state, no cross-test races.
//
// `_validate_cli_root` rejects any `--root` whose basename is not `health`, so
// every root is a `<tmp>/workspace/health` directory.
//
// Determinism:
//  - `killed_at` / `probe_started_at` carry live epoch floats (`Date.now()/1000`)
//    that differ run-to-run. The `norm()` helper masks their numeric values with
//    a `<T>` placeholder before snapshotting, so the rest of the state stays a
//    true assertion. Everything else in the state (counters, flags, host id,
//    sorted JSON key order) is fully deterministic.
//  - Every case spawns with a **node-only PATH** (a temp dir holding just a
//    `node` symlink) so nothing machine-dependent leaks in; COLUMNS=200 forces
//    single-line usage so arg-error stderr does not re-wrap to terminal width.
//
// Coverage: record ok/fail (build to KILL_STREAK=5 → auto-kill), gate
// (closed / open / half_open via AGENT_CONFIG_DRIVE_COOLDOWN_SEC=0, plus
// AGENT_CONFIG_DRIVE_AUTO_RECOVERY=0 sticky-open), status (single-host text +
// --json + all-hosts + empty + invalid-host fail-open), kill, reset, the
// non-`health` --root SystemExit, usage/arg errors, no-args. The argparse
// `--help` BODY is asserted only on the `usage:` first line per the porting
// contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// This test lives at tests/scripts/cli/python/<file> → REPO_ROOT is 5 `..`
// hops from the file (first hop strips the filename, then 4 dir levels:
// python → cli → scripts → tests → repo root).
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    '..',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_drive_health.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → nothing machine-dependent leaks into the spawn.
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'drvh-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200', ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Replace the live-epoch float fields with a stable placeholder so the rest of
 * the sorted-JSON state can be snapshotted. Covers both the single-state and
 * all-hosts (nested) shapes — they appear identically in sorted JSON.
 */
function norm(text: string): string {
    return text
        .replace(/"killed_at": [0-9.eE+-]+/g, '"killed_at": <T>')
        .replace(/"probe_started_at": [0-9.eE+-]+/g, '"probe_started_at": <T>');
}

/** Normalize a RunResult's stdout/stderr for snapshotting. */
function normResult(r: RunResult): RunResult {
    return { status: r.status, stdout: norm(r.stdout), stderr: norm(r.stderr) };
}

// ---------------------------------------------------------------------------
// Fixtures — a fresh per-test health root.
// ---------------------------------------------------------------------------

let root: string;

beforeEach(() => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'drvh-'));
    root = path.join(base, 'workspace', 'health');
    fs.mkdirSync(root, { recursive: true });
});
afterEach(() => {
    // mkdtemp base is two levels up from the health dir.
    fs.rmSync(path.resolve(root, '..', '..'), { recursive: true, force: true });
});

/** Substitute the `<ROOT>` placeholder with the per-test health dir. */
function sub(args: string[]): string[] {
    return args.map((a) => (a === '<ROOT>' ? root : a));
}

/**
 * Replay each setup command (output discarded), then run + normalize the final
 * command. `<ROOT>` in any args is the per-test health dir.
 */
function seq(
    setup: string[][],
    finalArgs: string[],
    extraEnv: Record<string, string> = {},
): RunResult {
    for (const step of setup) {
        runTs(sub(step));
    }
    return normResult(runTs(sub(finalArgs), extraEnv));
}

const FIVE_FAILS = (host: string): string[][] =>
    Array.from({ length: 5 }, () => [
        'record',
        '--host',
        host,
        '--outcome',
        'fail',
        '--root',
        '<ROOT>',
    ]);

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe('workspace_drive_health — record', () => {
    it('record ok emits the default-healthy state', () => {
        expect(seq([], ['record', '--host', 'h1', '--outcome', 'ok', '--root', '<ROOT>']))
            .toMatchInlineSnapshot(`
              {
                "status": 0,
                "stderr": "",
                "stdout": "{"consecutive_failures": 0, "host": "h1", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": "ok", "last_was_probe": false, "probe_started_at": null, "total_failure": 0, "total_success": 1, "trip_count": 0}
              ",
              }
            `);
    });

    it('record fail with error-kind', () => {
        expect(
            seq(
                [],
                ['record', '--host', 'h1', '--outcome', 'fail', '--error-kind', 'boom', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 1, "host": "h1", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": "boom", "last_outcome": "fail", "last_was_probe": false, "probe_started_at": null, "total_failure": 1, "total_success": 0, "trip_count": 0}
          ",
          }
        `);
    });

    it('five consecutive failures auto-trip the kill-switch', () => {
        const fails = FIVE_FAILS('hk');
        // The 5th record is the asserted one (killed flips true).
        expect(seq(fails.slice(0, 4), fails[4] as string[])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 5, "host": "hk", "kill_reason": "auto", "killed": true, "killed_at": <T>, "last_error_kind": null, "last_outcome": "fail", "last_was_probe": false, "probe_started_at": null, "total_failure": 5, "total_success": 0, "trip_count": 1}
          ",
          }
        `);
    });

    it('success after failures resets the streak (auto-kill not yet tripped)', () => {
        expect(
            seq(
                [
                    ['record', '--host', 'hs', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
                    ['record', '--host', 'hs', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
                ],
                ['record', '--host', 'hs', '--outcome', 'ok', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 0, "host": "hs", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": "ok", "last_was_probe": false, "probe_started_at": null, "total_failure": 2, "total_success": 1, "trip_count": 0}
          ",
          }
        `);
    });

    it('--is-probe sets last_was_probe', () => {
        expect(
            seq([], ['record', '--host', 'hp', '--outcome', 'ok', '--is-probe', '--root', '<ROOT>']),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 0, "host": "hp", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": "ok", "last_was_probe": true, "probe_started_at": null, "total_failure": 0, "total_success": 1, "trip_count": 0}
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// gate
// ---------------------------------------------------------------------------

describe('workspace_drive_health — gate', () => {
    it('healthy host gates closed', () => {
        expect(seq([], ['gate', '--host', 'gx', '--root', '<ROOT>'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "closed
          ",
          }
        `);
    });

    it('auto-killed host gates open during cooldown', () => {
        expect(seq(FIVE_FAILS('gk'), ['gate', '--host', 'gk', '--root', '<ROOT>']))
            .toMatchInlineSnapshot(`
              {
                "status": 0,
                "stderr": "",
                "stdout": "open
              ",
              }
            `);
    });

    it('auto-killed host gates half_open once cooldown elapses (COOLDOWN_SEC=0)', () => {
        expect(
            seq(FIVE_FAILS('gh'), ['gate', '--host', 'gh', '--root', '<ROOT>'], {
                AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0',
            }),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "half_open
          ",
          }
        `);
    });

    it('auto-recovery disabled keeps an auto-killed host open (sticky)', () => {
        expect(
            seq(FIVE_FAILS('go'), ['gate', '--host', 'go', '--root', '<ROOT>'], {
                AGENT_CONFIG_DRIVE_AUTO_RECOVERY: '0',
                AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0',
            }),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "open
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

describe('workspace_drive_health — status', () => {
    it('single-host text format (default-healthy)', () => {
        expect(
            seq(
                [['record', '--host', 's1', '--outcome', 'ok', '--root', '<ROOT>']],
                ['status', '--host', 's1', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "s1: killed=False streak=0 ok=1 fail=0
          ",
          }
        `);
    });

    it('single-host --json', () => {
        expect(
            seq(
                [['record', '--host', 's1', '--outcome', 'fail', '--error-kind', 'e', '--root', '<ROOT>']],
                ['status', '--host', 's1', '--json', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 1, "host": "s1", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": "e", "last_outcome": "fail", "last_was_probe": false, "probe_started_at": null, "total_failure": 1, "total_success": 0, "trip_count": 0}
          ",
          }
        `);
    });

    it('all-hosts json (multiple recorded hosts, sorted)', () => {
        expect(
            seq(
                [
                    ['record', '--host', 'beta', '--outcome', 'ok', '--root', '<ROOT>'],
                    ['record', '--host', 'alpha', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
                ],
                ['status', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"alpha": {"consecutive_failures": 1, "host": "alpha", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": "x", "last_outcome": "fail", "last_was_probe": false, "probe_started_at": null, "total_failure": 1, "total_success": 0, "trip_count": 0}, "beta": {"consecutive_failures": 0, "host": "beta", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": "ok", "last_was_probe": false, "probe_started_at": null, "total_failure": 0, "total_success": 1, "trip_count": 0}}
          ",
          }
        `);
    });

    it('all-hosts json on empty health dir', () => {
        expect(seq([], ['status', '--root', '<ROOT>'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{}
          ",
          }
        `);
    });

    it('invalid host id reads fail-open (no write, no crash)', () => {
        expect(seq([], ['status', '--host', 'BAD!', '--json', '--root', '<ROOT>']))
            .toMatchInlineSnapshot(`
              {
                "status": 0,
                "stderr": "",
                "stdout": "{"consecutive_failures": 0, "host": "BAD!", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": null, "last_was_probe": false, "probe_started_at": null, "total_failure": 0, "total_success": 0, "trip_count": 0}
              ",
              }
            `);
    });
});

// ---------------------------------------------------------------------------
// kill / reset
// ---------------------------------------------------------------------------

describe('workspace_drive_health — kill / reset', () => {
    it('kill marks the host sticky-killed', () => {
        expect(seq([], ['kill', '--host', 'm', '--root', '<ROOT>'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 0, "host": "m", "kill_reason": "manual", "killed": true, "killed_at": <T>, "last_error_kind": null, "last_outcome": null, "last_was_probe": false, "probe_started_at": null, "total_failure": 0, "total_success": 0, "trip_count": 0}
          ",
          }
        `);
    });

    it('reset clears a killed host', () => {
        expect(
            seq(
                [['kill', '--host', 'm', '--root', '<ROOT>']],
                ['reset', '--host', 'm', '--root', '<ROOT>'],
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"consecutive_failures": 0, "host": "m", "kill_reason": null, "killed": false, "killed_at": null, "last_error_kind": null, "last_outcome": null, "last_was_probe": false, "probe_started_at": null, "total_failure": 0, "total_success": 0, "trip_count": 0}
          ",
          }
        `);
    });

    it('manual kill stays open even after cooldown (sticky, not auto-recoverable)', () => {
        expect(
            seq(
                [['kill', '--host', 'mk', '--root', '<ROOT>']],
                ['gate', '--host', 'mk', '--root', '<ROOT>'],
                { AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0' },
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "open
          ",
          }
        `);
    });
});

// ---------------------------------------------------------------------------
// argparse — usage / arg errors (no shared state).
// ---------------------------------------------------------------------------

describe('workspace_drive_health — CLI errors', () => {
    it('no args → required cmd', () => {
        expect(normResult(runTs([]))).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_drive_health [-h] {record,gate,status,kill,reset} ...
          workspace_drive_health: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });

    it('invalid subcommand', () => {
        expect(normResult(runTs(['bogus']))).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_drive_health [-h] {record,gate,status,kill,reset} ...
          workspace_drive_health: error: argument cmd: invalid choice: 'bogus' (choose from 'record', 'gate', 'status', 'kill', 'reset')
          ",
            "stdout": "",
          }
        `);
    });

    it('record with no args → required flags (declaration order)', () => {
        expect(normResult(runTs(['record']))).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_drive_health record [-h] --host HOST --outcome {ok,fail}
                                               [--error-kind ERROR_KIND] [--is-probe]
                                               --root ROOT
          workspace_drive_health record: error: the following arguments are required: --host, --outcome, --root
          ",
            "stdout": "",
          }
        `);
    });

    it('record missing --root only', () => {
        expect(normResult(runTs(['record', '--host', 'x', '--outcome', 'ok'])))
            .toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: workspace_drive_health record [-h] --host HOST --outcome {ok,fail}
                                                   [--error-kind ERROR_KIND] [--is-probe]
                                                   --root ROOT
              workspace_drive_health record: error: the following arguments are required: --root
              ",
                "stdout": "",
              }
            `);
    });

    it('record invalid --outcome choice', () => {
        expect(normResult(runTs(sub(['record', '--host', 'x', '--outcome', 'bad', '--root', '<ROOT>']))))
            .toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: workspace_drive_health record [-h] --host HOST --outcome {ok,fail}
                                                   [--error-kind ERROR_KIND] [--is-probe]
                                                   --root ROOT
              workspace_drive_health record: error: argument --outcome: invalid choice: 'bad' (choose from 'ok', 'fail')
              ",
                "stdout": "",
              }
            `);
    });

    it('status missing required --root', () => {
        expect(normResult(runTs(['status']))).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_drive_health status [-h] [--host HOST] [--json] --root ROOT
          workspace_drive_health status: error: the following arguments are required: --root
          ",
            "stdout": "",
          }
        `);
    });

    it('status unrecognized flag → top-level error', () => {
        expect(normResult(runTs(sub(['status', '--root', '<ROOT>', '--bogus']))))
            .toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: workspace_drive_health [-h] {record,gate,status,kill,reset} ...
              workspace_drive_health: error: unrecognized arguments: --bogus
              ",
                "stdout": "",
              }
            `);
    });

    it('record unrecognized positional → top-level error', () => {
        expect(
            normResult(
                runTs(sub(['record', '--host', 'x', '--outcome', 'ok', '--root', '<ROOT>', 'extra'])),
            ),
        ).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_drive_health [-h] {record,gate,status,kill,reset} ...
          workspace_drive_health: error: unrecognized arguments: extra
          ",
            "stdout": "",
          }
        `);
    });

    it('--root not named health → SystemExit, exit 1', () => {
        // Use a non-health dir name; the CLI prints to stderr + exits 1.
        const r = normResult(runTs(['status', '--root', '/tmp/nothealth-xyz']));
        expect(r.status).toBe(1);
        expect(r.stdout).toBe('');
        expect(r).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "--root must be a workspace/health directory; got '/tmp/nothealth-xyz'
          ",
            "stdout": "",
          }
        `);
    });

    it('top-level -h prints the usage line + exit 0 (body not compared)', () => {
        const r = runTs(['-h']);
        expect(r.status).toBe(0);
        // Only the first `usage:` line is contract-asserted.
        const firstLine = (s: string): string => s.split('\n')[0] ?? '';
        expect(firstLine(r.stdout)).toMatchInlineSnapshot(
            `"usage: workspace_drive_health [-h] {record,gate,status,kill,reset} ..."`,
        );
    });
});
