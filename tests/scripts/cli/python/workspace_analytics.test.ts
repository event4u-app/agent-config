// Golden-parity tests for src/cli/python/workspace_analytics.ts (py2ts ADR-200
// — local-only workspace analytics, local-analytics.md).
//
// Strategy: run `python3 workspace_analytics.py` vs `tsx workspace_analytics.ts`
// and byte-compare stdout / stderr / exit. The CLI has NO `--root`/`--path`
// flag — every subcommand reads/writes `$HOME/.event4u/.../analytics/
// events.jsonl` — so each language runs under a SEPARATE hermetic `HOME` and
// `norm()` masks the only nondeterministic surface (the per-record `ts` UTC
// second). The `show` report otherwise renders deterministically (top-prompts,
// round-half-to-even completion %, divmod session length, CSV `\r\n`, JSON
// `indent=2`). The opt-out gate is driven from a `.agent-settings.yml` in the
// run CWD.
//
// Encryption-at-rest defaults OFF (no `.agent-settings.yml → encrypt_at_rest`
// in the run CWD): migrate raises (exit 1 both sides), decrypt-all is a
// crypto-free `{decrypted: 0}` — both deterministic. The `--help` BODY is NOT
// byte-compared (only the `usage:` line); Python runs force COLUMNS=80.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_analytics.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_analytics.py');
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

let pyHome: string;
let tsHome: string;
let cwd: string;

function runPy(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: {
            ...process.env,
            HOME: pyHome,
            PYTHONPATH: path.join(REPO_ROOT, 'src'),
            ...COLS80,
            ...extraEnv,
        },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, HOME: tsHome, ...COLS80, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask the per-record `ts` UTC second (the only nondeterministic surface). */
function norm(text: string): string {
    return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '<TS>');
}

/** Byte-exact parity for deterministic surfaces (no HOME-dependent state). */
function expectParityExact(args: string[], extraEnv: Record<string, string> = {}): void {
    const p = runPy(args, extraEnv);
    const t = runTs(args, extraEnv);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

function usageOnly(text: string): string {
    const out: string[] = [];
    for (const line of text.split('\n')) {
        if (out.length > 0 && line.trim() === '') break;
        out.push(line);
    }
    return out.join('\n');
}

/** Emit the SAME event into both stores (each under its own HOME). */
function emitBoth(event: string, data: string[]): void {
    const args = ['emit', event, ...data.flatMap((d) => ['--data', d])];
    runPy(args);
    runTs(args);
}

beforeEach(() => {
    pyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-py-'));
    tsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-ts-'));
    // A neutral CWD with NO .agent-settings.yml → analytics on, encryption off.
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wsan-cwd-'));
});
afterEach(() => {
    fs.rmSync(pyHome, { recursive: true, force: true });
    fs.rmSync(tsHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
});

describe.skipIf(!py3)('workspace_analytics — emit', () => {
    it('emit a valid event → exit 0, no output', () => {
        const p = runPy(['emit', 'launcher.opened', '--data', 'role=sales']);
        const t = runTs(['emit', 'launcher.opened', '--data', 'role=sales']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    it('emit an unknown event → stderr + exit 1', () => {
        const p = runPy(['emit', 'bogus.event']);
        const t = runTs(['emit', 'bogus.event']);
        expect(t.status).toBe(p.status); // 1 / 1
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr); // names the rejected event
    });

    it('emit with a bad --data (no =) → SystemExit string + exit 1', () => {
        expectParityExact(['emit', 'launcher.opened', '--data', 'novalue']);
    });

    it('emit under env opt-out → exit 1 (no write)', () => {
        const env = { AGENT_CONFIG_NO_LOCAL_ANALYTICS: '1' };
        const p = runPy(['emit', 'launcher.opened'], env);
        const t = runTs(['emit', 'launcher.opened'], env);
        expect(t.status).toBe(p.status); // 1 / 1
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    it('emit under settings opt-out (analytics.local: off) → exit 1', () => {
        fs.writeFileSync(path.join(cwd, '.agent-settings.yml'), 'analytics:\n  local: off\n');
        const p = runPy(['emit', 'launcher.opened']);
        const t = runTs(['emit', 'launcher.opened']);
        expect(t.status).toBe(p.status); // 1 / 1
    });
});

describe.skipIf(!py3)('workspace_analytics — show', () => {
    it('markdown report (top prompts, completion %, session length)', () => {
        emitBoth('launcher.task_launched', ['role=sales', 'task=offer']);
        emitBoth('launcher.task_launched', ['role=sales', 'task=offer']);
        emitBoth('launcher.task_launched', ['role=support', 'task=reply']);
        emitBoth('session.completed', ['role=sales', 'duration_ms=90000']);
        emitBoth('knowledge.source_clicked', ['source=docA']);
        const p = runPy(['show', '--window', '30d']);
        const t = runTs(['show', '--window', '30d']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });

    it('markdown report on an empty store', () => {
        const p = runPy(['show']);
        const t = runTs(['show']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });

    it('round-half-to-even completion percentage (3 launched, 2 completed → 67%)', () => {
        for (let i = 0; i < 3; i += 1) emitBoth('launcher.task_launched', ['role=r', 'task=t']);
        for (let i = 0; i < 2; i += 1) emitBoth('session.completed', ['role=r']);
        const p = runPy(['show']);
        const t = runTs(['show']);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });

    it('csv format (\\r\\n rows, header)', () => {
        emitBoth('launcher.task_launched', ['role=sales', 'task=offer']);
        emitBoth('session.completed', ['role=sales', 'duration_ms=60000', 'host_tier=tier-1']);
        const p = runPy(['show', '--format', 'csv']);
        const t = runTs(['show', '--format', 'csv']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
        expect(t.stdout).toContain('\r\n'); // csv.writer line terminator
    });

    it('json format (indent=2, insertion-order keys)', () => {
        emitBoth('launcher.task_launched', ['role=sales', 'task=offer', 'duration_ms=5']);
        const p = runPy(['show', '--format', 'json']);
        const t = runTs(['show', '--format', 'json']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });

    it('--event filter', () => {
        emitBoth('launcher.task_launched', ['role=a', 'task=x']);
        emitBoth('session.completed', ['role=a']);
        const p = runPy(['show', '--format', 'json', '--event', 'session.completed']);
        const t = runTs(['show', '--format', 'json', '--event', 'session.completed']);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });

    it('--role filter', () => {
        emitBoth('launcher.task_launched', ['role=a', 'task=x']);
        emitBoth('launcher.task_launched', ['role=b', 'task=y']);
        const p = runPy(['show', '--format', 'csv', '--role', 'a']);
        const t = runTs(['show', '--format', 'csv', '--role', 'a']);
        expect(norm(t.stdout)).toBe(norm(p.stdout));
    });
});

describe.skipIf(!py3)('workspace_analytics — prune + encryption defaults', () => {
    it('prune an empty store → "pruned 0 event(s)"', () => {
        const p = runPy(['prune']);
        const t = runTs(['prune']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
    });

    it('prune keeps recent events → "pruned 0 event(s)"', () => {
        emitBoth('launcher.opened', ['role=r']);
        const p = runPy(['prune']);
        const t = runTs(['prune']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // 0 dropped (just emitted)
    });

    it('migrate with encryption off → exit 1 (RuntimeError both sides)', () => {
        emitBoth('launcher.opened', ['role=r']);
        const p = runPy(['migrate']);
        const t = runTs(['migrate']);
        expect(t.status).toBe(p.status); // 1 / 1
    });

    it('decrypt-all on plaintext → {"decrypted": N} (crypto-free, same count)', () => {
        emitBoth('launcher.opened', ['role=r']);
        emitBoth('session.completed', ['role=r']);
        const p = runPy(['decrypt-all']);
        const t = runTs(['decrypt-all']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // {"decrypted": 2}
    });
});

describe.skipIf(!py3)('workspace_analytics — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParityExact([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParityExact(['bogus']);
    });
    it('show bad --window → invalid choice, exit 2', () => {
        expectParityExact(['show', '--window', '99d']);
    });
    it('show bad --format → invalid choice, exit 2', () => {
        expectParityExact(['show', '--format', 'xml']);
    });
    it('emit missing event → required, exit 2', () => {
        expectParityExact(['emit']);
    });
    it.each([['emit'], ['show'], ['prune'], ['migrate'], ['decrypt-all'], ['rekey']])(
        '%s -h usage line byte-matches',
        (sub) => {
            const p = runPy([sub, '-h']);
            const t = runTs([sub, '-h']);
            expect(t.status).toBe(p.status); // 0 / 0
            expect(usageOnly(t.stdout)).toBe(usageOnly(p.stdout));
        },
    );
});
