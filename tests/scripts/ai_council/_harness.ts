// Shared golden-parity rig for the py2ts Phase 1 ai_council FOUNDATION wave
// (budget_guard, airgap, cli_hints, probation_gate). Committed helper — the
// python3/tsx differential setup lives in exactly one place.
//
// ── Snapshot-oracle conversion (py2ts Phase 4/5) ──────────────────────────
// The Python side of every parity rig no longer spawns `python3` at run time.
// `runPyCode` / `runPyScript` now delegate to the parity oracle
// (`tests/_lib/parity_oracle.ts`): capture mode (`PY2TS_CAPTURE=1`) spawns
// python3 ONCE and freezes its `{stdout,stderr,status}` into a committed JSON
// snapshot; every normal run reads the frozen snapshot instead. The return
// shape is preserved ({ stdout, stderr, status }) so the 14 importer rigs need
// no change. `runTsScript` (the REAL `.ts` twin) is untouched — it still spawns
// `tsx`. `hasPython3` returns `true` unconditionally: the snapshot path needs
// no live python3, so the parity blocks must ALWAYS run (a missing snapshot
// throws loudly in the oracle rather than silently skipping).
//
// The Python modules import `from scripts.ai_council...` / `from scripts._lib
// ...`; pyproject pins `pythonpath = ["src", "."]`, so the python invocation
// here puts `<repo>/src` (and the repo root) on PYTHONPATH for the same
// resolution. That env only matters in capture mode (when python3 actually
// runs); normal runs read the frozen golden.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { oracle2, oracleFile } from '../../_lib/parity_oracle.js';

// Re-exported so file-sink rigs (sub-shape A) decode frozen outputs from the
// same import as the run helpers.
export { oracleFile };

// tests/scripts/ai_council/_harness.ts → three levels up is the repo root.
export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

/** PYTHONPATH that mirrors pyproject's `pythonpath = ["src", "."]`. */
function pyPythonPath(): string {
    const src = path.join(REPO_ROOT, 'src');
    const existing = process.env.PYTHONPATH;
    const parts = [src, REPO_ROOT];
    if (existing) {
        parts.push(existing);
    }
    return parts.join(path.delimiter);
}

/**
 * Gate for the golden-parity blocks. Returns `true` unconditionally: the
 * snapshot oracle replays the frozen Python output with no live `python3`, so
 * the parity blocks must always run. (Capture mode still spawns python3, but
 * by then python3 is known-present.) A missing snapshot throws in the oracle —
 * it never silently skips or passes.
 */
export function hasPython3(): boolean {
    return true;
}

/**
 * Minimal subset of `SpawnSyncReturns<string>` the rigs read from a python run,
 * plus v3 frozen file side-effects (`files`, present only when the call declares
 * `outputs` — sub-shape A "file-sink" rigs). Decode a frozen file with
 * `oracleFile(result, name)`.
 */
type PyResult = Pick<SpawnSyncReturns<string>, 'stdout' | 'stderr' | 'status'> & {
    files?: Record<string, string | null>;
};

/**
 * Run a `python3 -c <code>` snippet with the ai_council import root wired up.
 * `args` become `sys.argv[1:]`. Routed through the parity oracle (kind:inline)
 * — see the snapshot-oracle note at the top of this file.
 */
export function runPyCode(
    code: string,
    args: string[] = [],
    options: {
        cwd?: string;
        input?: string;
        normalize?: (s: string) => string;
        outputs?: Record<string, string>;
        scratch?: string[];
    } = {},
): PyResult {
    return oracle2({
        kind: 'inline',
        target: code,
        args,
        env: { PYTHONPATH: pyPythonPath() },
        cwd: options.cwd ?? REPO_ROOT,
        ...(options.input !== undefined ? { input: options.input } : {}),
        ...(options.normalize !== undefined ? { normalize: options.normalize } : {}),
        ...(options.outputs !== undefined ? { outputs: options.outputs } : {}),
        ...(options.scratch !== undefined ? { scratch: options.scratch } : {}),
    });
}

/**
 * Run the Python original of an ai_council script with `args`. Routed through
 * the parity oracle (kind:script) — the `.py` is spawned only in capture mode.
 */
export function runPyScript(
    moduleRelPath: string,
    args: string[],
    options: {
        cwd?: string;
        input?: string;
        normalize?: (s: string) => string;
        outputs?: Record<string, string>;
        scratch?: string[];
    } = {},
): PyResult {
    return oracle2({
        kind: 'script',
        target: path.join('src', 'scripts', moduleRelPath),
        args,
        env: { PYTHONPATH: pyPythonPath() },
        cwd: options.cwd ?? REPO_ROOT,
        ...(options.input !== undefined ? { input: options.input } : {}),
        ...(options.normalize !== undefined ? { normalize: options.normalize } : {}),
        ...(options.outputs !== undefined ? { outputs: options.outputs } : {}),
        ...(options.scratch !== undefined ? { scratch: options.scratch } : {}),
    });
}

/** Run the TypeScript twin of an ai_council script with `args` (via tsx). */
export function runTsScript(
    moduleRelPath: string,
    args: string[],
    options: { cwd?: string; input?: string } = {},
): SpawnSyncReturns<string> {
    const ts = path.join(REPO_ROOT, 'src', 'scripts', `${moduleRelPath}.ts`);
    return spawnSync(TSX_BIN, [ts, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        input: options.input,
    });
}

/** Resolve a path to a TS twin's compiled `.js` import specifier (for dynamic import). */
export function tsTwin(moduleRelPath: string): string {
    return path.join(REPO_ROOT, 'src', 'scripts', `${moduleRelPath}.ts`);
}
