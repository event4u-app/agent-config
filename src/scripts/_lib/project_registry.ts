/**
 * The one user-global list of projects this machine has worked in (ADR-299).
 *
 * `runtime/projects/registry.json`, keyed by repo id (`code_graph/repo_identity`).
 * A project enters by use — a graph build or refresh, an advisories refresh, or
 * an explicit `code-graph projects add` — never by a crawl. The file names
 * client projects by absolute path, so nothing that leaves the machine may read
 * it (step 6.3 enforces that).
 *
 * Writes are atomic (`write_atomic`), and read-modify-write goes through a
 * short mkdir lock so two processes recording at once do not drop an entry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { canonicalOrigin, projectsDir, remoteUrl, repoIdentity } from '../code_graph/repo_identity.js';
import { git_common_dir } from './git_common_dir.js';
import { write_atomic } from './fs_atomic.js';
import type { EnvMap } from './user_global_paths.js';

export const DEFAULT_BUDGET_MB = 2048;

export interface ProjectEntry {
    root: string;
    /** The credential-free canonical origin, or null without a remote. */
    remote: string | null;
    fingerprint: string | null;
    last_seen: string;
    /** The graph home directory last used for this project. */
    graph_home: string | null;
    graph_commit: string | null;
    languages: string[];
    providers: string[];
    pinned: boolean;
    /** User-global graph homes of this project (main checkout and worktrees) → last query. */
    homes: Record<string, string>;
}

export interface Registry {
    schema: 1;
    /** The estate index switch (council O1): off unless the owner turns it on. */
    index: boolean;
    budget_mb: number;
    projects: Record<string, ProjectEntry>;
}

export interface RegistryOptions {
    env?: EnvMap | null;
    /** Overrides the projects directory (tests, advisories' injected machine dir). */
    dir?: string;
    now?: Date;
}

export function emptyRegistry(): Registry {
    return { schema: 1, index: false, budget_mb: DEFAULT_BUDGET_MB, projects: {} };
}

export function registryDir(opts: RegistryOptions = {}): string {
    return opts.dir ?? projectsDir(opts.env);
}

export function registryPath(env?: EnvMap | null, dir?: string): string {
    return path.join(dir ?? projectsDir(env), 'registry.json');
}

function isEntry(v: unknown): v is ProjectEntry {
    const e = v as Partial<ProjectEntry> | null;
    return !!e && typeof e.root === 'string' && typeof e.last_seen === 'string';
}

/** A missing, corrupt or foreign file reads as empty, never as an error. */
export function readRegistry(opts: RegistryOptions = {}): Registry {
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(registryPath(opts.env, opts.dir), 'utf-8'));
    } catch {
        return emptyRegistry();
    }
    const r = raw as Partial<Registry> | null;
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.schema !== 1 || typeof r.projects !== 'object' || r.projects === null) {
        return emptyRegistry();
    }
    const projects: Record<string, ProjectEntry> = {};
    for (const [id, e] of Object.entries(r.projects)) {
        if (!isEntry(e)) continue;
        projects[id] = {
            root: e.root,
            remote: e.remote ?? null,
            fingerprint: e.fingerprint ?? null,
            last_seen: e.last_seen,
            graph_home: e.graph_home ?? null,
            graph_commit: e.graph_commit ?? null,
            languages: Array.isArray(e.languages) ? e.languages : [],
            providers: Array.isArray(e.providers) ? e.providers : [],
            pinned: e.pinned === true,
            homes: e.homes && typeof e.homes === 'object' ? e.homes : {},
        };
    }
    return {
        schema: 1,
        index: r.index === true,
        budget_mb: typeof r.budget_mb === 'number' && r.budget_mb > 0 ? r.budget_mb : DEFAULT_BUDGET_MB,
        projects,
    };
}

export function writeRegistry(reg: Registry, opts: RegistryOptions = {}): void {
    write_atomic(registryPath(opts.env, opts.dir), `${JSON.stringify(reg, null, 2)}\n`);
}

const LOCK_WAIT_MS = 2_000;
const LOCK_STALE_MS = 30_000;

function sleep(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Read, change and write under the registry lock; the change sees the latest file. */
export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOptions = {}): T {
    const lock = path.join(registryDir(opts), 'registry.lock');
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
        try {
            fs.mkdirSync(lock);
            break;
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
            try {
                if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
            } catch {
                /* released meanwhile */
            }
            if (Date.now() > deadline) throw new Error(`project registry is locked: ${lock}`);
            sleep(25);
        }
    }
    try {
        const reg = readRegistry(opts);
        const out = fn(reg);
        writeRegistry(reg, opts);
        return out;
    } finally {
        fs.rmSync(lock, { recursive: true, force: true });
    }
}

/** The main checkout of a worktree, else the root itself. */
export function mainRoot(root: string): string {
    let real: string;
    try {
        real = fs.realpathSync(root);
    } catch {
        real = path.resolve(root);
    }
    const common = git_common_dir(real);
    return common !== null && path.basename(common) === '.git' ? path.dirname(common) : real;
}

export type ProjectFields = Partial<Pick<ProjectEntry, 'fingerprint' | 'graph_home' | 'graph_commit' | 'languages' | 'providers' | 'pinned'>> & {
    /** A user-global graph home that just served or rebuilt this project. */
    usedHome?: string;
};

/** Record `root` (by use, never by a crawl) and return its repo id. */
export function recordProject(root: string, fields: ProjectFields = {}, opts: RegistryOptions = {}): string {
    const dir = registryDir(opts);
    const id = repoIdentity(root, opts.env, dir).repoId;
    const main = mainRoot(root);
    const origin = remoteUrl(main);
    const now = (opts.now ?? new Date()).toISOString();
    updateRegistry((reg) => {
        const prev = reg.projects[id];
        const { usedHome, ...rest } = fields;
        const next: ProjectEntry = {
            root: main,
            remote: origin === null ? null : canonicalOrigin(origin, main),
            fingerprint: prev?.fingerprint ?? null,
            graph_home: prev?.graph_home ?? null,
            graph_commit: prev?.graph_commit ?? null,
            languages: prev?.languages ?? [],
            providers: prev?.providers ?? [],
            pinned: prev?.pinned ?? false,
            homes: { ...(prev?.homes ?? {}) },
            ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
            last_seen: now,
        };
        if (usedHome !== undefined) next.homes[usedHome] = now;
        reg.projects[id] = next;
    }, { ...opts, dir });
    return id;
}

/**
 * The entries a reference names: a repo id, a registered name (the root's
 * basename) or a path. A name two projects share returns both, so the caller
 * can refuse to guess.
 */
export function findProjects(reg: Registry, ref: string): Array<[string, ProjectEntry]> {
    const all = Object.entries(reg.projects);
    const byId = all.filter(([id]) => id === ref);
    if (byId.length) return byId;
    let real: string | null = null;
    try {
        real = fs.realpathSync(path.resolve(ref));
    } catch {
        real = path.resolve(ref);
    }
    const byPath = all.filter(([, e]) => e.root === real || e.root === ref);
    if (byPath.length) return byPath;
    return all.filter(([, e]) => path.basename(e.root) === ref);
}
