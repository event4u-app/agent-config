/**
 * Atomic-write helpers for the installer.
 *
 * Per ADR-016 § 5, every command that mutates `.augment/`, `.agent-src/`,
 * or the lockfile stages changes under
 * `.augment/.agent-config-staging/<uuid>/` and then commits via
 * per-file `fs.renameSync` (atomic on POSIX and Windows ≥ 10). The
 * lockfile is written **last** so a mid-flight crash leaves the
 * lockfile pointing at the previous-good state.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface StagedWrite {
    readonly stagingPath: string;
    readonly targetPath: string;
}

export interface StagingSession {
    readonly id: string;
    readonly root: string;
    readonly stage: (relTarget: string, content: string | Buffer) => StagedWrite;
    readonly commit: () => void;
    readonly abort: () => void;
}

export interface OpenStagingOptions {
    /** Project root (where `.augment/` lives). */
    readonly projectRoot: string;
    /** Override staging dir (tests). Default: `<projectRoot>/.augment/.agent-config-staging`. */
    readonly stagingDir?: string;
}

/**
 * Open a staging session. Returned `stage()` writes into staging;
 * `commit()` performs per-file atomic renames into the project tree;
 * `abort()` removes the staging dir without touching the project.
 */
export function openStaging(opts: OpenStagingOptions): StagingSession {
    const id = randomUUID();
    const baseDir = opts.stagingDir ?? join(opts.projectRoot, '.augment', '.agent-config-staging');
    const root = join(baseDir, id);
    mkdirSync(root, { recursive: true });

    const writes: StagedWrite[] = [];

    const stage = (relTarget: string, content: string | Buffer): StagedWrite => {
        const stagingPath = join(root, relTarget);
        const targetPath = join(opts.projectRoot, relTarget);
        mkdirSync(dirname(stagingPath), { recursive: true });
        writeFileSync(stagingPath, content);
        const entry: StagedWrite = { stagingPath, targetPath };
        writes.push(entry);
        return entry;
    };

    const commit = (): void => {
        // Per-file rename — atomic at the per-file level on POSIX/Windows ≥ 10.
        // The lockfile MUST be the last entry passed to `stage()` so it lands last.
        for (const w of writes) {
            mkdirSync(dirname(w.targetPath), { recursive: true });
            renameSync(w.stagingPath, w.targetPath);
        }
        try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    };

    const abort = (): void => {
        try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    };

    return { id, root, stage, commit, abort };
}

/**
 * Resolve a target path relative to project root (POSIX-style).
 * Throws if `target` escapes `projectRoot` — defence against pack
 * authors using `..` in artefact paths.
 */
export function ensureWithinRoot(projectRoot: string, target: string): string {
    const rel = relative(projectRoot, join(projectRoot, target));
    if (rel.startsWith('..') || rel.includes(`..${'/'}`) || rel.includes(`..${'\\'}`)) {
        throw new Error(`refusing to write outside project root: ${target}`);
    }
    return rel;
}
