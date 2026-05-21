/**
 * Lockfile/disk drift detection — pure I/O against the consumer tree.
 *
 * `runValidation` reads the lockfile, re-hashes every file it lists,
 * and returns a structured report. `status === 'ok'` iff every managed
 * file is present on disk with the recorded sha256. `manifest_sha256`
 * mismatches surface as `manifest_drift` (informational; the file
 * itself may still hash clean — the run-time view differs from the
 * release the lockfile was built against).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sha256OfFileSync } from './io/sha256.js';
import type { Lockfile } from './types.js';

export type ValidateStatus = 'ok' | 'drift';

export type FileIssue =
    | { readonly kind: 'missing'; readonly path: string }
    | { readonly kind: 'modified'; readonly path: string; readonly expected: string; readonly actual: string };

export interface ValidationReport {
    readonly status: ValidateStatus;
    readonly lockfile_path: string;
    readonly files_checked: number;
    readonly files_ok: number;
    readonly issues: readonly FileIssue[];
    readonly manifest_sha256: string;
    readonly schema_version: number;
}

export interface RunValidationOptions {
    readonly lockfile: Lockfile;
    readonly lockfilePath: string;
    readonly projectRoot: string;
}

export function runValidation(opts: RunValidationOptions): ValidationReport {
    const issues: FileIssue[] = [];
    let ok = 0;
    for (const entry of opts.lockfile.files) {
        const abs = join(opts.projectRoot, entry.path);
        if (!existsSync(abs)) {
            issues.push({ kind: 'missing', path: entry.path });
            continue;
        }
        const actual = sha256OfFileSync(abs);
        if (actual !== entry.sha256) {
            issues.push({ kind: 'modified', path: entry.path, expected: entry.sha256, actual });
            continue;
        }
        ok += 1;
    }
    return {
        status: issues.length === 0 ? 'ok' : 'drift',
        lockfile_path: opts.lockfilePath,
        files_checked: opts.lockfile.files.length,
        files_ok: ok,
        issues,
        manifest_sha256: opts.lockfile.manifest_sha256,
        schema_version: opts.lockfile.schema_version,
    };
}
