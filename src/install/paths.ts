/**
 * Centralised path resolution for the unified TS install engine.
 *
 * Council Finding #16: every downstream module reads paths from one
 * place — no inline `os.tmpdir()` or `~/.event4u/...` literals scattered
 * across A2–A6.
 *
 * All helpers accept an optional `home` argument so tests can drive
 * platform behaviour (POSIX vs Windows env-var fallback) without
 * mocking `node:os`. Production callers omit it and `os.homedir()` is
 * consulted lazily.
 *
 * Platform notes:
 *   - POSIX: `os.homedir()` reads `$HOME`.
 *   - Windows: `os.homedir()` reads `$USERPROFILE`, then `$HOMEDRIVE+$HOMEPATH`.
 *
 * The install root and log path live under a fixed `.event4u/agent-config/`
 * sub-tree so both platforms land on the same logical location.
 */

import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Sub-tree under the user's home where v4 installs land.
 *
 * Matches the legacy Python installer's target (`~/.event4u/agent-config/`)
 * so v3 and v4 read/write the same physical tree and v3-detection (Phase E2)
 * can introspect a prior install without a migration step.
 */
export const INSTALL_ROOT_SUBPATH = '.event4u/agent-config';

/**
 * Active transaction log filename written by Phase A4 atomic-writer.
 *
 * Per Phase A4 + council Finding #18: rotation produces sibling files
 * (`install-log.<ISO>.jsonl.gz`); recovery only scans the active log.
 */
export const INSTALL_LOG_FILENAME = 'install-log.jsonl';

/**
 * Resolve the home directory.
 *
 * `home` override is accepted so tests can pin platform behaviour
 * without mocking the `node:os` module. Empty / falsy override falls
 * back to `os.homedir()`.
 */
function resolveHome(home?: string): string {
    if (home && home.length > 0) {
        return home;
    }
    const fromOs = homedir();
    if (!fromOs) {
        throw new Error(
            'Cannot resolve home directory — both $HOME (POSIX) and $USERPROFILE (Windows) are unset.',
        );
    }
    return fromOs;
}

/**
 * Absolute path to the v4 install root: `~/.event4u/agent-config/`.
 *
 * Stable across platforms because the suffix is a POSIX-style join
 * applied via `path.join`, which normalises separators per platform.
 */
export function getInstallRoot(home?: string): string {
    return join(resolveHome(home), INSTALL_ROOT_SUBPATH);
}

/**
 * Absolute path to the active transaction log:
 * `~/.event4u/agent-config/install-log.jsonl`.
 *
 * Phase A4 writers append here on every successful atomic rename.
 */
export function getLogPath(home?: string): string {
    return join(getInstallRoot(home), INSTALL_LOG_FILENAME);
}

/**
 * OS-level temp directory.
 *
 * Wraps `os.tmpdir()` so callers funnel through one symbol — drop-in
 * replacement when a future test harness needs to redirect temp writes
 * to a scratch dir without monkey-patching `node:os`.
 */
export function getTempPath(): string {
    return tmpdir();
}
