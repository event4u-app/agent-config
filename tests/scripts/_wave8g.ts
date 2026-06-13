// Shared golden-parity rig for py2ts Phase 8 / Wave 8g
// (capture_showcase_session, mine_session, extract_audit_patterns,
// prototype_lint_contradictions, annotate_discovery, update_prices).
// Committed helper — every Wave-8g test imports from here so the
// python3/tsx differential setup lives in exactly one place.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

/** True when a `python3` interpreter is on PATH (gates golden-parity blocks). */
export function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run the Python original of a Wave-8g script with `args`. */
export function runPy(
    scriptName: string,
    args: string[],
    options: { cwd?: string; input?: string } = {},
): SpawnSyncReturns<string> {
    const py = path.join(REPO_ROOT, 'src', 'scripts', `${scriptName}.py`);
    return spawnSync('python3', [py, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        input: options.input,
    });
}

/** Run the TypeScript twin of a Wave-8g script with `args` (via tsx). */
export function runTs(
    scriptName: string,
    args: string[],
    options: { cwd?: string; input?: string } = {},
): SpawnSyncReturns<string> {
    const ts = path.join(REPO_ROOT, 'src', 'scripts', `${scriptName}.ts`);
    return spawnSync(TSX_BIN, [ts, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        input: options.input,
    });
}
