/** Argument and root handling the code-graph CLI verbs share. */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolve_project_root } from '../_lib/agent_settings.js';
import { graphHome } from './graph_home.js';
import { resolveProjectRef } from './project_ref.js';

/**
 * The cache belongs to the project it describes: `<root>/agents/map/.build/`
 * when the root has a project home, its home in the user-global hub otherwise
 * (ADR-299) — the path MCP, the context hook and `detect` read. Anchoring it to
 * the package tree put a consumer's graph inside `node_modules`, where `npm ci`
 * deleted it, two projects sharing an install overwrote each other, and MCP
 * answered "no graph" right after the CLI reported a fresh one.
 */
export function cacheFor(root: string): string {
    return graphHome(root).cachePath;
}
/** Where a build of `root` writes its graph: always the current layout, never the pre-ADR-303 path a reader falls back to. */
export function buildCacheFor(root: string): string {
    return graphHome(root).buildCachePath;
}
/** A path relative to the root when it lies inside it; a graph home outside the root prints in full. */
export function shown(root: string, p: string): string {
    const rel = path.relative(root, p);
    return rel.startsWith('..') || path.isAbsolute(rel) ? p : rel;
}

/** A refusal that names what the caller asked for wrongly; exits 1, not 3. */
export class UsageError extends Error {}

export function flag(argv: string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

/**
 * Resolve the repository to operate on: `--root` > the shared project-root
 * resolver (`AGENT_CONFIG_PROJECT_ROOT`, then the anchor walk from `cwd`, then
 * `cwd`). The package tree is never a fallback — in a consumer it is
 * `node_modules/@event4u/agent-config`, and indexing it answered every
 * question about the wrong repository.
 *
 * `realpathSync` rather than `resolve` alone: a symlinked root must normalise to
 * what will actually be walked. A root that does not exist is returned
 * unresolved, so the caller's existence check prints the path it was given.
 */
export function resolveRoot(argv: string[]): string {
    const explicit = flag(argv, '--root');
    const project = flag(argv, '--project');
    let candidate: string;
    if (project !== null) {
        const r = resolveProjectRef(project);
        if ('error' in r) throw new UsageError(r.error);
        candidate = r.root;
    } else if (explicit !== null) {
        candidate = explicit;
    } else {
        try {
            candidate = resolve_project_root(null)[0];
        } catch {
            candidate = process.env['AGENT_CONFIG_PROJECT_ROOT'] ?? process.cwd();
        }
    }
    try {
        return fs.realpathSync(path.resolve(candidate));
    } catch {
        return path.resolve(candidate);
    }
}

export function isFlagValue(argv: string[], token: string): boolean {
    const i = argv.indexOf(token);
    return i > 0 && (argv[i - 1] as string).startsWith('--');
}
