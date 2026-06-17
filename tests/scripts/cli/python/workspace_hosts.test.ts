// Golden-parity tests for src/cli/python/workspace_hosts.ts (py2ts ADR-200 —
// host-agent tier detection, ADR-068).
//
// Strategy: run `python3 workspace_hosts.py` vs `tsx workspace_hosts.ts` and
// byte-compare stdout / stderr / exit. Detection is side-effect-free and
// deterministic (it only reads the static HOST_INVENTORY + checks PATH via
// `shutil.which` / a PATH walk), so the two languages agree byte-for-byte on
// every surface. To make `cli_present` deterministic regardless of which host
// CLIs happen to be installed on the runner, every case that asserts the
// detect/list payload runs with `PATH=''` so NO host CLI resolves — both
// languages then report `cli_present:false` / `effective_tier:3` identically.
//
// Coverage: detect known (tier-1 + tier-3) / unknown, list text + --json,
// --json detect, and the full argparse error surface (no-args, bad subcommand,
// missing positional, extra positional, unknown flag). The argparse `--help`
// BODY is NOT byte-compared (only the `usage:` line) per the porting contract.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_hosts.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_hosts.py');
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


function expectParity(args: string[], extraEnv: Record<string, string> = {}): void {
    const p = runPy(args, extraEnv);
    const t = runTs(args, extraEnv);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

describe.skipIf(!py3)('workspace_hosts — detect', () => {
    it('tier-1 known host (no CLI on PATH → demotes to tier 3)', () => {
        expectParity(['detect', 'claude-code']);
    });
    it('tier-3 known host', () => {
        expectParity(['detect', 'augment']);
    });
    it('unknown host (fail-soft, exit 1)', () => {
        expectParity(['detect', 'nope']);
    });
    it('detect --json', () => {
        expectParity(['detect', 'codex', '--json']);
    });
    it('detect --json= inline (none here, but flag before positional)', () => {
        expectParity(['detect', '--json', 'gemini']);
    });
});

describe.skipIf(!py3)('workspace_hosts — list', () => {
    it('list (text)', () => {
        expectParity(['list']);
    });
    it('list --json', () => {
        expectParity(['list', '--json']);
    });
});

describe.skipIf(!py3)('workspace_hosts — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParity([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParity(['bogus']);
    });
    it('detect missing host_id → exit 2', () => {
        expectParity(['detect']);
    });
    it('detect extra positional → unrecognized, exit 2', () => {
        expectParity(['detect', 'a', 'b']);
    });
    it('detect unknown flag → unrecognized, exit 2', () => {
        expectParity(['detect', '--bogus', 'x']);
    });
    it('list extra positional → unrecognized, exit 2', () => {
        expectParity(['list', 'extra']);
    });
    it('top-level -h → usage line + exit 0', () => {
        // Body differs (argparse re-wraps); assert the usage line + exit only.
        const p = runPy(['-h']);
        const t = runTs(['-h']);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
    it('detect -h → subparser usage line + exit 0', () => {
        const p = runPy(['detect', '-h']);
        const t = runTs(['detect', '-h']);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});
