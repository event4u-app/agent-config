/**
 * `code-graph projects …` — the registry of projects this machine works in
 * (ADR-299). A project is added by use (a build or refresh calls
 * {@link registerUse}) or by hand with `add`; nothing here walks a directory
 * tree looking for repositories.
 *
 *   projects list                       every entry; a root missing for 30 days is flagged
 *   projects add <path>                 register a project by hand
 *   projects remove <id|name|path>      drop one entry and its user-global graph homes
 *   projects prune                      drop the flagged entries
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { findProjects, type ProjectEntry, readRegistry, recordProject, updateRegistry } from '../_lib/project_registry.js';
import { graphHome, graphsRoot } from './graph_home.js';
import type { CodeGraph } from './types.js';

/** A root missing this long is flagged by `list` and removed by `prune` (6.2). */
export const STALE_ROOT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RootState = 'present' | 'missing' | 'stale';

export function rootState(e: ProjectEntry, now: Date = new Date()): RootState {
    if (fs.existsSync(e.root)) return 'present';
    return now.getTime() - Date.parse(e.last_seen) >= STALE_ROOT_DAYS * DAY_MS ? 'stale' : 'missing';
}

/**
 * Record that `root`'s graph was just built or refreshed. Best-effort: the
 * registry is bookkeeping, and a failure to write it never fails a build.
 */
export function registerUse(root: string, graph: CodeGraph | null, commit: string | null): string | null {
    try {
        const home = graphHome(root);
        return recordProject(root, {
            graph_home: home.dir,
            ...(commit ? { graph_commit: commit } : {}),
            ...(graph ? { languages: [...graph.languages], providers: (graph.providers ?? []).map((p) => p.id) } : {}),
            ...(home.kind === 'global' ? { usedHome: home.dir } : {}),
        });
    } catch {
        return null;
    }
}

/** User-global homes are removable caches; a home under a repository's own `agents/` never is. */
function removeGlobalHomes(e: ProjectEntry): string[] {
    const base = graphsRoot();
    const removed: string[] = [];
    for (const dir of new Set([...Object.keys(e.homes), ...(e.graph_home ? [e.graph_home] : [])])) {
        const rel = path.relative(base, dir);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) continue;
        fs.rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
    }
    return removed;
}

function cmdList(): number {
    const reg = readRegistry();
    const rows = Object.entries(reg.projects);
    if (!rows.length) {
        process.stdout.write('no registered projects — a `code-graph build` or `code-graph projects add <path>` registers one\n');
        return 0;
    }
    for (const [id, e] of rows) {
        const state = rootState(e);
        const flag = state === 'stale' ? ` · STALE (missing ${STALE_ROOT_DAYS}+ days — \`projects prune\` removes it)` : state === 'missing' ? ' · missing' : '';
        process.stdout.write(
            `${id}  ${e.root}${e.pinned ? ' · pinned' : ''}${flag}\n` +
                `    last seen ${e.last_seen}${e.graph_commit ? ` · commit ${e.graph_commit.slice(0, 12)}` : ''}` +
                `${e.languages.length ? ` · ${e.languages.join(', ')}` : ''}${e.providers.length ? ` · providers ${e.providers.join(', ')}` : ''}\n`,
        );
    }
    process.stdout.write(`estate index: ${reg.index ? 'on' : 'off'} · budget ${reg.budget_mb} MB\n`);
    return 0;
}

function cmdAdd(target: string | undefined): number {
    if (!target) {
        process.stderr.write('usage: code-graph projects add <path>\n');
        return 2;
    }
    const abs = path.resolve(target);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        process.stderr.write(`code-graph: not a directory: ${abs}\n`);
        return 1;
    }
    const id = recordProject(abs);
    process.stdout.write(`registered ${id}  ${fs.realpathSync(abs)}\n`);
    return 0;
}

function cmdRemove(ref: string | undefined): number {
    if (!ref) {
        process.stderr.write('usage: code-graph projects remove <id|name|path>\n');
        return 2;
    }
    const hits = findProjects(readRegistry(), ref);
    if (hits.length === 0) {
        process.stderr.write(`code-graph: no registered project matches '${ref}'\n`);
        return 1;
    }
    if (hits.length > 1) {
        process.stderr.write(`code-graph: '${ref}' names ${hits.length} projects — use an id:\n`);
        for (const [id, e] of hits) process.stderr.write(`  ${id}  ${e.root}\n`);
        return 1;
    }
    const [id, entry] = hits[0] as [string, ProjectEntry];
    updateRegistry((reg) => {
        delete reg.projects[id];
    });
    const removed = removeGlobalHomes(entry);
    process.stdout.write(`removed ${id}  ${entry.root}${removed.length ? ` · ${removed.length} graph home(s) deleted` : ''}\n`);
    return 0;
}

function cmdPrune(): number {
    const now = new Date();
    const dropped = updateRegistry((reg) => {
        const out: Array<[string, ProjectEntry]> = [];
        for (const [id, e] of Object.entries(reg.projects)) {
            if (rootState(e, now) !== 'stale') continue;
            out.push([id, e]);
            delete reg.projects[id];
        }
        return out;
    });
    for (const [id, e] of dropped) {
        removeGlobalHomes(e);
        process.stdout.write(`pruned ${id}  ${e.root}\n`);
    }
    process.stdout.write(`${dropped.length} pruned\n`);
    return 0;
}

export function projectsMain(argv: string[]): number {
    const [verb, ...rest] = argv;
    const positional = rest.filter((a) => !a.startsWith('--'));
    if (verb === undefined || verb === 'list') return cmdList();
    if (verb === 'add') return cmdAdd(positional[0]);
    if (verb === 'remove') return cmdRemove(positional[0]);
    if (verb === 'prune') return cmdPrune();
    process.stderr.write('usage: code-graph projects list|add <path>|remove <id|name|path>|prune\n');
    return 2;
}
