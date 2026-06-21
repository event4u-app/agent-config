// Golden-parity tests for src/cli/python/workspace_sessions.ts (py2ts ADR-200 —
// local workspace session store, daily-workspace.md §Session JSONL schema).
//
// Strategy: run `python3 workspace_sessions.py` vs `tsx workspace_sessions.ts`
// and byte-compare stdout / stderr / exit. Session ids are
// `<UTC-stamp>-<8 random hex>` and records carry a `ts` (UTC second) — both
// NONDETERMINISTIC and differing py-vs-ts. So functional cases run each
// language in a SEPARATE hermetic `<tmp>/workspace/sessions` root, replay the
// SAME command, then `norm()` masks the random id, the timestamp, the float
// mtime, and the tmp root before comparing — leaving the structural payload
// (kinds, data shape, scrubbed body, ordering, PyFloat round-trip) a true
// byte-for-byte assertion.
//
// `_validate_cli_root` requires `--root` to be a `.../workspace/sessions` dir.
// The `--help` BODY is NOT byte-compared (only the `usage:` line) per the
// porting contract; the Python runs force COLUMNS=80 so the multi-line usage
// strings byte-match the TS hardcoded form. Encryption-at-rest paths default
// OFF (no `.agent-settings.yml` in the run CWD), so migrate raises (exit 1 both
// sides) and decrypt-all is a crypto-free `{decrypted: 0}` — both deterministic.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_sessions.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_sessions.py');
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

const COLS80 = { COLUMNS: '80' };

function runPy(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...COLS80, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...COLS80, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask nondeterministic ids / timestamps / float mtime / tmp roots. */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* removed */
        }
        out = out.split(real).join('<TMP>');
    }
    out = out.replace(/\d{8}T\d{6}Z-[0-9a-f]{8}/g, '<ID>'); // session id token
    out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '<TS>'); // ISO second
    out = out.replace(/"mtime": [0-9.]+/g, '"mtime": <M>'); // float mtime
    return out;
}

/** Byte-exact parity (deterministic surfaces: usage / arg errors). */
function expectParityExact(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

/** Compare only the `usage:` portion of a `-h` run (help body not compared). */
function usageOnly(text: string): string {
    const out: string[] = [];
    for (const line of text.split('\n')) {
        if (out.length > 0 && line.trim() === '') break;
        out.push(line);
    }
    return out.join('\n');
}

let pyRoot: string;
let tsRoot: string;
let pyTmp: string;
let tsTmp: string;
beforeEach(() => {
    pyTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wssess-py-'));
    tsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wssess-ts-'));
    pyRoot = path.join(pyTmp, 'workspace', 'sessions');
    tsRoot = path.join(tsTmp, 'workspace', 'sessions');
    fs.mkdirSync(pyRoot, { recursive: true });
    fs.mkdirSync(tsRoot, { recursive: true });
});
afterEach(() => {
    fs.rmSync(pyTmp, { recursive: true, force: true });
    fs.rmSync(tsTmp, { recursive: true, force: true });
});

describe.skipIf(!py3)('workspace_sessions — start + append + read + list', () => {
    it('start writes the launcher.input line; read it back (normalized)', () => {
        const pid = runPy(['start', '--role', 'sales', '--task', 'draft offer', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'sales', '--task', 'draft offer', '--root', tsRoot]).stdout.trim();
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('start --host writes host_tier + host_id', () => {
        const pid = runPy(['start', '--role', 'r', '--task', 't', '--host', 'claude-code', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--host', 'claude-code', '--root', tsRoot]).stdout.trim();
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('start scrubs a pasted secret in the task', () => {
        const sec = 'AKIAIOSFODNN7EXAMPLE';
        const pid = runPy(['start', '--role', 'r', '--task', `do ${sec} now`, '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', `do ${sec} now`, '--root', tsRoot]).stdout.trim();
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(p.stdout).not.toContain(sec);
        expect(t.stdout).not.toContain(sec);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('append --data k=v (flat strings)', () => {
        const pid = runPy(['start', '--role', 'r', '--task', 't', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runPy(['append', pid, '--kind', 'host.turn', '--data', 'k=v', '--data', 'n=3', '--root', pyRoot]);
        runTs(['append', tid, '--kind', 'host.turn', '--data', 'k=v', '--data', 'n=3', '--root', tsRoot]);
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('append --data-json preserves nested structure + PyFloat (2.0 stays 2.0)', () => {
        const dj = '{"n":3,"f":1.5,"nested":{"k":"v","arr":[1,2.0,"x"]},"b":true,"z":null,"big":2.0e3,"neg":-4.0}';
        const pid = runPy(['start', '--role', 'r', '--task', 't', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runPy(['append', pid, '--kind', 'host.output', '--data-json', dj, '--root', pyRoot]);
        runTs(['append', tid, '--kind', 'host.output', '--data-json', dj, '--root', tsRoot]);
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
        expect(t.stdout).toContain('2.0'); // float preserved, not collapsed to 2
    });

    it('append --data-json scrubs a secret in a string leaf', () => {
        const dj = '{"k":"AKIAIOSFODNN7EXAMPLE here","v":2.0}';
        const pid = runPy(['start', '--role', 'r', '--task', 't', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        runPy(['append', pid, '--kind', 'host.output', '--data-json', dj, '--root', pyRoot]);
        runTs(['append', tid, '--kind', 'host.output', '--data-json', dj, '--root', tsRoot]);
        const p = runPy(['read', pid, '--json', '--root', pyRoot]);
        const t = runTs(['read', tid, '--json', '--root', tsRoot]);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('append rejects an unknown kind → stderr + exit 1', () => {
        const pid = runPy(['start', '--role', 'r', '--task', 't', '--root', pyRoot]).stdout.trim();
        const tid = runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]).stdout.trim();
        const p = runPy(['append', pid, '--kind', 'bogus.kind', '--root', pyRoot]);
        const t = runTs(['append', tid, '--kind', 'bogus.kind', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        // stderr names the kind (deterministic).
        expect(t.stderr).toBe(p.stderr);
    });

    it('append to a missing session → stderr + exit 1', () => {
        const p = runPy(['append', '20200101T000000Z-deadbeef', '--kind', 'host.turn', '--root', pyRoot]);
        const t = runTs(['append', '20200101T000000Z-deadbeef', '--kind', 'host.turn', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        // stderr names the (same) session id — directly comparable.
        expect(t.stderr).toBe(p.stderr);
    });

    it('read missing session → empty (exit 0)', () => {
        const p = runPy(['read', '20200101T000000Z-deadbeef', '--json', '--root', pyRoot]);
        const t = runTs(['read', '20200101T000000Z-deadbeef', '--json', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // both "[]"
    });

    it('list --json (single entry, normalized)', () => {
        runPy(['start', '--role', 'sales', '--task', 'one', '--root', pyRoot]);
        runTs(['start', '--role', 'sales', '--task', 'one', '--root', tsRoot]);
        const p = runPy(['list', '--json', '--root', pyRoot]);
        const t = runTs(['list', '--json', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [tsRoot, tsTmp])).toBe(norm(p.stdout, [pyRoot, pyTmp]));
    });

    it('list text (per-line JSON, empty root)', () => {
        const p = runPy(['list', '--root', pyRoot]);
        const t = runTs(['list', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // both empty
    });
});

describe.skipIf(!py3)('workspace_sessions — encryption-at-rest defaults (flag off)', () => {
    it('migrate with flag off → exit 1 (RuntimeError both sides)', () => {
        const p = runPy(['migrate', '--root', pyRoot]);
        const t = runTs(['migrate', '--root', tsRoot]);
        expect(t.status).toBe(p.status); // 1 / 1
    });
    it('decrypt-all on plaintext → {"decrypted": 0} (crypto-free)', () => {
        runPy(['start', '--role', 'r', '--task', 't', '--root', pyRoot]);
        runTs(['start', '--role', 'r', '--task', 't', '--root', tsRoot]);
        const p = runPy(['decrypt-all', '--root', pyRoot]);
        const t = runTs(['decrypt-all', '--root', tsRoot]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // {"decrypted": 0}
    });
});

describe.skipIf(!py3)('workspace_sessions — argparse + root validation errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParityExact([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParityExact(['bogus']);
    });
    it('start missing required → exit 2', () => {
        expectParityExact(['start']);
    });
    it('append missing session_id → exit 2', () => {
        expectParityExact(['append', '--kind', 'host.turn']);
    });
    it('append missing --kind → exit 2', () => {
        expectParityExact(['append', 'sid']);
    });
    it('read missing session_id → exit 2', () => {
        expectParityExact(['read']);
    });
    it('list bad --limit int → exit 2', () => {
        expectParityExact(['list', '--limit', 'abc']);
    });
    it('--root not a workspace/sessions dir → SystemExit, exit 1', () => {
        expectParityExact(['list', '--root', '/tmp/not-a-sessions-dir']);
    });
    it.each([['start'], ['append'], ['list'], ['read'], ['migrate'], ['decrypt-all'], ['rekey']])(
        '%s -h usage line byte-matches',
        (sub) => {
            const p = runPy([sub, '-h']);
            const t = runTs([sub, '-h']);
            expect(t.status).toBe(p.status); // 0 / 0
            expect(usageOnly(t.stdout)).toBe(usageOnly(p.stdout));
        },
    );
});
