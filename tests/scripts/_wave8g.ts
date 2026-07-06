// Shared tsx-only test rig for the Wave 8g script suites
// (capture_showcase_session, mine_session, extract_audit_patterns,
// prototype_lint_contradictions, annotate_discovery, update_prices).
// Committed helper — every Wave-8g test imports from here so the
// tsx runner setup lives in exactly one place.
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

/** Run a Wave-8g TypeScript script with `args` (via tsx). */
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
