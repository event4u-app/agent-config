/**
 * Orphan detection inside `.augment/` and `.agent-src/`.
 *
 * `runPrune` walks the consumer's managed trees and returns every
 * file that is not in the lockfile, so the caller can render a
 * preview and (optionally) delete. The staging dir
 * `.augment/.agent-config-staging/` is excluded — it is implementation
 * detail and never managed via the manifest.
 *
 * Pure listing; the actual `unlink` happens in the command wrapper.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Lockfile } from './types.js';

/** Top-level dirs the installer is allowed to touch. */
export const MANAGED_ROOTS: readonly string[] = ['.augment', '.agent-src'];

/** Subpaths inside managed roots that must never be enumerated. */
export const PRUNE_EXCLUDES: readonly string[] = [
    '.augment/.agent-config-staging',
];

export interface OrphanFile {
    readonly path: string;
    readonly root: string;
}

export interface PruneReport {
    readonly orphans: readonly OrphanFile[];
    readonly managed: number;
    readonly scanned: number;
}

export interface RunPruneOptions {
    readonly lockfile: Lockfile;
    readonly projectRoot: string;
}

export function runPrune(opts: RunPruneOptions): PruneReport {
    const managedSet = new Set(opts.lockfile.files.map((f) => f.path));
    const orphans: OrphanFile[] = [];
    let scanned = 0;
    for (const root of MANAGED_ROOTS) {
        const abs = join(opts.projectRoot, root);
        if (!existsSync(abs)) continue;
        const found = listFilesRelative(abs, opts.projectRoot);
        for (const rel of found) {
            const posix = rel.split(sep).join('/');
            if (PRUNE_EXCLUDES.some((p) => posix === p || posix.startsWith(`${p}/`))) continue;
            scanned += 1;
            if (!managedSet.has(posix)) {
                orphans.push({ path: posix, root });
            }
        }
    }
    orphans.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { orphans, managed: managedSet.size, scanned };
}

function listFilesRelative(absRoot: string, projectRoot: string): readonly string[] {
    const out: string[] = [];
    const stack: string[] = [absRoot];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: import('node:fs').Dirent[];
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const abs = join(dir, e.name);
            if (e.isDirectory()) {
                stack.push(abs);
            } else if (e.isFile()) {
                out.push(relative(projectRoot, abs));
            }
        }
    }
    return out;
}
