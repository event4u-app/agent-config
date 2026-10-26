/**
 * The storage budget for user-global graph homes (ADR-299, council O4).
 *
 * Only per-repository homes in the hub (and their pre-ADR-303 places) are ever evicted — a graph under a
 * repository's own `agents/` is the project's, not this machine's cache.
 * Eviction is least-recently-QUERIED first: a query touches its home's
 * `.last-query` marker, a build or refresh records it in the registry, and a
 * registry scan changes neither. A pinned project's homes, a home whose
 * refresh lock is held, and a home written to within a stale-lock window or
 * holding a temp output are never evicted, so a budget can stay exceeded. The
 * last guard exists because a plain `code-graph build` takes no lock.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readRegistry, updateRegistry } from '../_lib/project_registry.js';
import { graphHome, homeDirs } from './graph_home.js';
import { isStale, STALE_LOCK_MS } from './refresh_lock.js';

const MB = 1024 * 1024;
const LAST_QUERY = '.last-query';

/** Record that a query just read `root`'s graph. Only user-global homes keep recency. */
export function touchHome(root: string): void {
    try {
        const home = graphHome(root);
        if (home.kind !== 'global' || !fs.existsSync(home.buildDir)) return;
        const marker = path.join(home.buildDir, LAST_QUERY);
        const now = new Date();
        try {
            fs.utimesSync(marker, now, now);
        } catch {
            fs.writeFileSync(marker, '');
        }
    } catch {
        /* recency is a hint; a query never fails on it */
    }
}

interface Walk {
    bytes: number;
    /** Newest mtime of anything below the home except the query marker. */
    newest: number;
    /** A build's or refresh's temp output is present. */
    temp: boolean;
}

const TEMP_RE = /\.refresh-tmp-|\.tmp-/;

function walk(dir: string, acc: Walk = { bytes: 0, newest: 0, temp: false }): Walk {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (TEMP_RE.test(e.name)) acc.temp = true;
        let st: fs.Stats;
        try {
            st = fs.lstatSync(p);
        } catch {
            continue;
        }
        if (e.name !== LAST_QUERY) acc.newest = Math.max(acc.newest, st.mtimeMs);
        if (e.isDirectory()) walk(p, acc);
        else acc.bytes += st.size;
    }
    return acc;
}

export interface HomeUsage {
    dir: string;
    bytes: number;
    /** Last query, else last build or refresh, else the directory's own mtime. */
    used_at: number;
    pinned: boolean;
    locked: boolean;
    /** Written within the last {@link STALE_LOCK_MS}, or holding a temp output: a build may be mid-write. */
    busy: boolean;
    project: string | null;
}

/** Every user-global graph home with its size and why it may or may not go. */
export function homeUsage(): HomeUsage[] {
    const reg = readRegistry();
    const owner = new Map<string, { id: string; pinned: boolean; at: number }>();
    for (const [id, e] of Object.entries(reg.projects)) {
        for (const [dir, at] of Object.entries(e.homes)) owner.set(dir, { id, pinned: e.pinned, at: Date.parse(at) || 0 });
    }
    const out: HomeUsage[] = [];
    const now = Date.now();
    for (const dir of homeDirs()) {
        let st: fs.Stats;
        try {
            st = fs.statSync(dir);
        } catch {
            continue;
        }
        if (!st.isDirectory()) continue;
        // A home in the hub keeps its marker and lock under `.build/`; one an older release wrote, under `state/`.
        const own = fs.existsSync(path.join(dir, '.build')) ? path.join(dir, '.build') : path.join(dir, 'state');
        let queried = 0;
        try {
            queried = fs.statSync(path.join(own, LAST_QUERY)).mtimeMs;
        } catch {
            queried = 0;
        }
        const o = owner.get(dir);
        const lock = path.join(own, 'code-graph-refresh.lock');
        const w = walk(dir);
        out.push({
            dir,
            bytes: w.bytes,
            used_at: Math.max(queried, o?.at ?? 0) || st.mtimeMs,
            pinned: o?.pinned ?? false,
            locked: fs.existsSync(lock) && !isStale(lock),
            busy: w.temp || now - w.newest < STALE_LOCK_MS,
            project: o?.id ?? null,
        });
    }
    return out;
}

/**
 * Evict the least recently used homes until the total fits `budget_mb`;
 * returns what went. `keep` is the home a build just wrote, which is never its
 * own victim.
 */
export function enforceBudget(keep?: string): { evicted: HomeUsage[]; total: number; budget: number } {
    const budget = readRegistry().budget_mb * MB;
    const homes = homeUsage();
    let total = homes.reduce((n, h) => n + h.bytes, 0);
    const evicted: HomeUsage[] = [];
    for (const h of [...homes].sort((a, b) => a.used_at - b.used_at)) {
        if (total <= budget) break;
        if (h.pinned || h.locked || h.busy || h.dir === keep) continue;
        fs.rmSync(h.dir, { recursive: true, force: true });
        total -= h.bytes;
        evicted.push(h);
    }
    if (evicted.length) {
        const gone = new Set(evicted.map((h) => h.dir));
        updateRegistry((reg) => {
            for (const e of Object.values(reg.projects)) {
                for (const dir of Object.keys(e.homes)) if (gone.has(dir)) delete e.homes[dir];
            }
        });
    }
    return { evicted, total, budget };
}
