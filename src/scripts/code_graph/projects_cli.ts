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
 *   projects index on|off|status        the estate index switch (council O1, default off)
 *   projects budget [MB]                show or set the graph-home budget (default 2048)
 *   projects pin|unpin <id|name|path>   keep a project's graph homes out of eviction
 *   projects evict                      evict least recently queried homes down to the budget
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { findProjects, mainRoot, type ProjectEntry, readRegistry, recordProject, repoIdOf, updateRegistry } from '../_lib/project_registry.js';
import { dropProjectRows, indexAfterRefresh, indexPath, readableIndexPath } from './estate_index.js';
import { enforceBudget, homeUsage } from './graph_budget.js';
import { graphHome, graphsRoot, isHomeDir } from './graph_home.js';
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
 *
 * A linked worktree shares its main checkout's repo id, so it records only its
 * own home (for eviction and removal) and never the entry's graph home, commit,
 * languages or estate row — a feature-branch build must not replace what the
 * main checkout recorded.
 */
export function registerUse(root: string, graph: CodeGraph | null, commit: string | null): string | null {
    try {
        const home = graphHome(root);
        const real = fs.realpathSync(root);
        const worktree = mainRoot(real) !== real;
        const usedHome = home.kind === 'global' ? { usedHome: home.dir } : {};
        const id = recordProject(
            root,
            worktree
                ? usedHome
                : {
                      graph_home: home.dir,
                      ...(commit ? { graph_commit: commit } : {}),
                      ...(graph ? { languages: [...graph.languages], providers: (graph.providers ?? []).map((p) => p.id) } : {}),
                      ...usedHome,
                  },
        );
        if (!worktree) {
            // A row the pre-checkout registry wrote under the bare repo id goes once that entry was re-keyed.
            if (readRegistry().projects[repoIdOf(id)] === undefined) dropProjectRows(repoIdOf(id));
            indexAfterRefresh(id, real, home.cachePath, graph);
        }
        if (home.kind === 'global') enforceBudget(home.dir);
        return id;
    } catch {
        return null;
    }
}

/** User-global homes are removable caches; a home under a repository's own `agents/` never is. */
function removeGlobalHomes(e: ProjectEntry): string[] {
    const removed: string[] = [];
    for (const dir of new Set([...Object.keys(e.homes), ...(e.graph_home ? [e.graph_home] : [])])) {
        if (!isHomeDir(dir)) continue;
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
    dropProjectRows(id);
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
        dropProjectRows(id);
        process.stdout.write(`pruned ${id}  ${e.root}\n`);
    }
    process.stdout.write(`${dropped.length} pruned\n`);
    return 0;
}

function cmdIndex(action: string | undefined): number {
    if (action === 'on' || action === 'off') {
        updateRegistry((reg) => {
            reg.index = action === 'on';
        });
        if (action === 'off') for (const f of new Set([indexPath(), readableIndexPath()])) fs.rmSync(f, { force: true });
        process.stdout.write(
            action === 'on'
                ? 'estate index on — each registered project is indexed on its next build or refresh. It names client projects by path and never leaves this machine.\n'
                : 'estate index off — the index file is deleted and nothing is indexed.\n',
        );
        return 0;
    }
    if (action !== undefined && action !== 'status') {
        process.stderr.write('usage: code-graph projects index on|off|status\n');
        return 2;
    }
    const reg = readRegistry();
    process.stdout.write(`estate index: ${reg.index ? 'on' : 'off'} · ${fs.existsSync(readableIndexPath()) ? readableIndexPath() : 'no index file'}\n`);
    return 0;
}

function one(ref: string | undefined, verb: string): [string, ProjectEntry] | null {
    if (!ref) {
        process.stderr.write(`usage: code-graph projects ${verb} <id|name|path>\n`);
        return null;
    }
    const hits = findProjects(readRegistry(), ref);
    if (hits.length !== 1) {
        process.stderr.write(`code-graph: '${ref}' matches ${hits.length} registered projects — use an id from \`projects list\`\n`);
        return null;
    }
    return hits[0] as [string, ProjectEntry];
}

function cmdPin(ref: string | undefined, pinned: boolean): number {
    const hit = one(ref, pinned ? 'pin' : 'unpin');
    if (!hit) return 1;
    updateRegistry((reg) => {
        const e = reg.projects[hit[0]];
        if (e) e.pinned = pinned;
    });
    process.stdout.write(`${pinned ? 'pinned' : 'unpinned'} ${hit[0]}  ${hit[1].root}\n`);
    return 0;
}

function cmdBudget(value: string | undefined): number {
    if (value !== undefined) {
        const mb = Number(value);
        if (!Number.isFinite(mb) || mb <= 0) {
            process.stderr.write('usage: code-graph projects budget [MB] — a positive number\n');
            return 2;
        }
        updateRegistry((reg) => {
            reg.budget_mb = mb;
        });
    }
    const used = homeUsage().reduce((n, h) => n + h.bytes, 0);
    process.stdout.write(`graph-home budget: ${readRegistry().budget_mb} MB · in use ${(used / (1024 * 1024)).toFixed(1)} MB under ${graphsRoot()}\n`);
    return 0;
}

function cmdEvict(): number {
    const r = enforceBudget();
    for (const h of r.evicted) process.stdout.write(`evicted ${h.dir} (${(h.bytes / (1024 * 1024)).toFixed(1)} MB)\n`);
    const over = r.total > r.budget;
    process.stdout.write(
        `${r.evicted.length} evicted · ${(r.total / (1024 * 1024)).toFixed(1)} of ${(r.budget / (1024 * 1024)).toFixed(1)} MB` +
            (over ? ' — still over: the rest is pinned, lock-held or being written' : '') +
            '\n',
    );
    return 0;
}

export function projectsMain(argv: string[]): number {
    const [verb, ...rest] = argv;
    const positional = rest.filter((a) => !a.startsWith('--'));
    if (verb === undefined || verb === 'list') return cmdList();
    if (verb === 'add') return cmdAdd(positional[0]);
    if (verb === 'remove') return cmdRemove(positional[0]);
    if (verb === 'prune') return cmdPrune();
    if (verb === 'index') return cmdIndex(positional[0]);
    if (verb === 'budget') return cmdBudget(positional[0]);
    if (verb === 'pin' || verb === 'unpin') return cmdPin(positional[0], verb === 'pin');
    if (verb === 'evict') return cmdEvict();
    process.stderr.write('usage: code-graph projects list|add|remove|prune|index|budget|pin|unpin|evict\n');
    return 2;
}
