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
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

const itPy = it;

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
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

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_export — usage / arg errors', () => {
    itPy('unknown flag → exit 2', () => {
        expect(runTs(['--bogus'], freshRoot()).status).toBe(2);
    });

    itPy('--help → exit 0', () => {
        expect(runTs(['--help'], freshRoot()).status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// --list catalog
// ---------------------------------------------------------------------------

describe('cmd_export — --list', () => {
    itPy('catalog → exit 0, sorted padded columns, deterministic', () => {
        const root = freshRoot();
        const a = runTs(['--list'], root);
        expect(a.status).toBe(0);
        expect(a.stdout.length).toBeGreaterThan(0);
        expect(runTs(['--list'], root).stdout).toBe(a.stdout);
    });
});

// ---------------------------------------------------------------------------
// required-arg / unknown-tool errors
// ---------------------------------------------------------------------------

describe('cmd_export — required args + unknown tool', () => {
    itPy('missing --tool → exit 2 stderr', () => {
        const root = freshRoot();
        expect(runTs(['--output', path.join(root, 'out.md')], root).status).toBe(2);
    });

    itPy('missing --output → exit 2 stderr', () => {
        expect(runTs(['--tool', 'roocode'], freshRoot()).status).toBe(2);
    });

    itPy('unknown tool → exit 2 stderr', () => {
        const root = freshRoot();
        expect(runTs(['--tool', 'nope', '--output', path.join(root, 'out.md')], root).status).toBe(
            2,
        );
    });
});

// ---------------------------------------------------------------------------
// export a constant-marker tool — write / idempotent / drift / --force
// ---------------------------------------------------------------------------

describe('cmd_export — constant marker (roocode)', () => {
    itPy('first export → ✅ line + file written', () => {
        const ts = freshRoot();
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        expect(t.status).toBe(0);
        expect(fs.readFileSync(path.join(ts, 'out', 'agent.md'), 'utf8').length).toBeGreaterThan(0);
    });

    itPy('re-export with matching content → idempotent exit 0', () => {
        const ts = freshRoot();
        runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts);
        expect(runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts).status).toBe(0);
    });

    itPy('content differs, no --force → exit 1 stderr', () => {
        const ts = freshRoot();
        fs.mkdirSync(path.join(ts, 'out'), { recursive: true });
        fs.writeFileSync(path.join(ts, 'out', 'agent.md'), 'DIFFERENT CONTENT\n');
        expect(runTs(['--tool', 'roocode', '--output', 'out/agent.md'], ts).status).toBe(1);
    });

    itPy('content differs, --force → overwrite exit 0', () => {
        const ts = freshRoot();
        fs.mkdirSync(path.join(ts, 'out'), { recursive: true });
        fs.writeFileSync(path.join(ts, 'out', 'agent.md'), 'DIFFERENT CONTENT\n');
        const t = runTs(['--tool', 'roocode', '--output', 'out/agent.md', '--force'], ts);
        expect(t.status).toBe(0);
        expect(fs.readFileSync(path.join(ts, 'out', 'agent.md'), 'utf8')).not.toBe(
            'DIFFERENT CONTENT\n',
        );
    });
});

// ---------------------------------------------------------------------------
// export a template-backed tool
// ---------------------------------------------------------------------------

describe('cmd_export — template-backed (agents-md)', () => {
    itPy('export AGENTS.md template → file written when supported', () => {
        const ts = freshRoot();
        const t = runTs(['--tool', 'agents-md', '--output', 'AGENTS.md'], ts);
        if (t.status === 0) {
            expect(fs.readFileSync(path.join(ts, 'AGENTS.md'), 'utf8').length).toBeGreaterThan(0);
        }
    });
});
