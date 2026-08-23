/**
 * Install-mode detection, extracted from `cmd_doctor.ts`.
 *
 * A PURE MOVE, and the reason is arithmetic. `cmd_doctor.ts` sits ~2,200 lines above the
 * 1,500-line ceiling, so `check_source_size_budget` refuses ANY net growth in it: the
 * override-delivery check cost 128 lines, extracting that check into
 * `doctor_overrides.ts` paid 119, and this pays the residual 9.
 *
 * Extracting a NEIGHBOUR rather than shaving the new feature is deliberate. The
 * alternative was compressing the new check's comments until the number fit, which buys
 * the same green from worse code. A file under the ceiling contributes zero excess, so
 * the total falls by exactly what leaves.
 *
 * It is also a genuinely separate concern: "which install shape is this project in" is
 * asked before any check runs, and it reads markers rather than performing a check.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Signals a set-up global-only consumer. The `.event4u-bridge.yml` marker was
 * retired (ADR-020 amendment 2026-07-13); the durable project-side signal is
 * the install-mode marker (written on every install) or the `agents/overrides/`
 * scaffold. Either is sufficient.
 */
export const INSTALL_MODE_MARKER_RELATIVE = 'agents/.agent-state/install-mode.txt';

export function _is_global_only_consumer(project_root: string): boolean {
    return (
        isFile(path.join(project_root, INSTALL_MODE_MARKER_RELATIVE)) ||
        isDir(path.join(project_root, 'agents', 'overrides'))
    );
}
