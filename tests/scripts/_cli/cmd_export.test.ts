// Golden-parity tests for src/scripts/_cli/cmd_export.ts (py2ts ADR-200 — the
// tool-content ejector).
//
// Strategy: run `python3 src/scripts/_cli/cmd_export.py` vs
// `tsx src/scripts/_cli/cmd_export.ts` and byte-compare stdout / stderr / exit,
// plus the resulting written file. The command writes ONLY to a user-chosen
// --output path inside a temp dir (no canonical-path defaults), so a throwaway
// output dir fully contains every mutation; the real repo / network / browser
// are never touched. Both sides run with cwd = the temp dir so the `_rel`
// (relative-to-cwd) display matches.
//
// Coverage map:
//   - usage / arg-error exit codes (unknown flag, --help banner first line).
//   - --list (catalog; sorted by tool id, padded columns).
//   - missing --tool / missing --output → exit 2 stderr.
//   - unknown tool → exit 2 stderr.
//   - export a constant-marker tool (roocode) → file written + ✅ line; then
//     idempotent re-export (content matches → ℹ️ line); then content-differs
//     without --force (exit 1) and with --force (overwrite, exit 0).
//   - export a template-backed tool (agents-md) → file content byte-identical.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_export.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_export.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();
const itPy = py3 ? it : it.skip;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acexp-'));
    roots.push(r);
    return r;
}

afterEach(() => {
    while (roots.length) {
        const r = roots.pop()!;
        try {
            fs.rmSync(r, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

/** Build two identical cwd dirs; return [pyCwd, tsCwd]. */
function freshPair(): [string, string] {
    return [freshRoot(), freshRoot()];
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_export — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const p = runPy(['--bogus'], root);
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('--help → exit 0 + usage banner first line (body prose exempt)', () => {
        const root = freshRoot();
        const p = runPy(['--help'], root);
        const t = runTs(['--help'], root);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// --list catalog
// ---------------------------------------------------------------------------

describe('cmd_export — --list', () => {
    itPy('catalog → identical sorted, padded columns', () => {
        const root = freshRoot();
        const p = runPy(['--list'], root);
        const t = runTs(['--list'], root);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });
});

// ---------------------------------------------------------------------------
// required-arg / unknown-tool errors
// ---------------------------------------------------------------------------

describe('cmd_export — required args + unknown tool', () => {
    itPy('missing --tool → exit 2 stderr', () => {
        const root = freshRoot();
        const p = runPy(['--output', path.join(root, 'out.md')], root);
        const t = runTs(['--output', path.join(root, 'out.md')], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('missing --output → exit 2 stderr', () => {
        const root = freshRoot();
        const p = runPy(['--tool', 'roocode'], root);
        const t = runTs(['--tool', 'roocode'], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('unknown tool → exit 2 stderr', () => {
        const root = freshRoot();
        const p = runPy(['--tool', 'nope', '--output', path.join(root, 'out.md')], root);
        const t = runTs(['--tool', 'nope', '--output', path.join(root, 'out.md')], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });
});

// ---------------------------------------------------------------------------
// export a constant-marker tool — write / idempotent / drift / --force
// ---------------------------------------------------------------------------

describe('cmd_export — constant marker (roocode)', () => {
    itPy('first export → ✅ line + byte-identical file across roots', () => {
        const [py, ts] = freshPair();
        // Use a relative --output so the `_rel` display is identical across roots.
        const p = runPy(['--tool', 'roocode', '--output', 'out/agent.md'], py);
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(fs.readFileSync(path.join(ts, 'out', 'agent.md'), 'utf8')).toBe(
            fs.readFileSync(path.join(py, 'out', 'agent.md'), 'utf8'),
        );
    });

    itPy('re-export with matching content → ℹ️ already-exported line', () => {
        const [py, ts] = freshPair();
        runPy(['--tool', 'roocode', '--output', 'out/agent.md'], py);
        runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        const p = runPy(['--tool', 'roocode', '--output', 'out/agent.md'], py);
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('content differs, no --force → exit 1 stderr', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.mkdirSync(path.join(root, 'out'), { recursive: true });
            fs.writeFileSync(path.join(root, 'out', 'agent.md'), 'DIFFERENT CONTENT\n');
        }
        const p = runPy(['--tool', 'roocode', '--output', 'out/agent.md'], py);
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        // The stderr names the absolute output path — normalise both roots.
        expect(t.stderr.split(ts).join('<R>')).toBe(p.stderr.split(py).join('<R>'));
    });

    itPy('content differs, --force → overwrite exit 0 + identical files', () => {
        const [py, ts] = freshPair();
        for (const root of [py, ts]) {
            fs.mkdirSync(path.join(root, 'out'), { recursive: true });
            fs.writeFileSync(path.join(root, 'out', 'agent.md'), 'DIFFERENT CONTENT\n');
        }
        const p = runPy(['--tool', 'roocode', '--output', 'out/agent.md', '--force'], py);
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md', '--force'], ts);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
        expect(fs.readFileSync(path.join(ts, 'out', 'agent.md'), 'utf8')).toBe(
            fs.readFileSync(path.join(py, 'out', 'agent.md'), 'utf8'),
        );
    });
});

// ---------------------------------------------------------------------------
// export a template-backed tool
// ---------------------------------------------------------------------------

describe('cmd_export — template-backed (agents-md)', () => {
    itPy('export AGENTS.md template → identical bytes', () => {
        const [py, ts] = freshPair();
        const p = runPy(['--tool', 'agents-md', '--output', 'AGENTS.md'], py);
        const t = runTs(['--tool', 'agents-md', '--output', 'AGENTS.md'], ts);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        if (t.status === 0) {
            expect(fs.readFileSync(path.join(ts, 'AGENTS.md'), 'utf8')).toBe(
                fs.readFileSync(path.join(py, 'AGENTS.md'), 'utf8'),
            );
        }
    });
});
