// Shared parity harness for the src/scripts/mcp_server/* twins (py2ts Phase 8).
//
// Committed helper (never an untracked import). Provides:
//   * REPO_ROOT — the package root resolved from this file.
//   * hasPython3 — gate for golden-parity blocks (skipIf when absent).
//   * runPyInline — run a python3 -c snippet with src/ on PYTHONPATH, used to
//     diff the Python loader output against the TS twin where deterministic.
//   * makeTmpDir / writeFile helpers for hermetic fixtures.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

/** Whether a python3 with the mcp_server package importable is available. */
export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run an inline `python3 -c <code>` snippet with `src/` on PYTHONPATH. */
export function runPyInline(
    code: string,
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
    const env = { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...options.env };
    const r = spawnSync('python3', ['-c', code], {
        encoding: 'utf8',
        cwd: options.cwd ?? REPO_ROOT,
        env,
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Create a fresh temp dir under the OS tmp root; caller cleans up. */
export function makeTmpDir(prefix = 'mcp-twin-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** mkdir -p + write a file in one call. */
export function writeFile(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

/** Bump a file's mtime forward by `seconds` (mirrors os.utime in the py tests). */
export function bumpMtime(p: string, seconds = 2): void {
    const future = fs.statSync(p).mtimeMs / 1000 + seconds;
    fs.utimesSync(p, future, future);
}
