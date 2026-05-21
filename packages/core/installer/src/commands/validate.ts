/**
 * `validate` command — assert lockfile sha256s match disk.
 *
 * Reads the lockfile, re-hashes every managed file, and reports
 * `missing` / `modified` issues. Exit codes:
 *   0 — clean
 *   2 — no lockfile (operator error)
 *   4 — drift detected
 */

import { join } from 'node:path';
import { LOCKFILE_NAME, readLockfile } from '../lockfile.js';
import { runValidation, type FileIssue } from '../validate.js';
import type { SharedFlags } from '../cli.js';

export async function runValidate(shared: SharedFlags, raw: Record<string, unknown>): Promise<number> {
    const path = join(shared.projectRoot, LOCKFILE_NAME);
    const lock = readLockfile(path);
    if (lock === undefined) {
        process.stderr.write(
            `validate: no lockfile at ${path}. Run \`agent-config-installer init\` first.\n`,
        );
        return 2;
    }
    const report = runValidation({
        lockfile: lock,
        lockfilePath: path,
        projectRoot: shared.projectRoot,
    });

    if (raw.json === true) {
        process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
        renderHuman(report);
    }
    return report.status === 'ok' ? 0 : 4;
}

function renderHuman(report: ReturnType<typeof runValidation>): void {
    const out = process.stdout;
    out.write(`validate: ${report.files_ok}/${report.files_checked} files clean\n`);
    out.write(`  lockfile: ${report.lockfile_path}\n`);
    out.write(`  manifest_sha256: ${report.manifest_sha256}\n`);
    if (report.issues.length === 0) {
        out.write(`  status: ok\n`);
        return;
    }
    out.write(`  status: drift (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})\n`);
    const missing = report.issues.filter((i: FileIssue) => i.kind === 'missing');
    const modified = report.issues.filter((i: FileIssue) => i.kind === 'modified');
    if (missing.length > 0) {
        out.write(`\n  missing (${missing.length}):\n`);
        for (const i of missing) out.write(`    - ${i.path}\n`);
    }
    if (modified.length > 0) {
        out.write(`\n  modified (${modified.length}):\n`);
        for (const i of modified) out.write(`    - ${i.path}\n`);
    }
}
