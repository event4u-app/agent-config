/**
 * The unclaimed-file scan under this package's own deploy roots.
 *
 * Moved verbatim out of `src/scripts/_cli/cmd_doctor.ts`
 * (road-to-a-tree-that-keeps-its-neighbours Phase 2.6). The behaviour is
 * unchanged — this is a module boundary, not a rewrite.
 *
 * Two reasons it earns its own file. `cmd_doctor.ts` is 2,100 lines above the
 * `check_source_size_budget` ceiling, so the census line that now links this
 * listing is paid for by a MOVE rather than by raising the tree-wide excess.
 * And the neighbour census answers a strictly larger question than this scan
 * does — this one lists FILES under paths this package deploys to, the census
 * lists ARTEFACTS wherever a host keeps them — so the two belong beside each
 * other rather than nested inside a doctor renderer.
 *
 * What this scan does NOT do, stated because the two listings look alike: it
 * never leaves a deploy root, so a neighbour's skill in `~/.claude/skills` or
 * hook entry in `.cursor/hooks.json` is invisible to it. That gap is the
 * census's subject, and the census links back here rather than repeating the
 * paths this one already prints.
 */

import * as fs from 'node:fs';

/**
 * `Path.rglob("*")` — every descendant path (dirs + files), recursively.
 *
 * Order is not relied upon by callers (they sort the matched set), but the
 * walk is deterministic (sorted per directory) to keep behaviour stable.
 */
export function rglob(root: string, isDir: (p: string) => boolean, join: (a: string, b: string) => string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const ent of entries) {
            const full = join(dir, ent.name);
            out.push(full);
            let dirLike = ent.isDirectory();
            if (ent.isSymbolicLink()) {
                // pathlib rglob follows into symlinked dirs.
                dirLike = isDir(full);
            }
            if (dirLike) {
                walk(full);
            }
        }
    };
    walk(root);
    return out;
}

export interface ForeignScanDeps {
    pathExists: (p: string) => boolean;
    isDir: (p: string) => boolean;
    isFile: (p: string) => boolean;
    resolvePath: (p: string) => string;
    join: (a: string, b: string) => string;
    /** Resolve one declared deploy root against the consumer root. */
    resolveRoot: (projectRoot: string, rel: string) => string;
    defaultRoots: readonly string[];
}

/**
 * Walk every declared deploy root and surface unclaimed files. Only regular
 * files under `deploy_roots` count; bookkeeping is on the resolved final path.
 */
export function scanForeign(
    projectRoot: string,
    manifest: Record<string, unknown>,
    known: Set<string>,
    deps: ForeignScanDeps,
): string[] {
    const roots = (manifest['deploy_roots'] as unknown[] | undefined) || Array.from(deps.defaultRoots);
    const foreign: string[] = [];
    const seen = new Set<string>();
    for (const root_rel of roots) {
        const root = deps.resolveRoot(projectRoot, String(root_rel));
        if (!deps.pathExists(root) || !deps.isDir(root)) {
            continue;
        }
        for (const child of rglob(root, deps.isDir, deps.join)) {
            if (!deps.isFile(child)) {
                continue;
            }
            let resolved: string;
            try {
                resolved = deps.resolvePath(child);
            } catch {
                resolved = child;
            }
            if (known.has(resolved) || seen.has(resolved)) {
                continue;
            }
            seen.add(resolved);
            foreign.push(child);
        }
    }
    foreign.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return foreign;
}
