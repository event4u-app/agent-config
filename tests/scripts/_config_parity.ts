// Shared parity harness for the src/scripts/config/* twins (py2ts Phase 8).
//
// Committed helper (never an untracked import). Provides:
//   * REPO_ROOT — the package root resolved from this file.
//   * hasPython3 — gate for golden-parity blocks (skipIf when absent).
//   * runPy / runTsx — subprocess runners for a config module's CLI, used to
//     diff python3 vs tsx byte-for-byte where the output is deterministic.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run the .py twin via `python3 -m`, with `src/` on PYTHONPATH (package mode). */
export function runPy(
    moduleArgs: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
    const env = { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...options.env };
    const r = spawnSync('python3', moduleArgs, {
        encoding: 'utf8',
        cwd: options.cwd ?? REPO_ROOT,
        env,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Run the .ts twin via tsx. */
export function runTsx(
    tsScript: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
    const r = spawnSync(TSX_BIN, [tsScript, ...args], {
        encoding: 'utf8',
        cwd: options.cwd ?? REPO_ROOT,
        env: { ...process.env, ...options.env },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
