// Shared tsx CLI rig for the Wave-8e script tests
// (run_skill_evals, backfill_model_tier, profile_use, tool_registry,
// cost_summary). Committed helper — every Wave-8e test imports from here so
// the tsx CLI setup lives in exactly one place. The python3 differential
// half was removed with the py2ts test-layer purge (the .py originals are
// long deleted).
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

/** Run a Wave-8e script with `args` (via tsx). */
export function runTs(
    scriptName: string,
    args: string[],
    options: { cwd?: string } = {},
): SpawnSyncReturns<string> {
    const ts = path.join(REPO_ROOT, 'src', 'scripts', `${scriptName}.ts`);
    return spawnSync(TSX_BIN, [ts, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
    });
}
