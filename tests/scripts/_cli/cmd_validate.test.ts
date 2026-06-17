// Golden-parity tests for the `cmd_validate` TypeScript twin (ADR-200).
//
// Strategy: run `python3 src/scripts/_cli/cmd_validate.py` vs
// `tsx src/scripts/_cli/cmd_validate.ts` on SAFE, deterministic surfaces in
// temp fixtures and assert byte-identical stdout / stderr / exit code (after
// normalizing machine-specific tmp paths). Read-only command — never mutates
// a real install; every fixture is a throwaway temp dir, pinned via
// `AGENT_CONFIG_PROJECT_ROOT` so the anchor walk never escapes it.
//
// `--help` BODY prose is NOT byte-compared (argparse re-wraps to terminal
// width — documented divergence); we assert the `usage:` token + exit code.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_validate.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_validate.py');
// Absolute TSX_BIN: golden runs spawn with cwd=REPO_ROOT (so `require('yaml')`
// inside the shared `_lib`/`config` twins resolves), and a relative binary
// path would resolve against that cwd unreliably.
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

// Both sides spawn from REPO_ROOT and target the fixture via
// AGENT_CONFIG_PROJECT_ROOT — this keeps `require('yaml')` resolvable in the
// imported `_lib` twins while still pinning the read to the temp fixture.
function runPy(args: string[], projectRoot: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
            ...process.env,
            PYTHONPATH: path.join(REPO_ROOT, 'src'),
            AGENT_CONFIG_PROJECT_ROOT: projectRoot,
            ...extraEnv,
        },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], projectRoot: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, AGENT_CONFIG_PROJECT_ROOT: projectRoot, ...extraEnv },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Strip machine-specific tmp roots (raw + realpath) so the diff stays stable. */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* root may already be removed */
        }
        out = out.split(real).join('<TMP>');
    }
    return out;
}

function expectParity(
    args: string[],
    projectRoot: string,
    roots: string[],
    extraEnv: Record<string, string> = {},
): void {
    const p = runPy(args, projectRoot, extraEnv);
    const t = runTs(args, projectRoot, extraEnv);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, roots)).toBe(norm(p.stdout, roots));
    expect(norm(t.stderr, roots)).toBe(norm(p.stderr, roots));
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** A project root carrying a canonical v1 manifest with the given tool block. */
function manifestRepo(toolsBlock: string, version = '"2.1.0"'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-mf-'));
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'agents', 'installed-tools.lock'),
        `schema_version: 1\nagent_config_version: ${version}\n${toolsBlock}`,
    );
    return dir;
}

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('validate — argument errors', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const p = runPy(['--help'], tmp);
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config validate')).toBe(true);
        expect(p.stdout.startsWith('usage: agent-config validate')).toBe(true);
    });

    it('unknown flag: exit 2, usage + error byte-identical on stderr', () => {
        expectParity(['--bogus'], tmp, [tmp]);
    });

    it('--project missing argument: exit 2 usage parity', () => {
        expectParity(['--project'], tmp, [tmp]);
    });

    it('stray positional: exit 2 usage parity', () => {
        expectParity(['extra-positional'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// No-manifest path (exit 1).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('validate — no manifest', () => {
    it('missing lockfile: exit 1, hint lines parity', () => {
        expectParity([], tmp, [tmp]);
    });

    it('missing lockfile --quiet: exit 1, silent parity', () => {
        expectParity(['--quiet'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// Manifest-present paths.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('validate — manifest present', () => {
    it('clean global tool (marker present): exit 0', () => {
        // A global-scope tool whose bridge_marker resolves to a path we create.
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-home-'));
        const markerAbs = path.join(home, 'MARKER');
        fs.writeFileSync(markerAbs, 'x');
        const repo = manifestRepo(
            'tools:\n' +
                '  - name: claude-code\n' +
                '    scope: global\n' +
                `    bridge_marker: "${markerAbs}"\n` +
                '    installed_at: "2026-05-12"\n',
            '"0.0.0"', // match current_package_version fallback → no version_drift
        );
        try {
            expectParity(['--skip-version-check'], repo, [repo, home]);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('marker_missing: global tool with absent marker → exit 1', () => {
        const repo = manifestRepo(
            'tools:\n' +
                '  - name: claude-code\n' +
                '    scope: global\n' +
                '    bridge_marker: "/nonexistent/agent-config/MARKER"\n' +
                '    installed_at: "2026-05-12"\n',
        );
        try {
            expectParity(['--skip-version-check'], repo, [repo]);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });

    it('marker_missing (project scope, relative): exit 1, diagnose hints parity', () => {
        const repo = manifestRepo(
            'tools:\n' +
                '  - name: cursor\n' +
                '    scope: project\n' +
                '    bridge_marker: ".cursor/MISSING"\n' +
                '    installed_at: "2026-05-12"\n',
        );
        try {
            expectParity(['--skip-version-check'], repo, [repo]);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });

    it('manifest_corrupt: entry missing scope/marker → exit 1', () => {
        const repo = manifestRepo('tools:\n  - name: claude-code\n    installed_at: "2026-05-12"\n');
        try {
            expectParity(['--skip-version-check'], repo, [repo]);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });

    it('version_drift: manifest version != package version → exit 1', () => {
        // No version skip → the manifest's 9.9.9 disagrees with the package
        // version, surfacing version_drift + its diagnose deeplink. A real tool
        // entry (not the inline-empty `tools: []`, which the shared
        // installed_tools manual parser mis-reads — a pre-existing twin quirk,
        // out of scope here) drives a marker_missing alongside the drift.
        const repo = manifestRepo(
            'tools:\n' +
                '  - name: claude-code\n' +
                '    scope: global\n' +
                '    bridge_marker: "/nonexistent/agent-config/MARKER"\n' +
                '    installed_at: "2026-05-12"\n',
            '"9.9.9"',
        );
        try {
            expectParity([], repo, [repo]);
        } finally {
            fs.rmSync(repo, { recursive: true, force: true });
        }
    });
});
