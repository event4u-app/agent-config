/**
 * Verify before acting, update after (ADR-303): tombstones and the shrink guard,
 * the working-tree overlay, `confirm`, depth by risk class in shadow, usage
 * counts as lower bounds, `refresh --touched`, and the verified context pack.
 *
 * Every rig is a real git repository with a real graph and SQLite index built
 * by the engine; nothing here stubs the store a verb reads.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildFromRepo, serializeGraph } from '../../src/scripts/code_graph/build.js';
import { main as cli } from '../../src/scripts/code_graph/cli.js';
import { graphHome } from '../../src/scripts/code_graph/graph_home.js';
import { loadGraph, tree } from '../../src/scripts/code_graph/query.js';
import { emitSqliteTwin, openGraphIndex } from '../../src/scripts/code_graph/sqlite_store.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { confirmIds, DEPTH_BY_CLASS } from '../../src/scripts/code_graph/verify/confirm.js';
import { lowerBound } from '../../src/scripts/code_graph/verify/lower_bound.js';
import { computeOverlay, overlayState, overlayView, readOverlay } from '../../src/scripts/code_graph/verify/overlay.js';
import { contextPack, seedWords } from '../../src/scripts/code_graph/verify/pack.js';
import { graphChecksum } from '../../src/scripts/code_graph/verify/owner_index.js';
import { verifyPaths } from '../../src/scripts/code_graph/verify/paths.js';
import { diffGraphs, rebuildDiff } from '../../src/scripts/code_graph/verify/rebuild_diff.js';
import { shrinkCheck } from '../../src/scripts/code_graph/verify/shrink_guard.js';
import { readTombstones } from '../../src/scripts/code_graph/verify/tombstones.js';
import { checkWitness, FileCache } from '../../src/scripts/code_graph/verify/witness_check.js';
import { spanHash } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { ToolCache } from '../../src/scripts/mcp_server/tools.js';

const P1 = path.resolve(__dirname, '../fixtures/code-graph/correctness/p1-blog');
const POSTS = 'database/migrations/2024_01_01_000002_create_posts_table.php';

const dirs: string[] = [];
afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function git(dir: string, ...args: string[]): string {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
}

function write(dir: string, rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
}

/** A committed repository with a project home and its graph built. */
async function rig(files: Record<string, string> | 'p1'): Promise<{ dir: string; cache: string }> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-verify-')));
    dirs.push(dir);
    if (files === 'p1') fs.cpSync(P1, dir, { recursive: true });
    else for (const [rel, body] of Object.entries(files)) write(dir, rel, body);
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    write(dir, '.gitignore', 'agents/runtime/\nagents/map/.build/\n');
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 't@example.com');
    git(dir, 'config', 'user.name', 't');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'seed');
    const cache = graphHome(dir).cachePath;
    await buildFromRepo(dir, cache);
    return { dir, cache };
}

function editLine(dir: string, rel: string, from: string, to: string | null): void {
    const p = path.join(dir, rel);
    const lines = fs.readFileSync(p, 'utf-8').split('\n');
    const i = lines.findIndex((l) => l.includes(from));
    expect(i, `${from} in ${rel}`).toBeGreaterThanOrEqual(0);
    if (to === null) lines.splice(i, 1);
    else lines[i] = to;
    fs.writeFileSync(p, lines.join('\n'));
}

const TS_FILES: Record<string, string> = {
    'src/service.ts': 'export function archive(id: string): string {\n    return id.trim();\n}\n\nexport function handle(x: string): string {\n    return x;\n}\n',
    'src/main.ts': "import { archive } from './service.js';\n\nexport function run(): string {\n    return archive('a');\n}\n",
    'src/other.ts': 'export function handle(y: number): number {\n    return y + 1;\n}\n',
    // A usage no reader can see: the method name is built at run time.
    'src/dynamic.ts': "export function late(api: Record<string, () => void>): void {\n    const m = 'archive';\n    api[m]?.();\n}\n",
    'tests/service.test.ts': "import { archive } from '../src/service.js';\n\nexport function check(): boolean {\n    return archive(' a ') === 'a';\n}\n",
};

describe('witness check', () => {
    it('reads confirmed, moved, changed and gone off one span, and needs no recorded hash form', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-witness-'));
        dirs.push(dir);
        const line = "            $table->string('title');";
        write(dir, 'm.php', `<?php\n${line}\n`);
        const files = () => new FileCache(dir);
        for (const hash of [spanHash(line.trim()), spanHash(line), spanHash(line.trimEnd())]) {
            expect(checkWitness(files(), { file: 'm.php', line: 2, hash, name: 'title' }).state).toBe('confirmed');
        }
        const hash = spanHash(line.trim());
        write(dir, 'm.php', `<?php\n\n\n${line}\n`);
        expect(checkWitness(files(), { file: 'm.php', line: 2, hash, name: 'title' })).toMatchObject({ state: 'moved', now_at: 'm.php:4' });
        write(dir, 'm.php', `<?php\n            $table->text('title');\n`);
        expect(checkWitness(files(), { file: 'm.php', line: 2, hash, name: 'title' }).state).toBe('changed');
        write(dir, 'm.php', '<?php\n');
        expect(checkWitness(files(), { file: 'm.php', line: 2, hash, name: 'title' }).state).toBe('gone');
        fs.rmSync(path.join(dir, 'm.php'));
        expect(checkWitness(files(), { file: 'm.php', line: 2, hash, name: 'title' }).state).toBe('gone');
    });

    it('confirms a multi-line span hashed whole, and refuses a path outside the root', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-witness-'));
        dirs.push(dir);
        const span = ['a: 1', 'b: 2', 'c: 3'];
        write(dir, 'x.yml', ['top', ...span, 'end'].join('\n'));
        expect(checkWitness(new FileCache(dir), { file: 'x.yml', line: 2, hash: spanHash(span.join('\n')), name: 'a' }).state).toBe('confirmed');
        expect(checkWitness(new FileCache(dir), { file: '../outside.yml', line: 1, hash: 'deadbeef', name: 'a' }).state).toBe('gone');
    });
});

describe('3.3 — confirm reads witnesses through the index only', () => {
    it('answers confirmed, then gone with a tombstone once the column line is deleted — no rebuild', async () => {
        const { dir, cache } = await rig('p1');
        expect(openGraphIndex(cache)?.hasNode('column:posts.title')).toBe(true);
        expect(confirmIds(dir, cache, ['column:posts.title']).items[0]?.state).toBe('confirmed');
        editLine(dir, POSTS, "string('title')", null);
        const r = confirmIds(dir, cache, ['column:posts.title']);
        expect(r.items[0]).toMatchObject({ state: 'gone', tombstone: { reason: 'span-gone' } });
        expect(readTombstones(verifyPaths(cache).tombstones).map((t) => t.id)).toContain('column:posts.title');
    });

    it('never parses the JSON graph: it answers with the JSON replaced by garbage of the same size and mtime', async () => {
        const { dir, cache } = await rig('p1');
        const graph = JSON.parse(fs.readFileSync(cache, 'utf-8')) as CodeGraph;
        fs.writeFileSync(cache, 'not a graph');
        // The index rows are the real graph; its freshness stamp is the garbage file's.
        emitSqliteTwin(graph, cache);
        expect(() => loadGraph(cache)).toThrow();
        const r = confirmIds(dir, cache, ['column:posts.title', 'table:posts']);
        expect(r.status).toBe('ok');
        expect(r.items.map((i) => i.state)).toEqual(['confirmed', 'confirmed']);
    });

    it('refuses, never falls back to the JSON, when the index cannot serve', async () => {
        const { dir, cache } = await rig('p1');
        fs.rmSync(cache.replace(/\.json$/, '.sqlite3'));
        const r = confirmIds(dir, cache, ['table:posts']);
        expect(r.status).toBe('unavailable');
        expect(r.items).toEqual([]);
    });

    it('reports an id it cannot resolve as not found, not as a state', async () => {
        const { dir, cache } = await rig('p1');
        expect(confirmIds(dir, cache, ['table:no_such_table']).not_found).toEqual(['table:no_such_table']);
    });

    it('graph_node mode=confirm answers through the index', async () => {
        const { dir } = await rig('p1');
        const r = (await new ToolCache().dispatch('graph_node', { id: 'column:posts.title', mode: 'confirm' }, dir)) as Record<string, unknown>;
        const result = (r['result'] ?? r) as { status: string; items: Array<{ state: string }> };
        expect(result.status).toBe('ok');
        expect(result.items[0]?.state).toBe('confirmed');
    });
});

describe('3.4 — depth by risk class, recorded in shadow', () => {
    it('records the class and the depth it chose per call, and runs witnesses only unless asked', async () => {
        const { dir, cache } = await rig('p1');
        const r = confirmIds(dir, cache, ['column:posts.title']);
        expect(r.risk.class).toBe('R3');
        expect(r.risk.depth_chosen).toBe(DEPTH_BY_CLASS.R3);
        expect(r.risk.depth_ran).toBe('witness');
        const shadow = fs.readFileSync(verifyPaths(cache).shadow, 'utf-8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(shadow.at(-1)).toMatchObject({ class: 'R3', depth_chosen: 'full', depth_ran: 'witness', enforced: false });
    });

    it('runs the chosen depth on request: R3 adds callers and a drift re-run, R2 a text cross-check', async () => {
        const { dir, cache } = await rig('p1');
        const full = confirmIds(dir, cache, ['column:posts.title'], { depth: 'auto' });
        expect(full.risk.depth_ran).toBe('full');
        expect(Array.isArray(full.fan_out)).toBe(true);
        expect(Array.isArray(full.drift)).toBe(true);
        const ts = await rig(TS_FILES);
        const text = confirmIds(ts.dir, ts.cache, ['src/service.ts#archive'], { depth: 'auto' });
        expect(text.risk).toMatchObject({ class: 'R2', depth_ran: 'text' });
        expect(text.items[0]?.usage?.line).toMatch(/^known places \d+ \(\+\d+ only by text search\)$/);
    });

    it('writes no shadow line when told not to', async () => {
        const { dir, cache } = await rig('p1');
        confirmIds(dir, cache, ['table:posts'], { shadow: false });
        expect(fs.existsSync(verifyPaths(cache).shadow)).toBe(false);
    });
});

describe('3.2 — the working-tree overlay', () => {
    it('shows an uncommitted new column as added before any rebuild, and hides the deleted one', async () => {
        const { dir, cache } = await rig('p1');
        editLine(dir, POSTS, "string('title')", "            $table->string('slug');");
        const { overlay, tombstones } = await computeOverlay(dir, cache);
        expect(overlay.files).toEqual([POSTS]);
        expect(overlay.added).toContain('column:posts.slug');
        expect(overlay.removed_nodes).toContain('column:posts.title');
        expect(tombstones.find((t) => t.id === 'column:posts.title')).toMatchObject({ reason: 'span-gone', by: 'overlay' });

        const base = loadGraph(cache);
        const view = overlayView(base, readOverlay(cache, graphChecksum(base)));
        expect(view.byId.has('column:posts.slug')).toBe(true);
        expect(view.byId.has('column:posts.title')).toBe(false);
        const t = tree(view, 'table:posts', { relations: ['member'], direction: 'out', stateOf: (id) => overlayState(overlay, id) });
        expect(t.items.find((i) => i.id === 'column:posts.slug')?.confirm).toBe('added');
        expect(t.tree.some((l) => /posts\.slug .*\(added\)$/.test(l))).toBe(true);
        expect(t.items.some((i) => i.id === 'column:posts.title')).toBe(false);
        expect(confirmIds(dir, cache, ['column:posts.slug']).items[0]?.state).toBe('added');
        // Facts of files the tree did not change are the committed ones, untouched.
        expect(view.byId.get('table:comments')).toEqual(base.byId.get('table:comments'));
    });

    it('is empty for a clean tree, and ignored once the index it was computed against is replaced', async () => {
        const { dir, cache } = await rig('p1');
        const clean = await computeOverlay(dir, cache);
        expect(clean.overlay.files).toEqual([]);
        editLine(dir, POSTS, "string('title')", "            $table->string('slug');");
        await computeOverlay(dir, cache);
        expect(readOverlay(cache, 'another-checksum')).toBeNull();
    });
});

describe('3.5 — usage counts are lower bounds', () => {
    it('puts a planted dynamic usage in M, not in N', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const g = loadGraph(cache);
        const users = tree(g, 'src/service.ts#archive', { direction: 'in', depth: 2, limit: 100 }).items.map((i) => g.byId.get(i.id)?.source_file).filter((f): f is string => !!f);
        expect(users).not.toContain('src/dynamic.ts');
        const lb = lowerBound(dir, 'archive', users, ['src/service.ts'], verifyPaths(cache).readerGaps);
        expect(lb.text_only_at.map((a) => a.split(':')[0])).toEqual(['src/dynamic.ts']);
        expect(lb.line).toBe(`known places ${new Set(users).size} (+1 only by text search)`);
        const gap = JSON.parse(fs.readFileSync(verifyPaths(cache).readerGaps, 'utf-8').trim().split('\n').at(-1) as string) as { name: string };
        expect(gap.name).toBe('archive');
    });

    it('says +0 when the text finds nothing new, and "unavailable" outside a repository', async () => {
        const { dir } = await rig(TS_FILES);
        expect(lowerBound(dir, 'run', ['src/main.ts'], ['src/main.ts']).text_only).toBe(0);
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-bare-'));
        dirs.push(bare);
        expect(lowerBound(bare, 'archive', [], []).unavailable).toBeDefined();
    });

    it('prints the pair under every affected answer on the CLI', async () => {
        const { dir } = await rig(TS_FILES);
        const out: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s));
            return true;
        });
        expect(await cli(['affected', 'src/service.ts#archive', '--root', dir])).toBe(0);
        expect(out.join('')).toMatch(/usage: known places \d+ \(\+1 only by text search\)\n {2}text only: src\/dynamic\.ts:2/);
    });
});

describe('3.6 — update after acting', () => {
    it('re-reads a touched file into the overlay and names the verified tree', async () => {
        const { dir, cache } = await rig(TS_FILES);
        fs.appendFileSync(path.join(dir, 'src/service.ts'), '\nexport function restore(id: string): string {\n    return archive(id);\n}\n');
        const out: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s));
            return true;
        });
        expect(await cli(['refresh', '--touched', '--root', dir])).toBe(0);
        const head = git(dir, 'rev-parse', 'HEAD').trim();
        expect(out.join('')).toContain(`graph verified against working tree at ${head}+dirty`);
        expect(out.join('')).toMatch(/drift on \d+ touched fact\(s\)/);
        const base = loadGraph(cache);
        const view = overlayView(base, readOverlay(cache, graphChecksum(base)));
        expect(view.byId.has('src/service.ts#restore')).toBe(true);
        expect(base.byId.has('src/service.ts#restore')).toBe(false);
        out.length = 0;
        expect(await cli(['query', 'src/service.ts', '--kind', 'function', '--direction', 'out', '--root', dir])).toBe(0);
        expect(out.join('')).toMatch(/restore \[function\] at=src\/service\.ts:\d+ \(added\)/);
    });

    it('reads a clean tree as verified at HEAD with nothing dirty', async () => {
        const { dir } = await rig(TS_FILES);
        const out: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s));
            return true;
        });
        expect(await cli(['refresh', '--touched', '--root', dir])).toBe(0);
        expect(out.join('')).toContain(`graph verified against working tree at ${git(dir, 'rev-parse', 'HEAD').trim()}\n`);
    });
});

describe('3.1 — tombstones, shrink guard, rebuild diff', () => {
    function plantedLoss(cache: string, keep: (id: string) => boolean): string {
        const g = JSON.parse(fs.readFileSync(cache, 'utf-8')) as CodeGraph;
        const nodes = g.nodes.filter((n) => keep(n.id));
        const ids = new Set(nodes.map((n) => n.id));
        const shrunk: CodeGraph = { ...g, nodes, edges: g.edges.filter((e) => ids.has(e.source)) };
        const out = cache.replace(/\.json$/, '.new.json');
        fs.writeFileSync(out, serializeGraph(shrunk));
        emitSqliteTwin(shrunk, out);
        return out;
    }

    it('refuses a planted mass loss with no matching change in the tree', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const shrunk = plantedLoss(cache, (id) => !id.startsWith('src/'));
        const v = shrinkCheck(dir, cache, shrunk);
        expect(v.ok).toBe(false);
        expect(v.unexplained).toBeGreaterThan(0);
        expect(v.share).toBeGreaterThan(v.limit);
    });

    it('lets the same loss through when the files it came from were deleted, as tombstones', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const shrunk = plantedLoss(cache, (id) => !id.startsWith('src/'));
        for (const f of ['src/service.ts', 'src/main.ts', 'src/other.ts', 'src/dynamic.ts']) fs.rmSync(path.join(dir, f));
        const v = shrinkCheck(dir, cache, shrunk);
        expect(v.ok).toBe(true);
        expect(v.unexplained).toBe(0);
        expect(v.tombstones.map((t) => t.id)).toContain('src/service.ts#archive');
        expect(v.tombstones.every((t) => t.reason === 'owner-deleted')).toBe(true);
    });

    it('lets a small unexplained loss through under the share', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const shrunk = plantedLoss(cache, (id) => id !== 'src/other.ts#handle');
        expect(shrinkCheck(dir, cache, shrunk).ok).toBe(true);
    });

    it('rebuild-diff agrees on a healthy tree and names a planted reader defect', async () => {
        const { dir, cache } = await rig(TS_FILES);
        expect((await rebuildDiff(dir, cache)).same).toBe(true);
        const cold = (await buildFromRepo(dir, null)).graph;
        const defective: CodeGraph = { ...cold, nodes: cold.nodes.filter((n) => n.id !== 'src/main.ts#run') };
        const d = await rebuildDiff(dir, cache, { incremental: async () => defective, cold: async () => cold });
        expect(d.same).toBe(false);
        expect(d.only_cold).toContain('node src/main.ts#run');
        expect(diffGraphs(cold, cold).same).toBe(true);
    });
});

describe('3.7 — the verified context pack', () => {
    it('holds the planted task\'s affected set within the budget, each item confirmed with at=file:line', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const g = loadGraph(cache);
        const p = contextPack(g, dir, cache, 'Rename archive and keep its callers working');
        expect(p.seeds.from_task).toEqual(['src/service.ts#archive']);
        const ids = p.items.map((i) => i.id);
        expect(ids).toEqual(expect.arrayContaining(['src/service.ts#archive', 'src/main.ts#run', 'tests/service.test.ts#check']));
        expect(p.budget.used).toBeLessThanOrEqual(p.budget.tokens);
        expect(p.items.every((i) => i.at === null || /:\d+$/.test(i.at))).toBe(true);
        expect(p.items.find((i) => i.id === 'src/main.ts#run')?.confirm).toBe('confirmed');
        expect(p.returned).toBe(p.items.length);
    });

    it('counts what the budget cut instead of dropping it silently', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const p = contextPack(loadGraph(cache), dir, cache, 'archive', { budget: 50 });
        expect(p.hasMore).toBe(true);
        expect(p.returned).toBeLessThan(p.total);
    });

    it('refuses an ambiguous seed and names the population when nothing seeds', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const g = loadGraph(cache);
        const amb = contextPack(g, dir, cache, 'make handle faster');
        expect(amb.refused_seeds[0]).toMatchObject({ word: 'handle' });
        expect(amb.refused_seeds[0]?.candidates.sort()).toEqual(['src/other.ts#handle', 'src/service.ts#handle']);
        const none = contextPack(g, dir, cache, 'polish the documentation wording');
        expect(none.items).toEqual([]);
        expect(none.population).toMatch(/^no seed: .*the graph holds \d+ nodes$/);
    });

    it('seeds from the working diff, and is reachable as graph_query mode=pack', async () => {
        const { dir, cache } = await rig(TS_FILES);
        const p = contextPack(loadGraph(cache), dir, cache, '', { diffFiles: ['src/main.ts'] });
        expect(p.seeds.from_diff).toContain('src/main.ts#run');
        const r = (await new ToolCache().dispatch('graph_query', { symbol: 'archive callers', mode: 'pack' }, dir)) as Record<string, unknown>;
        const result = (r['result'] ?? r) as { seeds: { from_task: string[] }; items: unknown[] };
        expect(result.seeds.from_task).toEqual(['src/service.ts#archive']);
        expect(result.items.length).toBeGreaterThan(0);
    });

    it('takes seed words from the task text without stopwords or duplicates', () => {
        expect(seedWords('Fix the archive call in src/main.ts and the archive test')).toEqual(['archive', 'call', 'src/main.ts', 'test']);
    });
});
