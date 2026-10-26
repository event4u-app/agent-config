/**
 * Where a root's graph, map and caches live (ADR-299, ADR-303).
 *
 * One folder per home. A root that has `agents/` or a project install keeps
 * everything under `<root>/agents/map/`: the map itself, and `.build/` for the
 * graph cache, its SQLite twin, the extracts sidecar, the refresh lock and the
 * auto-refresh opt-in — `.build/` being the only gitignored part. Every other
 * root gets a home in the machine-wide hub, `<user-global>/map/<repo id>-<checkout | instance>/`,
 * laid out the same way, so building a graph of somebody else's repository
 * writes nothing into it and two clones of one origin never share a cache, lock
 * or budget slot. Resolving never creates a directory.
 *
 * `cachePath`, `lockPath` and `autoRefreshPath` are what a reader opens: the
 * path in the current layout, or the one an older release wrote when only that
 * one exists. Writers use `buildCachePath`, which is always the current layout.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type EnvMap, event4u_root } from '../_lib/user_global_paths.js';
import { repoIdentity } from './repo_identity.js';

export const MAP_DIR_REL = path.join('agents', 'map');
export const BUILD_DIR_REL = path.join(MAP_DIR_REL, '.build');
export const NATIVE_CACHE_REL = path.join(BUILD_DIR_REL, 'code-graph-v1.json');
export const LOCK_REL = path.join(BUILD_DIR_REL, 'code-graph-refresh.lock');
/** Written by `code-graph auto-refresh on`; the session concern acts only while it exists. */
export const AUTO_REFRESH_REL = path.join(BUILD_DIR_REL, 'code-graph-auto-refresh.json');
/** The layout before ADR-303, read as a fallback for one release. */
export const LEGACY_STATE_DIR_REL = path.join('agents', 'runtime', 'state');

export interface GraphHome {
    kind: 'project' | 'global';
    root: string;
    /** `<root>/agents` for a project home, the per-repository hub directory otherwise. */
    dir: string;
    /** The gitignored part: graph cache, twin, sidecar, lock, opt-in, map staging. */
    buildDir: string;
    /** Where a reader finds the graph: the current file, else the pre-ADR-303 one when only that exists. */
    cachePath: string;
    /** Where a build writes the graph: always the current layout. */
    buildCachePath: string;
    mapDir: string;
    lockPath: string;
    autoRefreshPath: string;
    /** The directory an older release kept these files in. */
    legacyDir: string;
    repoId: string | null;
    instance: string | null;
}

/** The current path, unless only the pre-ADR-303 one exists. */
const pick = (now: string, old: string): string => (fs.existsSync(now) || !fs.existsSync(old) ? now : old);

function home(kind: GraphHome['kind'], root: string, dir: string, mapDir: string, legacyDir: string, id: string | null, inst: string | null): GraphHome {
    const buildDir = path.join(mapDir, '.build');
    const at = (rel: string): string => pick(path.join(buildDir, path.basename(rel)), path.join(legacyDir, path.basename(rel)));
    return {
        kind,
        root,
        dir,
        buildDir,
        cachePath: at(NATIVE_CACHE_REL),
        buildCachePath: path.join(buildDir, path.basename(NATIVE_CACHE_REL)),
        mapDir,
        lockPath: path.join(buildDir, path.basename(LOCK_REL)),
        autoRefreshPath: at(AUTO_REFRESH_REL),
        legacyDir,
        repoId: id,
        instance: inst,
    };
}

/** The machine-wide hub: the Projects map, the estate index and the homes of roots without their own. */
export function hubDir(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'map');
}

/** Per-repository homes sit directly in the hub, beside its own `index.html`, `projects/` and `.build/`. */
export function graphsRoot(env?: EnvMap | null): string {
    return hubDir(env);
}

/** What the hub keeps for itself beside the per-repository homes. */
export const HUB_OWN_ENTRIES: ReadonlySet<string> = new Set(['index.html', 'manifest.json', 'projects', '.build']);

/** Every per-repository home directory, in the hub and where an older release kept them. */
export function homeDirs(env?: EnvMap | null): string[] {
    const out: string[] = [];
    for (const base of [graphsRoot(env), legacyGraphsRoot(env)]) {
        let names: string[];
        try {
            names = fs.readdirSync(base);
        } catch {
            continue;
        }
        for (const name of names) {
            if (HUB_OWN_ENTRIES.has(name) || name.startsWith('.')) continue;
            const dir = path.join(base, name);
            try {
                if (fs.statSync(dir).isDirectory()) out.push(dir);
            } catch {
                /* gone between the listing and the stat */
            }
        }
    }
    return out;
}

/** True for a directory that is one per-repository home, new layout or old. */
export function isHomeDir(dir: string, env?: EnvMap | null): boolean {
    return [graphsRoot(env), legacyGraphsRoot(env)].some((base) => {
        const rel = path.relative(base, dir);
        return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && !rel.includes(path.sep) && !HUB_OWN_ENTRIES.has(rel) && !rel.startsWith('.');
    });
}

/** Where per-repository homes lived before ADR-303. */
export function legacyGraphsRoot(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'runtime', 'graphs');
}

/** `agents/` exists, or the installer's settings file marks a project install. */
export function hasProjectHome(root: string): boolean {
    return fs.existsSync(path.join(root, 'agents')) || fs.existsSync(path.join(root, '.agent-settings.yml'));
}

/** The graph cache a reader of a project home opens — `projectHome(root).cachePath`, without the rest. */
export function projectCachePath(root: string): string {
    return pick(path.join(root, NATIVE_CACHE_REL), path.join(root, LEGACY_STATE_DIR_REL, path.basename(NATIVE_CACHE_REL)));
}

/** What the session refresh concern reads of a project home, without the rest — its chunk has a byte ceiling. */
export function projectBuildPaths(root: string): Pick<GraphHome, 'buildDir' | 'cachePath' | 'lockPath' | 'autoRefreshPath'> {
    const b = path.join(root, BUILD_DIR_REL);
    const f = (n: string): string => pick(path.join(b, n), path.join(root, LEGACY_STATE_DIR_REL, n));
    return { buildDir: b, cachePath: f('code-graph-v1.json'), lockPath: path.join(b, 'code-graph-refresh.lock'), autoRefreshPath: f('code-graph-auto-refresh.json') };
}

/** The in-repository home; callers that serve project homes only use this alone. */
export function projectHome(root: string): GraphHome {
    return home('project', root, path.join(root, 'agents'), path.join(root, MAP_DIR_REL), path.join(root, LEGACY_STATE_DIR_REL), null, null);
}

export function graphHome(root: string, env?: EnvMap | null): GraphHome {
    if (hasProjectHome(root)) return projectHome(root);
    const id = repoIdentity(root, env);
    const name = `${id.repoId}-${id.instance ?? id.checkout}`;
    const dir = path.join(graphsRoot(env), name);
    return home('global', root, dir, dir, path.join(legacyGraphsRoot(env), name, 'state'), id.repoId, id.instance);
}
