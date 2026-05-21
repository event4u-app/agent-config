/**
 * `prune` command — remove files in `.augment/` and `.agent-src/` that
 * the current lockfile no longer tracks.
 *
 * Interactive mode confirms before deleting. Non-interactive mode
 * requires `--yes` (or `--dry-run` to just list). Agent mode is not
 * supported on `prune` — the surface is local-state cleanup, not a
 * negotiable install step.
 *
 * Exit codes:
 *   0 — clean (no orphans) or successful cleanup
 *   2 — no lockfile / agent mode requested
 *   3 — non-interactive without --yes and orphans found
 */

import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { confirm } from '@inquirer/prompts';
import { LOCKFILE_NAME, readLockfile } from '../lockfile.js';
import { runPrune as computePrune, type PruneReport } from '../prune.js';
import type { SharedFlags } from '../cli.js';

export async function runPrune(shared: SharedFlags, raw: Record<string, unknown>): Promise<number> {
    if (shared.mode === 'agent') {
        process.stderr.write(`prune: agent mode not supported on this command.\n`);
        return 2;
    }
    const lockPath = join(shared.projectRoot, LOCKFILE_NAME);
    const lock = readLockfile(lockPath);
    if (lock === undefined) {
        process.stderr.write(
            `prune: no lockfile at ${lockPath}. Run \`agent-config-installer init\` first.\n`,
        );
        return 2;
    }
    const report = computePrune({ lockfile: lock, projectRoot: shared.projectRoot });

    if (report.orphans.length === 0) {
        renderClean(report, raw);
        return 0;
    }

    if (shared.dryRun) {
        renderOrphans(report, raw, /* deleted */ false);
        return 0;
    }

    if (shared.mode === 'non-interactive' && !shared.yes) {
        renderOrphans(report, raw, /* deleted */ false);
        process.stderr.write(`\nprune: ${report.orphans.length} orphan(s) found. Re-run with --yes to delete.\n`);
        return 3;
    }

    if (shared.mode === 'interactive' && !shared.yes) {
        renderOrphans(report, raw, /* deleted */ false);
        const confirmed = await confirm({
            message: `Delete ${report.orphans.length} orphan file(s)?`,
            default: false,
        });
        if (!confirmed) {
            process.stdout.write(`prune: aborted by user.\n`);
            return 0;
        }
    }

    let deleted = 0;
    for (const orphan of report.orphans) {
        const abs = join(shared.projectRoot, orphan.path);
        try {
            unlinkSync(abs);
            deleted += 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`prune: failed to delete ${orphan.path}: ${msg}\n`);
        }
    }
    renderOrphans({ ...report, orphans: report.orphans.slice(0, deleted) }, raw, /* deleted */ true);
    return 0;
}

function renderClean(report: PruneReport, raw: Record<string, unknown>): void {
    if (raw.json === true) {
        process.stdout.write(`${JSON.stringify({ status: 'clean', orphans: [], scanned: report.scanned, managed: report.managed })}\n`);
        return;
    }
    process.stdout.write(`prune: no orphans (${report.scanned} scanned, ${report.managed} managed)\n`);
}

function renderOrphans(report: PruneReport, raw: Record<string, unknown>, deleted: boolean): void {
    if (raw.json === true) {
        process.stdout.write(
            `${JSON.stringify({
                status: deleted ? 'deleted' : 'preview',
                orphans: report.orphans,
                scanned: report.scanned,
                managed: report.managed,
            })}\n`,
        );
        return;
    }
    const verb = deleted ? 'Deleted' : 'Would delete';
    process.stdout.write(`prune: ${verb} ${report.orphans.length} orphan(s) (${report.scanned} scanned, ${report.managed} managed)\n`);
    for (const o of report.orphans) {
        process.stdout.write(`  - ${o.path}\n`);
    }
}
