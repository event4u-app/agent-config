// Shared tsx-only test helpers for the src/scripts/config/* suites.
//
// Committed helper (never an untracked import). Provides:
//   * REPO_ROOT — the package root resolved from this file.
//   * runTsx — runner for a config module's CLI via tsx.
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

/** Run the .ts script via tsx. */
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
