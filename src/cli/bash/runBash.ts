/**
 * Bash-dispatcher delegate.
 *
 * Phase 2 strategy: the TS binary keeps the existing Bash dispatcher
 * (`scripts/agent-config`) as the canonical router. Native commands
 * (`versions`, `doctor-shell`, `--help`, `--version`) are handled in
 * TS; every other subcommand is forwarded verbatim with `exec`-style
 * semantics (`stdio: 'inherit'`, exit code propagated).
 *
 * Phase 5 (Shadow-Mode → flip) will reverse this: Bash becomes a thin
 * shim that forwards to TS. The contract here is exit-code parity.
 */

import { execa } from 'execa';
import { BASH_ENTRY } from '../paths.js';
import { logger } from '../log/logger.js';

export interface BashDelegateOptions {
    /** Subcommand and arguments to forward to the Bash dispatcher. */
    args: readonly string[];
}

/**
 * Forward to the Bash dispatcher. Returns the child's exit code; the
 * caller is responsible for `process.exit(code)`.
 *
 * Errors thrown by execa (ENOENT, non-executable file, …) are caught
 * and reported via the logger; we exit with code 127 in that case so
 * the failure is distinguishable from a normal subcommand non-zero.
 */
export async function delegateToBash(opts: BashDelegateOptions): Promise<number> {
    try {
        const child = execa('bash', [BASH_ENTRY, ...opts.args], {
            stdio: 'inherit',
            reject: false,
            env: process.env,
        });
        const result = await child;
        return result.exitCode ?? 1;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`failed to invoke Bash dispatcher: ${message}`);
        return 127;
    }
}
