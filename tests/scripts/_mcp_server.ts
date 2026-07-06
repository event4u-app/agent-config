// Shared tsx-only test helpers for the src/scripts/mcp_server/* suites.
//
// Committed helper (never an untracked import). Provides:
//   * REPO_ROOT — the package root resolved from this file.
//   * makeTmpDir / writeFile / bumpMtime helpers for hermetic fixtures.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

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
