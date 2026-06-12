// Shared test helpers for the bench_ab_clone / bench_ab_integrity twins
// (ADR-090 py2ts Phase 8 / Wave 8d). Committed as `_bench_ab.ts` so CI
// (clean checkout) always sees it.
//
// Both scripts hardcode the clones path `internal/bench/ab/clones/`, so the
// golden-parity blocks must build into that tracked-but-gitignored location.
// These helpers snapshot whether the clones dir pre-existed and remove it
// after each run, so the working tree is left exactly as found.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
export const CLONES = join(REPO_ROOT, 'internal', 'bench', 'ab', 'clones');
export const FIXTURE = join(REPO_ROOT, 'internal', 'bench', 'ab', 'fixture');

// Both the clone and integrity twins hardcode the SAME clones path, so the
// two test files must not manipulate it concurrently. Vitest runs files in
// parallel by default; this directory-based lock serializes them.
const LOCK_DIR = join(REPO_ROOT, 'internal', 'bench', 'ab', '.p2ts-clones.lock');

export function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function _sleep(ms: number): void {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        // busy-wait — tests are synchronous (spawnSync) and short.
    }
}

/** Acquire a cross-file FS lock (mkdir is atomic); retries until free. */
export function acquireClonesLock(): void {
    for (let i = 0; i < 600; i += 1) {
        try {
            mkdirSync(LOCK_DIR);
            return;
        } catch {
            _sleep(100);
        }
    }
    // Last resort: steal a stale lock so a crashed run can't wedge CI.
    try {
        rmSync(LOCK_DIR, { recursive: true, force: true });
        mkdirSync(LOCK_DIR);
    } catch {
        // proceed unlocked — better than hanging.
    }
}

export function releaseClonesLock(): void {
    try {
        rmSync(LOCK_DIR, { recursive: true, force: true });
    } catch {
        // ignore
    }
}

/** rmSync with ENOTEMPTY retry — large just-written trees flake on macOS. */
export function removeClones(): void {
    for (let i = 0; i < 10; i += 1) {
        if (!existsSync(CLONES)) {
            return;
        }
        try {
            rmSync(CLONES, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
            if (!existsSync(CLONES)) {
                return;
            }
        } catch {
            _sleep(100);
        }
    }
    rmSync(CLONES, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

export interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

export function runScript(bin: string, script: string, args: string[]): RunResult {
    const res = spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

/** {relpath: sha256} for every regular file under `root`, posix relpaths. */
export function hashTree(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            const st = statSync(full);
            if (st.isDirectory()) {
                walk(full);
            } else if (st.isFile()) {
                const rel = relative(root, full).split(sep).join('/');
                out[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
            }
        }
    };
    walk(root);
    return out;
}
