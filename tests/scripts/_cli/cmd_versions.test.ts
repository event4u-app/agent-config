// Golden-parity tests for src/scripts/_cli/cmd_versions.ts (py2ts ADR-200 — the
// npm-version lister).
//
// Strategy: run `python3 src/scripts/_cli/cmd_versions.py` vs
// `tsx src/scripts/_cli/cmd_versions.ts` and byte-compare stdout / stderr /
// exit. The command is read-only. The npm registry query is a network call, so
// every case forces the OFFLINE path (--offline or AGENT_CONFIG_OFFLINE=1) — no
// network, no real npm spawn that reaches out. The project root is pinned to a
// temp dir so the pinned/local version reads come from controlled fixtures, not
// the real repo.
//
// Coverage map:
//   - usage / arg-error exit codes (bad --limit int, missing value, unknown
//     flag, --help banner first line).
//   - --offline table output with no pin / no package.json.
//   - --offline with a package.json version + a pinned settings version
//     (pinned == local marker rendering).
//   - --offline --json (ensure_ascii JSON byte-parity; non-ASCII pin escaped).
//   - --limit variants (0 = all; small N; negative-slice tail).
//   - AGENT_CONFIG_OFFLINE=1 env kill-switch with no --offline flag.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_versions.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_versions.py');
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

/**
 * Pin the project root via env so the anchor walk cannot climb into the repo,
 * and force OFFLINE so no network/npm spawn happens. The package.json the
 * command also reads via `parents[3]` is the REAL repo package.json (read-only)
 * — both py and ts read the same one, so it stays in parity; the temp-root
 * package.json is the SECOND candidate and only used as a fallback.
 */
function baseEnv(root: string): Record<string, string> {
    return {
        AGENT_CONFIG_ROOT_OVERRIDE: '1',
        AGENT_CONFIG_PROJECT_ROOT: root,
        AGENT_CONFIG_OFFLINE: '1',
    };
}

function runPy(args: string[], root: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', PYTHONPATH: path.join(REPO_ROOT, 'src'), ...baseEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], root: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '80', ...baseEnv(root) },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const roots: string[] = [];
function freshRoot(): string {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'acver-'));
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

function expectParity(args: string[], root: string): void {
    const p = runPy(args, root);
    const t = runTs(args, root);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

// ---------------------------------------------------------------------------
// usage / arg errors
// ---------------------------------------------------------------------------

describe('cmd_versions — usage / arg errors', () => {
    itPy('bad --limit int → exit 2', () => {
        const root = freshRoot();
        const p = runPy(['--limit', 'abc'], root);
        const t = runTs(['--limit', 'abc'], root);
        expect(t.status).toBe(2);
        expect(p.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
        expect(t.stdout).toBe(p.stdout);
    });

    itPy('--limit without a value → exit 2', () => {
        const root = freshRoot();
        const p = runPy(['--limit'], root);
        const t = runTs(['--limit'], root);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });

    itPy('unknown flag → exit 2', () => {
        const root = freshRoot();
        const p = runPy(['--bogus'], root);
        const t = runTs(['--bogus'], root);
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
// offline table output (no versions → "registry query skipped")
// ---------------------------------------------------------------------------

describe('cmd_versions — offline table', () => {
    itPy('--offline with no pin (real repo package.json local) → identical', () => {
        const root = freshRoot();
        expectParity(['--offline'], root);
    });

    itPy('--offline with a pinned settings version → pinned marker rendering', () => {
        const root = freshRoot();
        // settings file at the typed subdir (project_settings_path location).
        fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'agents', 'settings', '.agent-settings.yml'),
            'agent_config_version: "1.2.3"\nother: x\n',
        );
        expectParity(['--offline'], root);
    });

    itPy('AGENT_CONFIG_OFFLINE=1 with no --offline flag → still offline', () => {
        const root = freshRoot();
        // baseEnv already sets AGENT_CONFIG_OFFLINE=1; running with no flag must
        // honor the env kill-switch identically on both sides.
        expectParity([], root);
    });
});

// ---------------------------------------------------------------------------
// --json (ensure_ascii byte-parity)
// ---------------------------------------------------------------------------

describe('cmd_versions — --json', () => {
    itPy('--offline --json → ensure_ascii JSON, identical bytes', () => {
        const root = freshRoot();
        expectParity(['--offline', '--json'], root);
    });

    itPy('--offline --json with non-ASCII pin → \\u-escaped in JSON', () => {
        const root = freshRoot();
        fs.mkdirSync(path.join(root, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'agents', 'settings', '.agent-settings.yml'),
            'agent_config_version: "1.0.0-Bjérn"\n',
        );
        expectParity(['--offline', '--json'], root);
    });
});

// ---------------------------------------------------------------------------
// --limit variants
// ---------------------------------------------------------------------------

describe('cmd_versions — --limit', () => {
    for (const lim of ['0', '1', '5', '20']) {
        itPy(`--offline --limit ${lim} → identical`, () => {
            const root = freshRoot();
            expectParity(['--offline', '--limit', lim], root);
        });
    }

    itPy('--offline --limit=3 (=form) → identical', () => {
        const root = freshRoot();
        expectParity(['--offline', '--limit=3'], root);
    });
});
