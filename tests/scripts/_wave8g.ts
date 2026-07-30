// Shared tsx-only test rig for the Wave 8g script suites
// (capture_showcase_session, mine_session, extract_audit_patterns,
// prototype_lint_contradictions, annotate_discovery, update_prices).
// Committed helper — every Wave-8g test imports from here so the
// tsx runner setup lives in exactly one place.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

/**
 * Per-process sandbox home for spawned scripts.
 *
 * These suites spawn real CLIs. Without an isolated `$HOME` the child resolves
 * the DEVELOPER's global root, so any script that grows a global write path — the
 * user-memory observation buffer is the live example — would append to
 * `~/.event4u/` while the test suite runs. That is not a hypothetical: it is why
 * the miner's `--commit-intake` global write stayed unwired until this rig was
 * isolated.
 *
 * One sandbox per test process (not per call) so a suite can inspect what its
 * children wrote across calls. Left for the OS to reap: removing it eagerly would
 * race with a still-running child on a failed assertion.
 */
let SANDBOX_HOME: string | null = null;

export function sandboxHome(): string {
    if (SANDBOX_HOME === null) {
        SANDBOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'wave8g-home-'));
    }
    return SANDBOX_HOME;
}

/**
 * Run a Wave-8g TypeScript script with `args` (via tsx).
 *
 * `$HOME` and `$EVENT4U_CONFIG_HOME` point at the sandbox unless the caller
 * explicitly opts out with `inheritHome: true` — a test that needs the real
 * global root has to say so, which makes the dangerous case the loud one.
 */
export function runTs(
    scriptName: string,
    args: string[],
    options: { cwd?: string; input?: string; inheritHome?: boolean; env?: Record<string, string> } = {},
): SpawnSyncReturns<string> {
    const ts = path.join(REPO_ROOT, 'src', 'scripts', `${scriptName}.ts`);
    const home = sandboxHome();
    const env: Record<string, string | undefined> = options.inheritHome
        ? { ...process.env, ...options.env }
        : {
              ...process.env,
              HOME: home,
              EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
              ...options.env,
          };
    return spawnSync(TSX_BIN, [ts, ...args], {
        cwd: options.cwd ?? REPO_ROOT,
        encoding: 'utf8',
        input: options.input,
        env,
    });
}
