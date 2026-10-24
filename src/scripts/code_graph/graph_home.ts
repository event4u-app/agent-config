/**
 * Where a root's graph, map and refresh lock live (ADR-299).
 *
 * A root that has `agents/` or a project install keeps today's paths under
 * `<root>/agents/`, byte-identical, so a map shared through the repository is
 * unchanged. Every other root gets a home under the user-global
 * `runtime/graphs/<repo id>[-<instance>]/`, so building a graph of somebody
 * else's repository writes nothing into it. Resolving never creates `agents/`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type EnvMap, event4u_root } from '../_lib/user_global_paths.js';
import { repoIdentity } from './repo_identity.js';

export const STATE_DIR_REL = path.join('agents', 'runtime', 'state');
export const NATIVE_CACHE_REL = path.join(STATE_DIR_REL, 'code-graph-v1.json');
export const MAP_DIR_REL = path.join('agents', 'map');
export const LOCK_REL = path.join(STATE_DIR_REL, 'code-graph-refresh.lock');
/** Written by `code-graph auto-refresh on`; the session concern acts only while it exists. */
export const AUTO_REFRESH_REL = path.join(STATE_DIR_REL, 'code-graph-auto-refresh.json');

export interface GraphHome {
    kind: 'project' | 'global';
    root: string;
    /** `<root>/agents` for a project home, the per-repository directory otherwise. */
    dir: string;
    stateDir: string;
    cachePath: string;
    mapDir: string;
    lockPath: string;
    autoRefreshPath: string;
    repoId: string | null;
    instance: string | null;
}

export function graphsRoot(env?: EnvMap | null): string {
    return path.join(event4u_root(env), 'runtime', 'graphs');
}

/** `agents/` exists, or the installer's settings file marks a project install. */
export function hasProjectHome(root: string): boolean {
    return fs.existsSync(path.join(root, 'agents')) || fs.existsSync(path.join(root, '.agent-settings.yml'));
}

/** Today's in-repository paths; callers that serve project homes only use this alone. */
export function projectHome(root: string): GraphHome {
    return {
        kind: 'project',
        root,
        dir: path.join(root, 'agents'),
        stateDir: path.join(root, STATE_DIR_REL),
        cachePath: path.join(root, NATIVE_CACHE_REL),
        mapDir: path.join(root, MAP_DIR_REL),
        lockPath: path.join(root, LOCK_REL),
        autoRefreshPath: path.join(root, AUTO_REFRESH_REL),
        repoId: null,
        instance: null,
    };
}

export function graphHome(root: string, env?: EnvMap | null): GraphHome {
    if (hasProjectHome(root)) return projectHome(root);
    const id = repoIdentity(root, env);
    const dir = path.join(graphsRoot(env), id.instance === null ? id.repoId : `${id.repoId}-${id.instance}`);
    const stateDir = path.join(dir, 'state');
    return {
        kind: 'global',
        root,
        dir,
        stateDir,
        cachePath: path.join(stateDir, path.basename(NATIVE_CACHE_REL)),
        mapDir: path.join(dir, 'map'),
        lockPath: path.join(stateDir, path.basename(LOCK_REL)),
        autoRefreshPath: path.join(stateDir, path.basename(AUTO_REFRESH_REL)),
        repoId: id.repoId,
        instance: id.instance,
    };
}
