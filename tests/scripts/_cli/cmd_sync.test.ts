// Golden-parity tests for src/scripts/_cli/cmd_sync.ts (py2ts ADR-200 — replay
// the installed-tools manifest).
//
// Strategy: run `python3 src/scripts/_cli/cmd_sync.py` vs
// `tsx src/scripts/_cli/cmd_sync.ts` and byte-compare stdout / stderr / exit.
//
// SAFETY: cmd_sync only calls the installer (`install_main`) for tools whose
// bridge marker is MISSING — that path would mutate the install. Every case
// here exercises a branch that returns BEFORE `_run_install` is ever invoked:
//   - no manifest → exit 1.
//   - empty manifest → exit 0.
//   - all markers present (absolute marker paths that exist) → "All bridges
//     already installed" exit 0.
//   - --dry-run with a missing marker → surfaced list + "Dry-run: no bridges
//     written." (the Python returns 0 BEFORE the install loop).
//   - --quiet variants.
// No case reaches the installer, so the real install / network / browser are
// never touched. The project root is pinned to a temp dir via env.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_sync.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_sync.py');
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

function rootEnv(root: string): Record<string, string> {
    return { AGENT_CONFIG_ROOT_OVERRIDE: '1', AGENT_CONFIG_PROJECT_ROOT: root };
}

function runPy(args: string[], root: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src'), ...rootEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], root: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', ...rootEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acsync-'));
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

const manifestPath = (root: string): string =>
    path.join(root, 'agents', 'installed-tools.lock');

function writeManifest(root: string, body: string): void {
    const p = manifestPath(root);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** Normalise raw + realpath of `root` to <TMP>. */
function norm(text: string, root: string): string {
    let out = text.split(root).join('<TMP>');
    let real = root;
    try {
        real = fs.realpathSync(root);
    } catch {
        /* may be removed */
    }
    out = out.split(real).join('<TMP>');
    return out;
}

/** Byte-parity with both roots normalised to <TMP>. */
function expectParity(args: string[], pyRoot: string, tsRoot: string): RunResult {
    const p = runPy(args, pyRoot);
    const t = runTs(args, tsRoot);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, tsRoot)).toBe(norm(p.stdout, pyRoot));
    expect(norm(t.stderr, tsRoot)).toBe(norm(p.stderr, pyRoot));
    return t;
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_sync — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const p = runPy(['--bogus'], root);
        const t = runTs(['--bogus'], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('--project without a value → exit 2', () => {
        const root = freshRoot();
        const p = runPy(['--project'], root);
        const t = runTs(['--project'], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
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
// no manifest → exit 1
// ---------------------------------------------------------------------------

describe('cmd_sync — no manifest', () => {
    itPy('absent manifest → exit 1 + create-one hint', () => {
        const py = freshRoot();
        const ts = freshRoot();
        const t = expectParity([], py, ts);
        expect(t.status).toBe(1);
    });

    itPy('absent manifest + --quiet → exit 1, no stdout', () => {
        const py = freshRoot();
        const ts = freshRoot();
        const p = runPy(['--quiet'], py);
        const tr = runTs(['--quiet'], ts);
        expect(tr.status).toBe(1);
        expect(p.status).toBe(1);
        expect(tr.stdout).toBe('');
        expect(tr.stdout).toBe(p.stdout);
    });
});

// ---------------------------------------------------------------------------
// empty manifest → exit 0
// ---------------------------------------------------------------------------

describe('cmd_sync — empty manifest', () => {
    itPy('manifest with no tools → "Manifest is empty" exit 0', () => {
        const py = freshRoot();
        const ts = freshRoot();
        const body = 'schema_version: 2\nagent_config_version: "1.0.0"\ntools:\n';
        writeManifest(py, body);
        writeManifest(ts, body);
        const t = expectParity([], py, ts);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// all markers present → "All bridges already installed" (mutation-free)
// ---------------------------------------------------------------------------

describe('cmd_sync — all markers present', () => {
    itPy('every bridge_marker exists → exit 0, nothing to do', () => {
        const py = freshRoot();
        const ts = freshRoot();
        // Project-scope marker = a relative path that exists under the root.
        for (const root of [py, ts]) {
            fs.writeFileSync(path.join(root, 'marker-a'), 'x');
            fs.writeFileSync(path.join(root, 'marker-b'), 'x');
            writeManifest(
                root,
                'schema_version: 2\n' +
                    'agent_config_version: "1.0.0"\n' +
                    'tools:\n' +
                    '  - name: alpha\n' +
                    '    scope: project\n' +
                    '    bridge_marker: marker-a\n' +
                    '    installed_at: "2026-01-01"\n' +
                    '  - name: beta\n' +
                    '    scope: project\n' +
                    '    bridge_marker: marker-b\n' +
                    '    installed_at: "2026-01-01"\n',
            );
        }
        const t = expectParity([], py, ts);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// --dry-run with a missing marker → surfaced list, no installer call
// ---------------------------------------------------------------------------

describe('cmd_sync — --dry-run (missing marker, mutation-free)', () => {
    function buildMissing(root: string): void {
        // marker-a present; marker-b absent → exactly one missing tool.
        fs.writeFileSync(path.join(root, 'marker-a'), 'x');
        writeManifest(
            root,
            'schema_version: 2\n' +
                'agent_config_version: "1.0.0"\n' +
                'tools:\n' +
                '  - name: alpha\n' +
                '    scope: project\n' +
                '    bridge_marker: marker-a\n' +
                '    installed_at: "2026-01-01"\n' +
                '  - name: beta\n' +
                '    scope: project\n' +
                '    bridge_marker: missing-marker-b\n' +
                '    installed_at: "2026-01-01"\n',
        );
    }

    itPy('--dry-run → surfaced missing list + "Dry-run: no bridges written."', () => {
        const py = freshRoot();
        const ts = freshRoot();
        buildMissing(py);
        buildMissing(ts);
        const t = expectParity(['--dry-run'], py, ts);
        expect(t.status).toBe(0);
        // dry-run never created the missing bridge.
        expect(fs.existsSync(path.join(ts, 'missing-marker-b'))).toBe(false);
        expect(fs.existsSync(path.join(py, 'missing-marker-b'))).toBe(false);
    });

    itPy('--dry-run --quiet → exit 0, no stdout', () => {
        const py = freshRoot();
        const ts = freshRoot();
        buildMissing(py);
        buildMissing(ts);
        const p = runPy(['--dry-run', '--quiet'], py);
        const tr = runTs(['--dry-run', '--quiet'], ts);
        expect(tr.status).toBe(0);
        expect(p.status).toBe(0);
        expect(tr.stdout).toBe('');
        expect(tr.stdout).toBe(p.stdout);
    });
});
