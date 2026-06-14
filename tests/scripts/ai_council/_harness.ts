// Shared golden-parity rig for the py2ts Phase 1 ai_council FOUNDATION wave
// (budget_guard, airgap, cli_hints, probation_gate). Committed helper — the
// python3/tsx differential setup lives in exactly one place.
//
// The Python modules import `from scripts.ai_council...` / `from scripts._lib
// ...`; pyproject pins `pythonpath = ["src", "."]`, so `python3 -c` here must
// put `<repo>/src` (and the repo root) on PYTHONPATH for the same resolution.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
function pyEnv(): NodeJS.ProcessEnv {
    const src = path.join(REPO_ROOT, 'src');
    const existing = process.env.PYTHONPATH;
    const parts = [src, REPO_ROOT];
    if (existing) {
        parts.push(existing);
    }
    return { ...process.env, PYTHONPATH: parts.join(path.delimiter) };
}

/** True when a `python3` interpreter is on PATH (gates golden-parity blocks). */
export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Run a `python3 -c <code>` snippet with the ai_council import root wired up.
 * `args` become `sys.argv[1:]`.
 */
export function runPyCode(
    code: string,
    args: string[] = [],
    options: { cwd?: string; input?: string } = {},
): SpawnSyncReturns<string> {
    return spawnSync('python3', ['-c', code, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        env: pyEnv(),
        input: options.input,
    });
}

/** Run the Python original of an ai_council script with `args`. */
export function runPyScript(
    moduleRelPath: string,
    args: string[],
    options: { cwd?: string; input?: string } = {},
): SpawnSyncReturns<string> {
    const py = path.join(REPO_ROOT, 'src', 'scripts', `${moduleRelPath}.py`);
    return spawnSync('python3', [py, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        env: pyEnv(),
        input: options.input,
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
