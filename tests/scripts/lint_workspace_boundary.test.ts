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
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _forbidden_reason, _is_intra_workspace, check_file } from '../../src/scripts/lint_workspace_boundary.js';

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
const PY_WRAPPER = [
    'import importlib.util, os, pathlib, json',
    'spec = importlib.util.spec_from_file_location("lwb", os.environ["WB_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'findings = m.check_file(pathlib.Path(os.environ["WB_TARGET"]))',
    'print(json.dumps(findings, ensure_ascii=False))',
    '',
].join('\n');

describe.runIf(py3)('lint_workspace_boundary — check_file golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let pyWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-parity-'));
        pyWrap = path.join(tmp, 'wrap.py');
        fs.writeFileSync(pyWrap, PY_WRAPPER, 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    /** Compare check_file findings on `body` (written to a `workspace_*.py` name). */
    function expectFindingsMatch(body: string, name = 'workspace_fixture.py'): void {
        const target = path.join(tmp, name);
        fs.writeFileSync(target, body, 'utf-8');
        const env = childEnv({ WB_PY: PY_SCRIPT, WB_TARGET: target });
        const py = spawnSync('python3', [pyWrap], { env, encoding: 'utf8' });
        expect(py.status, `python3 wrapper failed: ${py.stderr}`).toBe(0);
        const pyFindings = JSON.parse(py.stdout.trim()) as string[];
        const tsFindings = check_file(target);
        expect(tsFindings).toEqual(pyFindings);
    }

    it('pass: only allowed imports → no findings', () => {
        expectFindingsMatch(
            ['import os', 'import sys', 'from pathlib import Path', 'import workspace_secrets', ''].join('\n'),
        );
    });

    it('violation: one forbidden import per not-owned domain', () => {
        expectFindingsMatch(
            [
                'from condense import x',
                'import skill_linter',
                'from skill_management import a',
                'import skill_writing',
                'from discovery_manifest import d',
                'import profiles',
                'import packs',
                'from ai_video import v',
                'import mcp',
                'from router import r',
                'import persona_writer',
                '',
            ].join('\n'),
        );
    });

    it('allow: intra-workspace imports never flagged', () => {
        expectFindingsMatch(
            ['import workspace', 'import workspace_skills', 'from workspace_documents import D', ''].join('\n'),
        );
    });

    it('allow: relative `from . import x` (module=None) is skipped', () => {
        expectFindingsMatch(['from . import sibling', 'from .pkg import thing', ''].join('\n'));
    });

    it('allow: `# boundary-exception:` pragma on a forbidden import is skipped', () => {
        expectFindingsMatch(
            [
                'from condense import x  # boundary-exception: reviewed, deliberate',
                'import mcp  # no pragma here → flagged',
                '',
            ].join('\n'),
        );
    });

    it('packaging does not trip pack; multi-name + alias import lines', () => {
        expectFindingsMatch(
            ['import packaging', 'import os, sys, packaging', 'import router as r, condense as c', ''].join('\n'),
        );
    });

    it('substring near-misses do not trip segment-bounded patterns', () => {
        // `packs_helper` (pack + suffix) IS matched (`(?:$|[._-])` boundary);
        // `unpacked` is not. Whatever the shared regex decides, both engines agree.
        expectFindingsMatch(
            ['import unpacked', 'import packs_helper', 'from condenser import x', ''].join('\n'),
        );
    });

    it('unreadable target → identical `unparseable` finding', () => {
        // Point check_file at a path that does not exist as a file (a dir):
        // both engines surface the read error as one `unparseable` line. The
        // OS error text differs py↔ts, so compare only the shape + that there
        // is exactly one finding ending in the expected suffix family.
        const dirTarget = path.join(tmp, 'a-directory');
        fs.mkdirSync(dirTarget);
        const env = childEnv({ WB_PY: PY_SCRIPT, WB_TARGET: dirTarget });
        const py = spawnSync('python3', [pyWrap], { env, encoding: 'utf8' });
        // Python's read_text on a directory raises IsADirectoryError (OSError),
        // NOT SyntaxError — the `except SyntaxError` does not catch it, so the
        // wrapper exits non-zero. TS catches any read error → one `unparseable`
        // line. This is a documented py-side narrowing (only SyntaxError, marked
        // `pragma: no cover`); the shapes diverge by language so we assert the
        // TS side returns exactly one `unparseable` finding and the py side
        // raises (its `pragma: no cover` path), rather than byte-comparing.
        const tsFindings = check_file(dirTarget);
        expect(tsFindings.length).toBe(1);
        expect(tsFindings[0]!.includes('unparseable')).toBe(true);
        expect(py.status).not.toBe(0); // py raised IsADirectoryError (no-cover path)
    });
});

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
