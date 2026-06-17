// Golden-parity tests for src/scripts/_cli/cmd_uninstall.ts (py2ts ADR-200 —
// the bridge-marker / lockfile uninstall command).
//
// Strategy: run `python3 src/scripts/_cli/cmd_uninstall.py` vs
// `tsx src/scripts/_cli/cmd_uninstall.ts` on temp project roots and
// byte-compare stdout / stderr / exit. Every case is pinned via
// AGENT_CONFIG_PROJECT_ROOT + AGENT_CONFIG_ROOT_OVERRIDE and the global lock is
// redirected to a temp file via AGENT_CONFIG_INSTALLED_LOCK, so the real
// install / user `~/.event4u` tree is never touched.
//
// Coverage map:
//   - usage / arg-error exit codes (exit + usage+error stderr; `--help` body
//     prose exempt per the porting contract).
//   - project scope, no lockfile + no --force → exit 1 (refusal stderr).
//   - project scope, no lockfile + --force --tools=<list> --dry-run → legacy
//     bridge-marker fallback (absent + present marker).
//   - project scope, real bridge-marker removal via --force (mutating).
//   - global scope, no lockfile + no --force → exit 1.
//   - global scope, isolated lockfile present → "no tools to uninstall" / list.
//
// Documented un-testable boundary (manifest-PRESENT v2 path): the sibling lib
// twin `installed_tools.read_manifest` calls `require("node:fs")` internally,
// which throws under the project's ESM runtime, so the TS uninstall always
// sees `manifest === null` and the Python one parses the YAML — the two
// diverge ONLY because of that lib-twin bug (out of scope for this task; the
// same defect is documented in cmd_doctor.test.ts). The v2 subtraction /
// two-phase-commit / files[]-deletion arms were hand-verified against the
// Python during porting; their golden parity unlocks once `installed_tools.ts`
// stops using `require()`.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_uninstall.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_uninstall.py');
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

function baseEnv(root: string, lock: string): Record<string, string> {
    return {
        AGENT_CONFIG_ROOT_OVERRIDE: '1',
        AGENT_CONFIG_PROJECT_ROOT: root,
        AGENT_CONFIG_INSTALLED_LOCK: lock,
    };
}

function runPy(args: string[], root: string, lock: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...baseEnv(root, lock) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], root: string, lock: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ...baseEnv(root, lock) },
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

const tmps: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acun-'));
    tmps.push(r);
    return r;
}
afterEach(() => {
    while (tmps.length) {
        try {
            fs.rmSync(tmps.pop()!, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});

/** py + ts byte-parity (after path normalization) + same exit. */
function expectParity(args: string[], root: string, lock: string): void {
    const p = runPy(args, root, lock);
    const t = runTs(args, root, lock);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, [root])).toBe(norm(p.stdout, [root]));
    expect(norm(t.stderr, [root])).toBe(norm(p.stderr, [root]));
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_uninstall — usage / arg errors', () => {
    itPy('unknown flag → exit 2 + usage+error stderr', () => {
        const root = freshRoot();
        const p = runPy(['--bogus'], root, path.join(root, 'lock'));
        const t = runTs(['--bogus'], root, path.join(root, 'lock'));
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('--help → exit 0 (usage banner first line; body prose exempt)', () => {
        const root = freshRoot();
        const p = runPy(['--help'], root, path.join(root, 'lock'));
        const t = runTs(['--help'], root, path.join(root, 'lock'));
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});

// ---------------------------------------------------------------------------
// project scope
// ---------------------------------------------------------------------------

describe('cmd_uninstall — project scope', () => {
    itPy('no lockfile + no --force → exit 1 refusal', () => {
        const root = freshRoot();
        expectParity([], root, path.join(root, 'lock'));
        expect(runTs([], root, path.join(root, 'lock')).status).toBe(1);
    });

    itPy('no lockfile + --force --tools=<list> --dry-run → legacy marker fallback', () => {
        const root = freshRoot();
        // claude-code marker present, gemini-cli absent → "removed/would" vs "absent".
        fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
        expectParity(
            ['--force', '--tools=claude-code,gemini-cli', '--dry-run'],
            root,
            path.join(root, 'lock'),
        );
    });

    itPy('no lockfile + --force --tools=all --dry-run → all known markers', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
        fs.writeFileSync(path.join(root, '.cursor', 'hooks.json'), '{}\n');
        expectParity(['--force', '--tools=all', '--dry-run'], root, path.join(root, 'lock'));
    });

    itPy('no lockfile + --force --tools=claude-code (real removal, mutating)', () => {
        const py = freshRoot();
        const ts = freshRoot();
        for (const r of [py, ts]) {
            fs.mkdirSync(path.join(r, '.claude'), { recursive: true });
            fs.writeFileSync(path.join(r, '.claude', 'settings.json'), '{}\n');
        }
        const p = runPy(['--force', '--tools=claude-code'], py, path.join(py, 'lock'));
        const t = runTs(['--force', '--tools=claude-code'], ts, path.join(ts, 'lock'));
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, [ts])).toBe(norm(p.stdout, [py]));
        expect(fs.existsSync(path.join(py, '.claude', 'settings.json'))).toBe(false);
        expect(fs.existsSync(path.join(ts, '.claude', 'settings.json'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// global scope (isolated lockfile)
// ---------------------------------------------------------------------------

describe('cmd_uninstall — global scope', () => {
    itPy('no lockfile + no --force → exit 1', () => {
        const root = freshRoot();
        const lock = path.join(root, 'installed.lock'); // absent
        const p = runPy(['--global'], root, lock);
        const t = runTs(['--global'], root, lock);
        expect(t.status).toBe(1);
        expect(p.status).toBe(1);
        expect(norm(t.stderr, [root])).toBe(norm(p.stderr, [root]));
    });

    itPy('no lockfile + --force (no tools) → "no tools to uninstall" exit 0', () => {
        const root = freshRoot();
        const lock = path.join(root, 'installed.lock');
        const p = runPy(['--global', '--force'], root, lock);
        const t = runTs(['--global', '--force'], root, lock);
        expect(t.status).toBe(0);
        expect(p.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });
});
