// Golden-parity tests for the `cmd_refresh` TypeScript twin (ADR-200).
//
// Strategy: run `python3 src/scripts/_cli/cmd_refresh.py` vs
// `tsx src/scripts/_cli/cmd_refresh.ts` on SAFE surfaces and assert
// byte-identical stdout / stderr / exit (after normalizing tmp paths). The
// command's project root is `Path.cwd()`, so each side is spawned with
// `cwd = <throwaway temp fixture>` — never the real repo.
//
// SAFETY: the `--global` scope shells out to the real `bash src/scripts/install
// --global`, which mutates the developer's global install. The CLI process
// cannot inject the Python `runner` seam, so `--global` is exercised ONLY on
// its non-executing arm (installer-not-found, driven by a fixture whose
// PACKAGE_ROOT has no installer is not reachable — PACKAGE_ROOT is fixed to the
// real repo). We therefore never spawn a real `--global` run; coverage of the
// runner path is left to the unit seam (`main({ runner })`) exercised in-proc.
//
// `--help` BODY prose is NOT byte-compared (argparse re-wraps — documented
// divergence); we assert the `usage:` token + exit code.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_refresh.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_refresh.py');
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

// `cmd_refresh`'s project root is the spawn cwd. `require('yaml')` is not on
// any output-bearing path here (no settings/profile read), so the temp cwd is
// safe for both sides.
function runPy(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

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
    return out;
}

// `--project` runs cli_wrapper + sync_gitignore, whose detail counts and CWD
// stamps are stable across runtimes; the only volatile bit in OUTPUT is the
// path, normalized above. (File CONTENTS — the bridge marker's `installed_at`
// — are non-deterministic but are NOT part of the compared CLI output.)
function expectParity(args: string[], cwds: { py: string; ts: string }, roots: string[]): void {
    const p = runPy(args, cwds.py);
    const t = runTs(args, cwds.ts);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, [...roots, cwds.ts, cwds.py])).toBe(norm(p.stdout, [...roots, cwds.py, cwds.ts]));
    expect(norm(t.stderr, [...roots, cwds.ts, cwds.py])).toBe(norm(p.stderr, [...roots, cwds.py, cwds.ts]));
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Usage / argument errors + no-scope.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('refresh — argument errors', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const p = runPy(['--help'], tmp);
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config refresh')).toBe(true);
        expect(p.stdout.startsWith('usage: agent-config refresh')).toBe(true);
    });

    it('unknown flag: exit 2, usage + error byte-identical', () => {
        const p = runPy(['--bogus'], tmp);
        const t = runTs(['--bogus'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(2);
        expect(norm(t.stderr, [tmp])).toBe(norm(p.stderr, [tmp]));
    });

    it('no scope flag: exit 1, "specify a scope" on stderr — byte-identical', () => {
        const p = runPy([], tmp);
        const t = runTs([], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(1);
        expect(norm(t.stderr, [tmp])).toBe(norm(p.stderr, [tmp]));
        expect(t.stdout).toBe(p.stdout); // both empty
    });
});

// ---------------------------------------------------------------------------
// --project on a fresh consumer fixture (writes only into the temp dir).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('refresh --project — fresh consumer', () => {
    it('scaffolds bridge marker + overrides + gitignore; output parity, exit 0', () => {
        // Independent fixtures so neither side observes the other's writes.
        const pcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-py-'));
        const tcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-ts-'));
        try {
            expectParity(['--project'], { py: pcwd, ts: tcwd }, []);
            // Both produced the same file set.
            const tree = (d: string): string[] =>
                fs
                    .readdirSync(d, { recursive: true, withFileTypes: true })
                    .filter((e) => e.isFile())
                    .map((e) => path.relative(d, path.join((e as fs.Dirent).parentPath ?? d, e.name)))
                    .sort();
            expect(tree(tcwd)).toEqual(tree(pcwd));
        } finally {
            fs.rmSync(pcwd, { recursive: true, force: true });
            fs.rmSync(tcwd, { recursive: true, force: true });
        }
    });

    it('idempotent second run: output parity, exit 0', () => {
        const pcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-py2-'));
        const tcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-ts2-'));
        try {
            runPy(['--project'], pcwd);
            runTs(['--project'], tcwd);
            // Second run — overrides/README already present; gitignore block
            // already synced; the deterministic lines should still match.
            expectParity(['--project'], { py: pcwd, ts: tcwd }, []);
        } finally {
            fs.rmSync(pcwd, { recursive: true, force: true });
            fs.rmSync(tcwd, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// --project inside a source-repo-shaped fixture → skipped no-op.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('refresh --project — source repo skip', () => {
    it('dist/agent-src present → "skipped" no-op, exit 0, no scaffold', () => {
        const pcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-srcpy-'));
        const tcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-srcts-'));
        fs.mkdirSync(path.join(pcwd, 'dist', 'agent-src'), { recursive: true });
        fs.mkdirSync(path.join(tcwd, 'dist', 'agent-src'), { recursive: true });
        try {
            expectParity(['--project'], { py: pcwd, ts: tcwd }, []);
            // No agents/ scaffold was written (source-repo skip fired first).
            expect(fs.existsSync(path.join(tcwd, 'agents'))).toBe(false);
            expect(fs.existsSync(path.join(pcwd, 'agents'))).toBe(false);
        } finally {
            fs.rmSync(pcwd, { recursive: true, force: true });
            fs.rmSync(tcwd, { recursive: true, force: true });
        }
    });

    it('package.json name @event4u/agent-config → "skipped" no-op, exit 0', () => {
        const pcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-pkgpy-'));
        const tcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-pkgts-'));
        const pkg = JSON.stringify({ name: '@event4u/agent-config' }) + '\n';
        fs.writeFileSync(path.join(pcwd, 'package.json'), pkg);
        fs.writeFileSync(path.join(tcwd, 'package.json'), pkg);
        try {
            expectParity(['--project'], { py: pcwd, ts: tcwd }, []);
        } finally {
            fs.rmSync(pcwd, { recursive: true, force: true });
            fs.rmSync(tcwd, { recursive: true, force: true });
        }
    });
});
