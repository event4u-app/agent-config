/**
 * Sync planner — pulls new upstream into the consumer.
 *
 * Implements the merge decision matrix locked by ADR-016 § 3. The
 * planner is pure: it consumes the on-disk state (existing lockfile,
 * actual file hashes, optional overrides) plus a freshly-resolved
 * upstream install plan and emits a list of per-file actions. The
 * caller then renders the diff and, on confirmation, executes the
 * plan via the same atomic-write session the installer uses.
 *
 * The actions deliberately mirror the ADR-016 § 3 table rows so the
 * test suite can map one case per row.
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { artefactsForPacks } from './manifest-loader.js';
import { resolveArtefactPaths } from './paths.js';
import { sha256OfFileSync, sha256OfString } from './io/sha256.js';
import { openStaging } from './io/atomic-write.js';
import { LOCKFILE_NAME, lockfileToYaml } from './lockfile.js';
import type { ResolvedPack } from './resolver.js';
import type {
    DiscoveryManifest,
    Lockfile,
    LockfileFile,
    LockfilePack,
    OverridesFile,
} from './types.js';

/** Single ADR-016 § 3 row outcome. */
export type SyncAction =
    | { readonly kind: 'noop'; readonly path: string }
    | { readonly kind: 'update'; readonly path: string; readonly fromSha: string; readonly toSha: string; readonly pack: string }
    | { readonly kind: 'add'; readonly path: string; readonly toSha: string; readonly pack: string }
    | { readonly kind: 'remove'; readonly path: string; readonly fromSha: string }
    | { readonly kind: 'recreate'; readonly path: string; readonly toSha: string; readonly pack: string }
    | { readonly kind: 'shadowed-update'; readonly path: string; readonly fromSha: string; readonly toSha: string; readonly pack: string }
    | { readonly kind: 'drift-warn'; readonly path: string; readonly expected: string; readonly actual: string }
    | { readonly kind: 'conflict'; readonly path: string; readonly expected: string; readonly actual: string; readonly toSha: string; readonly pack: string }
    | { readonly kind: 'conflict-shadowed'; readonly path: string; readonly expected: string; readonly actual: string; readonly toSha: string; readonly pack: string };

export interface SyncPlan {
    readonly actions: readonly SyncAction[];
    readonly workspaces: readonly string[];
    readonly packs: readonly ResolvedPack[];
    /** Files that, after sync, will be tracked in the new lockfile. */
    readonly nextFiles: readonly UpstreamFile[];
    readonly hasConflicts: boolean;
    readonly hasDrift: boolean;
}

interface UpstreamFile {
    readonly destRelative: string;
    readonly sourceAbsolute: string;
    readonly pack: string;
    readonly content: string;
    readonly sha256: string;
}

export interface ComputeSyncPlanOptions {
    readonly manifest: DiscoveryManifest;
    readonly manifestSha256: string;
    readonly workspaces: readonly string[];
    readonly packs: readonly ResolvedPack[];
    readonly packageRoot: string;
    readonly projectRoot: string;
    readonly lockfile: Lockfile;
    readonly overrides: OverridesFile;
}

/**
 * Build the action list for `sync`. Pure: no disk writes, no
 * lockfile mutation. The caller decides whether to materialize.
 */
export function computeSyncPlan(opts: ComputeSyncPlanOptions): SyncPlan {
    const upstream = buildUpstreamFiles(opts);
    const upstreamByPath = new Map<string, UpstreamFile>();
    for (const u of upstream) upstreamByPath.set(u.destRelative, u);

    const lockByPath = new Map<string, LockfileFile>();
    for (const f of opts.lockfile.files) lockByPath.set(f.path, f);

    const overrideShadows = new Set(opts.overrides.overrides.map((o) => o.shadows));

    const actions: SyncAction[] = [];
    let hasConflicts = false;
    let hasDrift = false;

    // Existing files: noop / update / remove / drift / conflict.
    for (const [path, locked] of lockByPath) {
        const abs = join(opts.projectRoot, path);
        const actual = existsSync(abs) ? sha256OfFileSync(abs) : undefined;
        const next = upstreamByPath.get(path);
        const shadowed = overrideShadows.has(path);
        if (actual === undefined) {
            if (next === undefined) {
                actions.push({ kind: 'remove', path, fromSha: locked.sha256 });
            } else {
                actions.push({ kind: 'recreate', path, toSha: next.sha256, pack: next.pack });
            }
            continue;
        }
        if (actual === locked.sha256) {
            // Clean (no drift).
            if (next === undefined) {
                actions.push({ kind: 'remove', path, fromSha: locked.sha256 });
            } else if (next.sha256 === locked.sha256) {
                actions.push({ kind: 'noop', path });
            } else if (shadowed) {
                actions.push({ kind: 'shadowed-update', path, fromSha: locked.sha256, toSha: next.sha256, pack: next.pack });
            } else {
                actions.push({ kind: 'update', path, fromSha: locked.sha256, toSha: next.sha256, pack: next.pack });
            }
        } else {
            // Drift: disk does not match lockfile.
            hasDrift = true;
            if (next === undefined || next.sha256 === locked.sha256) {
                actions.push({ kind: 'drift-warn', path, expected: locked.sha256, actual });
            } else if (shadowed) {
                actions.push({ kind: 'conflict-shadowed', path, expected: locked.sha256, actual, toSha: next.sha256, pack: next.pack });
                hasConflicts = true;
            } else {
                actions.push({ kind: 'conflict', path, expected: locked.sha256, actual, toSha: next.sha256, pack: next.pack });
                hasConflicts = true;
            }
        }
    }

    // New files upstream that are not in the lockfile.
    for (const [path, next] of upstreamByPath) {
        if (lockByPath.has(path)) continue;
        actions.push({ kind: 'add', path, toSha: next.sha256, pack: next.pack });
    }

    actions.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const nextFiles = upstream.slice().sort((a, b) => (a.destRelative < b.destRelative ? -1 : a.destRelative > b.destRelative ? 1 : 0));
    return {
        actions,
        workspaces: [...opts.workspaces],
        packs: opts.packs,
        nextFiles,
        hasConflicts,
        hasDrift,
    };
}

function buildUpstreamFiles(opts: ComputeSyncPlanOptions): readonly UpstreamFile[] {
    const ids = opts.packs.map((p) => p.id);
    const artefacts = artefactsForPacks(opts.manifest, ids);
    const selectedSet = new Set(ids);
    const out: UpstreamFile[] = [];
    for (const a of artefacts) {
        const pack = a.packs.find((p) => selectedSet.has(p));
        if (pack === undefined) continue;
        const paths = resolveArtefactPaths(opts.packageRoot, opts.projectRoot, a.path);
        const content = readFileSync(paths.sourceAbsolute, 'utf8');
        out.push({
            destRelative: paths.destRelative,
            sourceAbsolute: paths.sourceAbsolute,
            pack,
            content,
            sha256: sha256OfString(content),
        });
    }
    return out;
}

export interface ExecuteSyncOptions {
    readonly plan: SyncPlan;
    readonly projectRoot: string;
    readonly manifestSha256: string;
    readonly agentConfigVersion: string;
    readonly packVersion: string;
    readonly force?: boolean;
    readonly now?: () => string;
    readonly dryRun?: boolean;
}

export interface ExecuteSyncResult {
    readonly lockfile: Lockfile;
    readonly filesUpdated: number;
    readonly filesAdded: number;
    readonly filesRemoved: number;
    readonly filesRecreated: number;
    readonly filesUnchanged: number;
    readonly conflicts: number;
    readonly driftWarnings: number;
    readonly shadowed: number;
    readonly lockfileRelative: string;
}

/**
 * Materialize the sync plan via the atomic staging session.
 *
 * Conflicts hard-fail unless `--force` is set. Drift-warn rows do
 * not block (the disk diverged but the upstream matches the lock,
 * so the user already authored what we would have written).
 * Shadowed paths are still written to `.augment/`; the user's
 * shadow in `agents/overrides/` continues to win at read time.
 */
export function executeSyncPlan(opts: ExecuteSyncOptions): ExecuteSyncResult {
    const now = opts.now ?? (() => new Date().toISOString());
    if (opts.plan.hasConflicts && opts.force !== true) {
        throw new SyncConflictError(opts.plan.actions.filter((a) => a.kind === 'conflict' || a.kind === 'conflict-shadowed') as SyncAction[]);
    }

    const session = openStaging({ projectRoot: opts.projectRoot });
    const lockfileFiles: LockfileFile[] = [];
    let updated = 0;
    let added = 0;
    let removed = 0;
    let recreated = 0;
    let unchanged = 0;
    let conflicts = 0;
    let driftWarnings = 0;
    let shadowed = 0;
    try {
        const byPathUpstream = new Map<string, UpstreamFile>();
        for (const u of opts.plan.nextFiles) byPathUpstream.set(u.destRelative, u);

        for (const action of opts.plan.actions) {
            switch (action.kind) {
                case 'noop':
                    unchanged += 1;
                    break;
                case 'add': {
                    const next = byPathUpstream.get(action.path);
                    if (next !== undefined) session.stage(next.destRelative, next.content);
                    added += 1;
                    break;
                }
                case 'update': {
                    const next = byPathUpstream.get(action.path);
                    if (next !== undefined) session.stage(next.destRelative, next.content);
                    updated += 1;
                    break;
                }
                case 'recreate': {
                    const next = byPathUpstream.get(action.path);
                    if (next !== undefined) session.stage(next.destRelative, next.content);
                    recreated += 1;
                    break;
                }
                case 'shadowed-update': {
                    const next = byPathUpstream.get(action.path);
                    if (next !== undefined) session.stage(next.destRelative, next.content);
                    shadowed += 1;
                    updated += 1;
                    break;
                }
                case 'remove':
                    removed += 1;
                    break;
                case 'drift-warn':
                    driftWarnings += 1;
                    break;
                case 'conflict':
                case 'conflict-shadowed': {
                    // Only reachable when force=true; treat as forced update.
                    const next = byPathUpstream.get(action.path);
                    if (next !== undefined) session.stage(next.destRelative, next.content);
                    conflicts += 1;
                    updated += 1;
                    break;
                }
            }
        }

        for (const u of opts.plan.nextFiles) {
            lockfileFiles.push({
                path: u.destRelative,
                pack: u.pack,
                pack_version: opts.packVersion,
                sha256: u.sha256,
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
            // Physically remove orphans + drift-warn never delete user-edited files.
            removeOrphans(opts.projectRoot, opts.plan.actions);
        } else {
            session.abort();
        }

        return {
            lockfile,
            filesUpdated: updated,
            filesAdded: added,
            filesRemoved: removed,
            filesRecreated: recreated,
            filesUnchanged: unchanged,
            conflicts,
            driftWarnings,
            shadowed,
            lockfileRelative: LOCKFILE_NAME,
        };
    } catch (err) {
        session.abort();
        throw err;
    }
}

function removeOrphans(projectRoot: string, actions: readonly SyncAction[]): void {
    for (const a of actions) {
        if (a.kind !== 'remove') continue;
        const abs = join(projectRoot, a.path);
        if (existsSync(abs)) {
            try { unlinkSync(abs); } catch { /* best-effort */ }
        }
    }
}

export class SyncConflictError extends Error {
    public readonly conflicts: readonly SyncAction[];
    public constructor(conflicts: readonly SyncAction[]) {
        super(`sync: ${conflicts.length} unresolved conflict(s); rerun with --force or resolve manually`);
        this.name = 'SyncConflictError';
        this.conflicts = conflicts;
    }
}
