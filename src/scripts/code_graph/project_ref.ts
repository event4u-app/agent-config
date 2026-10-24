/**
 * Turn a `project` argument — a repo id, a registered name or a registered
 * path — into the root a graph verb runs against (ADR-299, step 5.1). Only a
 * registered project resolves: an MCP caller cannot point a tool at an
 * arbitrary directory, only at one the owner already worked in. A name two
 * registered projects share is refused with both candidates, never guessed.
 */
import { findProjects, readRegistry } from '../_lib/project_registry.js';

export type ProjectRef = { root: string } | { error: string; candidates: string[] };

export function resolveProjectRef(ref: string): ProjectRef {
    const reg = readRegistry();
    const hits = findProjects(reg, ref);
    if (hits.length === 1) return { root: (hits[0] as [string, { root: string }])[1].root };
    if (hits.length > 1) {
        return { error: `'${ref}' names ${hits.length} registered projects — pass an id`, candidates: hits.map(([id, e]) => `${id} ${e.root}`) };
    }
    return {
        error: `no registered project matches '${ref}' — \`code-graph projects list\` shows them`,
        candidates: Object.entries(reg.projects)
            .slice(0, 10)
            .map(([id, e]) => `${id} ${e.root}`),
    };
}
