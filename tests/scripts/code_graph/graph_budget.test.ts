import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry, recordProject, updateRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { cleanupTemp, main } from '../../../src/scripts/code_graph/cli.js';
import { enforceBudget, homeUsage, touchHome } from '../../../src/scripts/code_graph/graph_budget.js';
import { graphHome, graphsRoot } from '../../../src/scripts/code_graph/graph_home.js';
import { acquire } from '../../../src/scripts/code_graph/refresh_lock.js';

let tmp: string;
let saved: string | undefined;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-budget-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** A foreign root with a fake 400 KB graph in its user-global home, used `ageDays` ago. */
function seeded(name: string, ageDays: number): { root: string; dir: string } {
    const root = path.join(tmp, name);
    fs.mkdirSync(root, { recursive: true });
    const home = graphHome(root);
    fs.mkdirSync(home.stateDir, { recursive: true });
    fs.writeFileSync(home.cachePath, Buffer.alloc(400 * 1024, 1));
    const at = new Date(Date.now() - ageDays * 86_400_000);
    recordProject(root, { usedHome: home.dir }, { now: at });
    for (const p of [home.cachePath, home.stateDir, home.dir]) fs.utimesSync(p, at, at);
    return { root, dir: home.dir };
}

describe('storage budget (6.1)', () => {
    it('defaults to 2048 MB in the registry and is set by `projects budget`', async () => {
        expect(readRegistry().budget_mb).toBe(2048);
        expect(await main(['projects', 'budget', '1.5'])).toBe(0);
        expect(readRegistry().budget_mb).toBe(1.5);
        expect(await main(['projects', 'budget', '-1'])).toBe(2);
    });

    it('evicts the oldest unpinned, unlocked home; a locked older one and a pinned one stay', async () => {
        const locked = seeded('locked', 40);
        const oldest = seeded('oldest', 30);
        const pinned = seeded('pinned', 35);
        const recent = seeded('recent', 1);
        expect(await main(['projects', 'pin', 'pinned'])).toBe(0);
        const release = acquire(locked.root);
        expect(release).not.toBeNull();
        try {
            updateRegistry((reg) => {
                reg.budget_mb = 1.3;
            });
            const r = enforceBudget();
            expect(r.evicted.map((h) => h.dir)).toEqual([oldest.dir]);
        } finally {
            release?.();
        }
        expect(fs.existsSync(oldest.dir)).toBe(false);
        for (const kept of [locked, pinned, recent]) expect(fs.existsSync(kept.dir)).toBe(true);
        const entry = Object.values(readRegistry().projects).find((e) => e.root === oldest.root)!;
        expect(Object.keys(entry.homes)).toEqual([]);
    });

    it('a query updates recency; a registry scan does not', async () => {
        const a = seeded('a', 10);
        const b = seeded('b', 5);
        const before = homeUsage().find((h) => h.dir === a.dir)!.used_at;
        expect(await main(['projects', 'list'])).toBe(0);
        expect(homeUsage().find((h) => h.dir === a.dir)!.used_at).toBe(before);
        touchHome(a.root);
        expect(homeUsage().find((h) => h.dir === a.dir)!.used_at).toBeGreaterThan(before);
        updateRegistry((reg) => {
            reg.budget_mb = 0.5;
        });
        expect(enforceBudget().evicted.map((h) => h.dir)).toEqual([b.dir]);
    });

    it('never touches a graph under a repository\'s own agents/', () => {
        const proj = path.join(tmp, 'proj');
        fs.mkdirSync(path.join(proj, 'agents', 'runtime', 'state'), { recursive: true });
        fs.writeFileSync(graphHome(proj).cachePath, Buffer.alloc(900 * 1024, 1));
        recordProject(proj, { graph_home: graphHome(proj).dir });
        seeded('foreign', 50);
        updateRegistry((reg) => {
            reg.budget_mb = 0.1;
        });
        enforceBudget();
        expect(fs.existsSync(graphHome(proj).cachePath)).toBe(true);
        expect(homeUsage().every((h) => h.dir.startsWith(graphsRoot()))).toBe(true);
    });

    it('never evicts a home a build is writing into, even without the refresh lock', () => {
        const writing = seeded('writing', 40);
        const temp = seeded('temp', 39);
        const idle = seeded('idle', 38);
        fs.writeFileSync(path.join(writing.dir, 'state', 'code-graph-v1.json.sqlite3.tmp-1'), Buffer.alloc(10, 1));
        const stale = path.join(temp.dir, 'state', '.code-graph-v1.json.refresh-tmp-1-ab.json');
        fs.writeFileSync(stale, '');
        const old = new Date(Date.now() - 39 * 86_400_000);
        fs.utimesSync(stale, old, old);
        fs.utimesSync(path.join(temp.dir, 'state'), old, old);
        updateRegistry((reg) => {
            reg.budget_mb = 0.1;
        });
        expect(enforceBudget().evicted.map((h) => h.dir)).toEqual([idle.dir]);
        expect(fs.existsSync(writing.dir)).toBe(true);
        expect(fs.existsSync(temp.dir)).toBe(true);
    });

    it('never evicts the home it was asked to keep', () => {
        const kept = seeded('kept', 60);
        const other = seeded('other', 10);
        updateRegistry((reg) => {
            reg.budget_mb = 0.1;
        });
        expect(enforceBudget(kept.dir).evicted.map((h) => h.dir)).toEqual([other.dir]);
        expect(fs.existsSync(kept.dir)).toBe(true);
    });
});

describe('cleanupTemp', () => {
    it('never throws, even when the temp output\'s directory is gone', () => {
        expect(() => cleanupTemp(path.join(tmp, 'vanished', '.out.refresh-tmp-1-ab.json'))).not.toThrow();
    });
});
