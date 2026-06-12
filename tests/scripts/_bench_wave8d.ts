// Shared helpers for the Phase 8 / Wave 8d bench differential suites
// (bench_run, bench_ab_run, bench_ab_tracka_run, bench_drift_check).
//
// Committed (not an untracked local helper) so a clean CI checkout sees it.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
export const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
export const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

export function hasPyYaml(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}

export interface RunOut {
    stdout: string;
    stderr: string;
    status: number | null;
}

export function runPy(script: string, args: string[]): RunOut {
    const r = spawnSync('python3', [path.join(SCRIPTS, script), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

export function runTs(script: string, args: string[]): RunOut {
    const r = spawnSync(TSX_BIN, [path.join(SCRIPTS, script), ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

/** Snapshot a directory tree to a temp dir; returns a restore() closure. */
export function snapshotDir(dir: string): () => void {
    const snap = fs.mkdtempSync(path.join(os.tmpdir(), 'w8d-'));
    if (fs.existsSync(dir)) {
        fs.cpSync(dir, snap, { recursive: true });
    }
    const existed = fs.existsSync(dir);
    return (): void => {
        fs.rmSync(dir, { recursive: true, force: true });
        if (existed) {
            fs.mkdirSync(dir, { recursive: true });
            fs.cpSync(snap, dir, { recursive: true });
        }
        fs.rmSync(snap, { recursive: true, force: true });
    };
}

/** Normalise timing-bound fields so byte-comparison ignores non-determinism. */
export function normTiming(s: string): string {
    return s
        .replace(/"stamp": "[^"]*"/g, '"stamp": "<TS>"')
        .replace(/"duration_seconds": [0-9.]+/g, '"duration_seconds": <D>')
        .replace(/"generated_at": "[^"]*"/g, '"generated_at": "<TS>"')
        .replace(/"baseline_collector_sha": "[^"]*"/g, '"baseline_collector_sha": "<SHA>"')
        .replace(/\d{4}-\d{2}-\d{2}T[0-9:Z-]+/g, '<TS>')
        .replace(/`[0-9T:Z-]+`/g, '<TS>');
}
