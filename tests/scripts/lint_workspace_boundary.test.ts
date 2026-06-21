// Golden-parity rig for the py2ts `lint_workspace_boundary` twin (ADR-200).
//
// The workspace-boundary linter flags a `src/cli/python/workspace_*.py` module
// that imports an owner-module of a NOT-owned domain. `main()` scans
// `<repo>/src/cli/python/workspace_*.py` resolved from the SCRIPT's own
// location (`__file__` / `import.meta.url`) — NOT from cwd or an env var — so a
// tmp fixture tree can never be reached through `main`. The golden-parity
// surface is therefore split:
//
//   1. `check_file(path)` — the per-file violation detector. Driven on the SAME
//      tmp fixture by python3 (importlib loader) and tsx (the exported fn),
//      byte-comparing the returned findings list across every branch: each
//      FORBIDDEN pattern, the intra-workspace allow, the relative-import
//      (`from . import`) skip, the `# boundary-exception:` pragma skip, and the
//      unreadable-file (`unparseable`) path.
//   2. `main([--quiet])` — driven as a direct CLI invocation against the REAL
//      repo (the only tree it will scan), byte-comparing stdout/stderr/exit for
//      the holds / quiet / usage-error paths.
//
// Findings carry `path.name` / `basename(p)` only (no abs path), so the tmp
// dirname never leaks into the compared output — no normalization needed.
// The unknown-arg banner (exit 2) IS byte-compared; argparse `--help` PROSE is
// not (exit + usage token only). COLUMNS pinned to 80. No env mutation; the
// real repo is only ever READ.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { _forbidden_reason, _is_intra_workspace } from '../../src/scripts/lint_workspace_boundary.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_workspace_boundary.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_workspace_boundary.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function childEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return { ...process.env, COLUMNS: '80', ...extra };
}

const py3 = hasPython3();

// --- TS-side unit checks (no python3 needed) --------------------------------

describe('lint_workspace_boundary — TS-side unit checks', () => {
    it('_is_intra_workspace recognises the workspace head', () => {
        expect(_is_intra_workspace('workspace')).toBe(true);
        expect(_is_intra_workspace('workspace_skills')).toBe(true);
        expect(_is_intra_workspace('workspace.sub.mod')).toBe(true);
        expect(_is_intra_workspace('os')).toBe(false);
        expect(_is_intra_workspace('packaging')).toBe(false);
    });

    it('_forbidden_reason matches FORBIDDEN with segment boundaries, not substrings', () => {
        expect(_forbidden_reason('condense')).toBe('skill design / condensation');
        expect(_forbidden_reason('skill_linter')).toBe('skill design');
        expect(_forbidden_reason('discovery_manifest')).toBe('profile/pack semantics');
        expect(_forbidden_reason('profiles')).toBe('profile/pack semantics');
        expect(_forbidden_reason('ai_video')).toBe('video-provider logic');
        expect(_forbidden_reason('mcp')).toBe('MCP-registry policy');
        expect(_forbidden_reason('router')).toBe('router / projection policy');
        expect(_forbidden_reason('persona_writer')).toBe('persona / skill design');
        // `packaging` must NOT trip `pack`; intra-workspace must NOT trip.
        expect(_forbidden_reason('packaging')).toBeNull();
        expect(_forbidden_reason('workspace_skills')).toBeNull();
        expect(_forbidden_reason('os')).toBeNull();
    });
});

// --- check_file golden parity (python3 vs tsx) ------------------------------

// The py wrapper loads the module via importlib and prints the JSON-encoded
// findings list for the file in WB_TARGET, so stdout is a stable comparand.

// --- main() golden parity against the REAL repo -----------------------------

function runPyMain(args: string[]): SpawnSyncReturns<string> {
    return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, env: childEnv(), encoding: 'utf8' });
}
function runTsMain(args: string[]): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, env: childEnv(), encoding: 'utf8' });
}

describe.runIf(py3)('lint_workspace_boundary — main() golden parity (real repo, read-only)', () => {
    it('default scan: stdout/stderr/exit byte-identical', () => {
        const py = runPyMain([]);
        const ts = runTsMain([]);
        expect(ts.status, 'exit').toBe(py.status);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
    });

    it('--quiet: suppresses the holds line identically', () => {
        const py = runPyMain(['--quiet']);
        const ts = runTsMain(['--quiet']);
        expect(ts.status, 'exit').toBe(py.status);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
    });

    it('unknown arg is IGNORED (no argparse — `"--quiet" in argv` only) → exit 0 identical', () => {
        // The .py main does a literal `"--quiet" in argv`, no argparse; the twin
        // mirrors `argv.includes('--quiet')`. An unrecognised flag is silently
        // ignored on BOTH sides (no usage banner, no exit 2). Asserting parity
        // of that shared no-argparse behaviour, not an argparse error path.
        const py = runPyMain(['--bogus']);
        const ts = runTsMain(['--bogus']);
        expect(ts.status, 'exit').toBe(py.status);
        expect(py.status).toBe(0);
        expect(ts.stdout, 'stdout').toBe(py.stdout);
        expect(ts.stderr, 'stderr').toBe(py.stderr);
    });
});
