/**
 * Install-plan computation and execution.
 *
 * - `computeInstallPlan` is pure: given a manifest, a resolved pack
 *   set, and root paths, it returns the list of source→dest file moves
 *   and the lockfile shape that will be written.
 * - `executeInstallPlan` performs the I/O: it stages every file under
 *   `.augment/.agent-config-staging/<uuid>/`, computes per-file sha256,
 *   and commits via the atomic-write session. The lockfile is staged
 *   last so a mid-flight crash leaves the previous lockfile intact
 *   (ADR-016 § 5).
 */

import { readFileSync } from 'node:fs';
import { artefactsForPacks } from './manifest-loader.js';
import { resolveArtefactPaths } from './paths.js';
import { sha256OfString } from './io/sha256.js';
import { openStaging } from './io/atomic-write.js';
import { LOCKFILE_NAME, lockfileToYaml } from './lockfile.js';
import type { ResolvedPack } from './resolver.js';
import type {
    DiscoveryManifest,
    Lockfile,
    LockfileFile,
    LockfilePack,
} from './types.js';

export interface PlanFile {
    readonly manifestPath: string;
    readonly sourceAbsolute: string;
    readonly destRelative: string;
    readonly destAbsolute: string;
    readonly pack: string;
}

export interface InstallPlan {
    readonly workspaces: readonly string[];
    readonly packs: readonly ResolvedPack[];
    readonly files: readonly PlanFile[];
}

export interface ComputePlanOptions {
    readonly manifest: DiscoveryManifest;
    readonly workspaces: readonly string[];
    readonly packs: readonly ResolvedPack[];
    readonly packageRoot: string;
    readonly projectRoot: string;
}

/**
 * Build the per-file deployment list. Deterministic: files are sorted
 * by `manifestPath` to match the manifest order, so a re-run on the
 * same inputs produces an identical lockfile.
 */
export function computeInstallPlan(opts: ComputePlanOptions): InstallPlan {
    const ids = opts.packs.map((p) => p.id);
    const artefacts = artefactsForPacks(opts.manifest, ids);

    const packForArtefact = new Map<string, string>();
    const selectedSet = new Set(ids);
    for (const a of artefacts) {
        const first = a.packs.find((p) => selectedSet.has(p));
        if (first !== undefined) packForArtefact.set(a.path, first);
    }

    const files: PlanFile[] = [];
    for (const a of artefacts) {
        const pack = packForArtefact.get(a.path);
        if (pack === undefined) continue;
        const paths = resolveArtefactPaths(opts.packageRoot, opts.projectRoot, a.path);
        files.push({
            manifestPath: a.path,
            sourceAbsolute: paths.sourceAbsolute,
            destRelative: paths.destRelative,
            destAbsolute: paths.destAbsolute,
            pack,
        });
    }
    files.sort((a, b) => (a.destRelative < b.destRelative ? -1 : a.destRelative > b.destRelative ? 1 : 0));
    return { workspaces: [...opts.workspaces], packs: opts.packs, files };
}

export interface ExecutePlanOptions {
    readonly plan: InstallPlan;
    readonly projectRoot: string;
    readonly manifestSha256: string;
    readonly agentConfigVersion: string;
    readonly packVersion: string;
    /** Override the clock in tests. ISO 8601 UTC. */
    readonly now?: () => string;
    /** Skip the on-disk commit (dry run). */
    readonly dryRun?: boolean;
}

export interface ExecuteResult {
    readonly lockfile: Lockfile;
    readonly filesWritten: number;
    readonly lockfileRelative: string;
}

/**
 * Stage and commit the install plan. On success the consumer's
 * `.augment/` tree mirrors the selected packs and a fresh lockfile
 * is written. The lockfile is staged last so it always reflects the
 * files that actually landed (ADR-016 § 5).
 */
export function executeInstallPlan(opts: ExecutePlanOptions): ExecuteResult {
    const now = opts.now ?? (() => new Date().toISOString());
    const session = openStaging({ projectRoot: opts.projectRoot });
    const lockfileFiles: LockfileFile[] = [];
    try {
        for (const file of opts.plan.files) {
            const content = readFileSync(file.sourceAbsolute);
            session.stage(file.destRelative, content);
            lockfileFiles.push({
                path: file.destRelative,
                pack: file.pack,
                pack_version: opts.packVersion,
                sha256: sha256OfString(content.toString('utf8')),
                manifest_sha256: opts.manifestSha256,
                managed: true,
            });
        }
        const lockfilePacks: LockfilePack[] = opts.plan.packs.map((p) => ({
            id: p.id,
            version: opts.packVersion,
            auto_selected: p.autoSelected,
            required_by: p.requiredBy,
        }));
        const lockfile: Lockfile = {
            schema_version: 1,
            agent_config_version: opts.agentConfigVersion,
            manifest_sha256: opts.manifestSha256,
            generated_at: now(),
            workspaces: opts.plan.workspaces,
            packs: lockfilePacks,
            files: lockfileFiles,
        };
        if (opts.dryRun !== true) {
            session.stage(LOCKFILE_NAME, lockfileToYaml(lockfile));
            session.commit();
        } else {
            session.abort();
        }
        return { lockfile, filesWritten: lockfileFiles.length, lockfileRelative: LOCKFILE_NAME };
    } catch (err) {
        session.abort();
        throw err;
    }
}
