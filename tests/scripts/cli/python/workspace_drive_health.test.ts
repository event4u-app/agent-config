// Golden-parity tests for src/cli/python/workspace_drive_health.ts (py2ts
// ADR-200 — the drive-health + kill-switch CLI, ADR-073).
//
// Strategy: run `python3 src/cli/python/workspace_drive_health.py` vs
// `tsx src/cli/python/workspace_drive_health.ts` and byte-compare stdout /
// stderr / exit. The CLI keeps a tiny per-host JSON cache under
// `<root>/<host>.json`, so the two languages MUST NOT share a state dir — they
// would race on the same files. Each parity case therefore replays the SAME
// command sequence in a SEPARATE per-language temp root, then byte-compares the
// final outputs.
//
// `_validate_cli_root` rejects any `--root` whose basename is not `health`, so
// every root is a `<tmp>/workspace/health` directory.
//
// Nondeterminism: `killed_at` / `probe_started_at` carry epoch floats from
// `time.time()` (py) vs `Date.now()/1000` (ts) — they WILL differ run-to-run
// and language-to-language. The `norm()` helper replaces their numeric values
// with a `<T>` placeholder in the sorted-JSON output before comparing, so the
// rest of the state stays a true byte-for-byte assertion.
//
// Coverage: record ok/fail (build to KILL_STREAK=5 → auto-kill), gate
// (closed / open / half_open via AGENT_CONFIG_DRIVE_COOLDOWN_SEC=0, plus
// AGENT_CONFIG_DRIVE_AUTO_RECOVERY=0 sticky-open), status (single-host text +
// --json + all-hosts), kill, reset, invalid host id (status fail-open),
// usage/arg errors, no-args. The argparse `--help` BODY is NOT byte-compared
// (only the `usage:` line) per the porting contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_drive_health.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Replace the live-epoch float fields with a stable placeholder so the rest of
 * the sorted-JSON state byte-compares. Covers both the single-state and
 * all-hosts (nested) shapes — they appear identically in sorted JSON.
 */
function norm(text: string): string {
    return text
        .replace(/"killed_at": [0-9.eE+-]+/g, '"killed_at": <T>')
        .replace(/"probe_started_at": [0-9.eE+-]+/g, '"probe_started_at": <T>');
}

// ---------------------------------------------------------------------------
// Fixtures — separate health roots per language.
// ---------------------------------------------------------------------------

let pyRoot: string;
let tsRoot: string;

function makeHealthRoot(prefix: string): string {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const root = path.join(base, 'workspace', 'health');
    fs.mkdirSync(root, { recursive: true });
    return root;
}

beforeEach(() => {
    pyRoot = makeHealthRoot('drvh-py-');
    tsRoot = makeHealthRoot('drvh-ts-');
});
afterEach(() => {
    // mkdtemp base is two levels up from the health dir.
    for (const root of [pyRoot, tsRoot]) {
        fs.rmSync(path.resolve(root, '..', '..'), { recursive: true, force: true });
    }
});

/**
 * Replay one command sequence in each language's own root, then assert the
 * FINAL command's stdout/stderr/exit agree (after timestamp normalization).
 * Each step is `[args, extraEnv]`; the last step is the asserted one.
 */
function expectSeqParity(
    setup: string[][],
    finalArgs: string[],
    extraEnv: Record<string, string> = {},
): void {
    const subst = (args: string[], root: string): string[] =>
        args.map((a) => (a === '<ROOT>' ? root : a));
    for (const step of setup) {
        runPy(subst(step, pyRoot));
        runTs(subst(step, tsRoot));
    }
    const p = runPy(subst(finalArgs, pyRoot), extraEnv);
    const t = runTs(subst(finalArgs, tsRoot), extraEnv);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout)).toBe(norm(p.stdout));
    expect(norm(t.stderr)).toBe(norm(p.stderr));
}

/** Parity for a single invocation that needs no shared state (errors etc.). */
function expectArgParity(args: string[], extraEnv: Record<string, string> = {}): void {
    const pyArgs = args.map((a) => (a === '<ROOT>' ? pyRoot : a));
    const tsArgs = args.map((a) => (a === '<ROOT>' ? tsRoot : a));
    const p = runPy(pyArgs, extraEnv);
    const t = runTs(tsArgs, extraEnv);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout)).toBe(norm(p.stdout));
    expect(norm(t.stderr)).toBe(norm(p.stderr));
}

const d = py3 ? describe : describe.skip;

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

d('workspace_drive_health — record', () => {
    it('record ok emits the default-healthy state', () => {
        expectSeqParity([], ['record', '--host', 'h1', '--outcome', 'ok', '--root', '<ROOT>']);
    });

    it('record fail with error-kind', () => {
        expectSeqParity(
            [],
            ['record', '--host', 'h1', '--outcome', 'fail', '--error-kind', 'boom', '--root', '<ROOT>'],
        );
    });

    it('five consecutive failures auto-trip the kill-switch', () => {
        const fails: string[][] = Array.from({ length: 5 }, () => [
            'record',
            '--host',
            'hk',
            '--outcome',
            'fail',
            '--error-kind',
            'boom',
            '--root',
            '<ROOT>',
        ]);
        // The 5th record is the asserted one (killed flips true).
        expectSeqParity(fails.slice(0, 4), fails[4] as string[]);
    });

    it('success after failures resets the streak (auto-kill not yet tripped)', () => {
        expectSeqParity(
            [
                ['record', '--host', 'hs', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
                ['record', '--host', 'hs', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
            ],
            ['record', '--host', 'hs', '--outcome', 'ok', '--root', '<ROOT>'],
        );
    });

    it('--is-probe sets last_was_probe', () => {
        expectSeqParity(
            [],
            ['record', '--host', 'hp', '--outcome', 'ok', '--is-probe', '--root', '<ROOT>'],
        );
    });
});

// ---------------------------------------------------------------------------
// gate
// ---------------------------------------------------------------------------

d('workspace_drive_health — gate', () => {
    it('healthy host gates closed', () => {
        expectSeqParity([], ['gate', '--host', 'gx', '--root', '<ROOT>']);
    });

    it('auto-killed host gates open during cooldown', () => {
        const fails: string[][] = Array.from({ length: 5 }, () => [
            'record',
            '--host',
            'gk',
            '--outcome',
            'fail',
            '--root',
            '<ROOT>',
        ]);
        expectSeqParity(fails, ['gate', '--host', 'gk', '--root', '<ROOT>']);
    });

    it('auto-killed host gates half_open once cooldown elapses (COOLDOWN_SEC=0)', () => {
        const fails: string[][] = Array.from({ length: 5 }, () => [
            'record',
            '--host',
            'gh',
            '--outcome',
            'fail',
            '--root',
            '<ROOT>',
        ]);
        expectSeqParity(fails, ['gate', '--host', 'gh', '--root', '<ROOT>'], {
            AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0',
        });
    });

    it('auto-recovery disabled keeps an auto-killed host open (sticky)', () => {
        const fails: string[][] = Array.from({ length: 5 }, () => [
            'record',
            '--host',
            'go',
            '--outcome',
            'fail',
            '--root',
            '<ROOT>',
        ]);
        expectSeqParity(fails, ['gate', '--host', 'go', '--root', '<ROOT>'], {
            AGENT_CONFIG_DRIVE_AUTO_RECOVERY: '0',
            AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0',
        });
    });
});

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

d('workspace_drive_health — status', () => {
    it('single-host text format (default-healthy)', () => {
        expectSeqParity(
            [['record', '--host', 's1', '--outcome', 'ok', '--root', '<ROOT>']],
            ['status', '--host', 's1', '--root', '<ROOT>'],
        );
    });

    it('single-host --json', () => {
        expectSeqParity(
            [['record', '--host', 's1', '--outcome', 'fail', '--error-kind', 'e', '--root', '<ROOT>']],
            ['status', '--host', 's1', '--json', '--root', '<ROOT>'],
        );
    });

    it('all-hosts json (multiple recorded hosts, sorted)', () => {
        expectSeqParity(
            [
                ['record', '--host', 'beta', '--outcome', 'ok', '--root', '<ROOT>'],
                ['record', '--host', 'alpha', '--outcome', 'fail', '--error-kind', 'x', '--root', '<ROOT>'],
            ],
            ['status', '--root', '<ROOT>'],
        );
    });

    it('all-hosts json on empty health dir', () => {
        expectSeqParity([], ['status', '--root', '<ROOT>']);
    });

    it('invalid host id reads fail-open (no write, no crash)', () => {
        expectSeqParity([], ['status', '--host', 'BAD!', '--json', '--root', '<ROOT>']);
    });
});

// ---------------------------------------------------------------------------
// kill / reset
// ---------------------------------------------------------------------------

d('workspace_drive_health — kill / reset', () => {
    it('kill marks the host sticky-killed', () => {
        expectSeqParity([], ['kill', '--host', 'm', '--root', '<ROOT>']);
    });

    it('reset clears a killed host', () => {
        expectSeqParity(
            [['kill', '--host', 'm', '--root', '<ROOT>']],
            ['reset', '--host', 'm', '--root', '<ROOT>'],
        );
    });

    it('manual kill stays open even after cooldown (sticky, not auto-recoverable)', () => {
        expectSeqParity(
            [['kill', '--host', 'mk', '--root', '<ROOT>']],
            ['gate', '--host', 'mk', '--root', '<ROOT>'],
            { AGENT_CONFIG_DRIVE_COOLDOWN_SEC: '0' },
        );
    });
});

// ---------------------------------------------------------------------------
// argparse — usage / arg errors (no shared state).
// ---------------------------------------------------------------------------

d('workspace_drive_health — CLI errors', () => {
    it('no args → required cmd', () => {
        expectArgParity([]);
    });

    it('invalid subcommand', () => {
        expectArgParity(['bogus']);
    });

    it('record with no args → required flags (declaration order)', () => {
        expectArgParity(['record']);
    });

    it('record missing --root only', () => {
        expectArgParity(['record', '--host', 'x', '--outcome', 'ok']);
    });

    it('record invalid --outcome choice', () => {
        expectArgParity(['record', '--host', 'x', '--outcome', 'bad', '--root', '<ROOT>']);
    });

    it('status missing required --root', () => {
        expectArgParity(['status']);
    });

    it('status unrecognized flag → top-level error', () => {
        expectArgParity(['status', '--root', '<ROOT>', '--bogus']);
    });

    it('record unrecognized positional → top-level error', () => {
        expectArgParity([
            'record',
            '--host',
            'x',
            '--outcome',
            'ok',
            '--root',
            '<ROOT>',
            'extra',
        ]);
    });

    it('--root not named health → SystemExit, exit 1', () => {
        // Use a non-health dir name; both languages print to stderr + exit 1.
        const py = runPy(['status', '--root', '/tmp/nothealth-xyz']);
        const ts = runTs(['status', '--root', '/tmp/nothealth-xyz']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(py.status).toBe(1);
    });

    it('top-level -h prints the usage line + exit 0 (body not compared)', () => {
        const py = runPy(['-h']);
        const ts = runTs(['-h']);
        expect(ts.status).toBe(py.status);
        expect(py.status).toBe(0);
        // Only the first `usage:` line is contract-compared.
        const firstLine = (s: string): string => s.split('\n')[0] ?? '';
        expect(firstLine(ts.stdout)).toBe(firstLine(py.stdout));
    });
});
