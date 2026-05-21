/**
 * `sync` command — pull upstream changes via the ADR-016 § 3 merge matrix.
 *
 * Resolves the same workspaces + packs the lockfile recorded, rebuilds
 * the upstream plan from the current discovery manifest, then emits the
 * per-file action list. On hard conflict, exits non-zero unless --force
 * is set. On clean run, materializes via the atomic-write session and
 * rewrites the lockfile.
 *
 * Exit codes:
 *   0 — clean sync (or dry-run preview)
 *   2 — operator error (no lockfile, no manifest, agent mode)
 *   5 — conflicts present without --force
 */

import { dirname, join } from 'node:path';
import { LOCKFILE_NAME, OVERRIDES_NAME, readLockfile, readOverrides } from '../lockfile.js';
import { loadManifest, ManifestNotFoundError } from '../manifest-loader.js';
import { resolvePacks } from '../resolver.js';
import {
    SyncConflictError,
    computeSyncPlan,
    executeSyncPlan,
    type SyncAction,
    type SyncPlan,
} from '../sync.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import type { SharedFlags } from '../cli.js';

export interface SyncOptions {
    readonly force?: boolean;
}

export async function runSync(shared: SharedFlags, raw: Record<string, unknown>): Promise<number> {
    if (shared.mode === 'agent') {
        process.stderr.write(`sync: agent mode not supported on this command.\n`);
        return 2;
    }
    const force = raw.force === true;

    const lockPath = join(shared.projectRoot, LOCKFILE_NAME);
    const lock = readLockfile(lockPath);
    if (lock === undefined) {
        process.stderr.write(
            `sync: no lockfile at ${lockPath}. Run \`agent-config-installer init\` first.\n`,
        );
        return 2;
    }
    const overrides = readOverrides(join(shared.projectRoot, OVERRIDES_NAME));

    let loaded;
    try {
        loaded = loadManifest({
            searchFrom: shared.projectRoot,
            ...(shared.manifestPath !== undefined ? { path: shared.manifestPath } : {}),
        });
    } catch (err) {
        if (err instanceof ManifestNotFoundError) {
            process.stderr.write(
                `sync: discovery manifest not found.\n` +
                `Looked for dist/discovery/discovery-manifest.json under ${shared.projectRoot}.\n`,
            );
            return 2;
        }
        throw err;
    }
    const packageRoot = dirname(dirname(dirname(loaded.path)));

    const resolved = resolvePacks(loaded.manifest, lock.packs.map((p) => p.id));
    if (resolved.missing.length > 0) {
        process.stderr.write(
            `sync: lockfile references packs no longer in the manifest: ${resolved.missing.join(', ')}\n`,
        );
        return 2;
    }

    const plan = computeSyncPlan({
        manifest: loaded.manifest,
        manifestSha256: loaded.sha256,
        workspaces: lock.workspaces,
        packs: resolved.packs,
        packageRoot,
        projectRoot: shared.projectRoot,
        lockfile: lock,
        overrides,
    });

    if (raw.json === true) {
        process.stdout.write(`${JSON.stringify({ plan: summarizePlan(plan) })}\n`);
    } else {
        renderPlan(plan);
    }

    if (shared.dryRun) return plan.hasConflicts && !force ? 5 : 0;

    try {
        const result = executeSyncPlan({
            plan,
            projectRoot: shared.projectRoot,
            manifestSha256: loaded.sha256,
            agentConfigVersion: AGENT_CONFIG_VERSION,
            packVersion: PACK_VERSION,
            ...(force ? { force: true } : {}),
        });
        process.stdout.write(
            `sync: ${result.filesAdded} added, ${result.filesUpdated} updated, ` +
            `${result.filesRemoved} removed, ${result.filesRecreated} recreated, ` +
            `${result.filesUnchanged} unchanged` +
            (result.driftWarnings > 0 ? `, ${result.driftWarnings} drift-warn` : '') +
            (result.conflicts > 0 ? `, ${result.conflicts} forced-overwrite` : '') +
            `\n`,
        );
        return 0;
    } catch (err) {
        if (err instanceof SyncConflictError) {
            process.stderr.write(`sync: ${err.message}\n`);
            return 5;
        }
        throw err;
    }
}

function summarizePlan(plan: SyncPlan): Record<string, unknown> {
    const counts: Record<string, number> = {};
    for (const a of plan.actions) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
    return {
        actions: plan.actions,
        counts,
        has_conflicts: plan.hasConflicts,
        has_drift: plan.hasDrift,
        workspaces: plan.workspaces,
        packs: plan.packs.map((p) => p.id),
    };
}

function renderPlan(plan: SyncPlan): void {
    const out = process.stdout;
    const counts: Record<string, number> = {};
    for (const a of plan.actions) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
    out.write(`sync: ${plan.actions.length} action(s)\n`);
    for (const [kind, n] of Object.entries(counts)) out.write(`  ${kind}: ${n}\n`);
    const interesting: readonly SyncAction['kind'][] = ['conflict', 'conflict-shadowed', 'drift-warn', 'add', 'remove', 'update', 'recreate', 'shadowed-update'];
    for (const kind of interesting) {
        const rows = plan.actions.filter((a) => a.kind === kind);
        if (rows.length === 0) continue;
        out.write(`\n  ${kind}:\n`);
        for (const r of rows) out.write(`    - ${r.path}\n`);
    }
    if (plan.hasConflicts) out.write(`\nsync: conflicts present; pass --force to overwrite.\n`);
}
