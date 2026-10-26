/**
 * The knowledge areas produced from the merged graph: a planted repository
 * (P1 blog, P5 partner client behind a route, a compose stack and a CI
 * workflow) with an uncommitted change draws every area from its own facts,
 * each item with a witness, and the page shows them.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { main as cli } from '../../src/scripts/code_graph/cli.js';
import { buildMap } from '../../src/scripts/code_graph/map.js';
import { AGENT_VERBS, cliVerbs, produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';
import { areaProblems, type MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { GRAPH_TOOLS } from '../../src/scripts/mcp_server/graph_tools.js';

const FX = path.resolve(__dirname, '../fixtures/code-graph');
const roots: string[] = [];
let root: string;
let areas: MapAreas;
let outDir: string;
let browser: Browser | undefined;

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(d);
    return d;
}
const git = (dir: string, ...args: string[]): string =>
    execFileSync('git', ['-C', dir, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf-8' });

function plant(): string {
    const dir = tmp('map-areas-');
    fs.cpSync(path.join(FX, 'correctness/p1-blog'), dir, { recursive: true });
    for (const rel of ['app/Services/PartnerClient.php', 'config/services.php', 'contracts/partner.openapi.yaml', 'resources/wsdl/stock.wsdl', '.env.example']) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.copyFileSync(path.join(FX, 'interfaces/p5', rel), path.join(dir, rel));
    }
    fs.cpSync(path.join(FX, 'delivery/clean/.github'), path.join(dir, '.github'), { recursive: true });
    for (const rel of ['compose.yaml', 'Dockerfile', 'infra/main.tf']) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.copyFileSync(path.join(FX, 'runtime/clean', rel), path.join(dir, rel));
    }
    fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'app/Http/Controllers/StockController.php'),
        '<?php\n\nnamespace App\\Http\\Controllers;\n\nuse App\\Services\\PartnerClient;\n\nclass StockController\n{\n    public function show(string $sku)\n    {\n        $client = new PartnerClient();\n        return $client->warehouseStock($sku);\n    }\n}\n',
    );
    fs.appendFileSync(path.join(dir, 'routes/web.php'), "Route::get('/stock/{sku}', [App\\Http\\Controllers\\StockController::class, 'show']);\n");
    git(dir, 'init', '-q');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    return dir;
}

beforeAll(async () => {
    root = plant();
    const mig = path.join(root, 'database/migrations/2024_01_01_000003_create_comments_table.php');
    fs.writeFileSync(mig, fs.readFileSync(mig, 'utf-8').replace("->text('body');", "->text('body')->nullable();"));
    outDir = path.join(tmp('map-out-'), 'map');
    await buildMap(root, { outDir, cachePath: path.join(root, '.g', 'graph.json') });
    areas = (JSON.parse(fs.readFileSync(path.join(outDir, 'code', 'map.json'), 'utf-8')) as { areas: MapAreas }).areas;
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('every area is drawn from facts, every fact with a witness', () => {
    it('writes a sound areas section with all six areas', () => {
        expect(areaProblems(areas)).toEqual([]);
        expect(Object.keys(areas).sort()).toEqual(['agent', 'data', 'delivery', 'impact', 'interfaces', 'runtime', 'tours']);
    });

    it('Data: tables, keys, relations, and DR-1 / DR-3 / DR-4 with witnesses (P1)', () => {
        const d = areas.data!;
        expect(d.tables.map((t) => t.name).sort()).toEqual(['comments', 'posts', 'users']);
        expect(d.foreignKeys.map((k) => `${k.from.table}.${k.from.column}->${k.to.table}.${k.to.column} ${k.onDelete}`)).toEqual(['posts.user_id->users.id cascade']);
        expect(d.relations.some((r) => r.kind === 'n:m' && r.from === 'Post' && r.to === 'Tag')).toBe(true);
        const subjects = d.findings.filter((f) => ['DR-1', 'DR-3', 'DR-4'].includes(f.id)).map((f) => `${f.id} ${f.subject}`);
        expect(subjects).toEqual(['DR-1 column:comments.post_id', 'DR-3 app/Models/Tag.php#Tag', 'DR-4 table:post_tag']);
        const dr1 = d.findings.find((f) => f.id === 'DR-1')!;
        expect(dr1.witnesses.map((w) => w.file).sort()).toEqual(['app/Models/Comment.php', 'database/migrations/2024_01_01_000003_create_comments_table.php']);
        expect(dr1.message).toContain('NOT VALID');
        expect(d.engine).toBe('pgsql');
    });

    it('Data: one Mermaid ERD page per foreign-key cluster, written into the map folder', () => {
        expect(areas.data!.erd!.map((e) => [e.file, e.tables])).toEqual([
            ['data/schema-posts.md', ['posts', 'users']],
            ['data/schema-standalone.md', ['comments']],
        ]);
        const page = fs.readFileSync(path.join(outDir, 'data/schema-posts.md'), 'utf-8');
        expect(page).toMatch(/```mermaid\nerDiagram\n[\s\S]*users \|\|--o\{ posts/);
    });

    it('Interfaces: service partner bound to PARTNER_URL, operation GetStock with its caller (P5)', () => {
        const s = areas.interfaces!.services;
        expect(s.find((x) => x.name === 'partner')?.configNames).toContain('PARTNER_URL');
        const getStock = s.flatMap((x) => x.operations).find((o) => o.name === 'GetStock')!;
        expect(getStock.callers.map((w) => w.file)).toEqual(['app/Services/PartnerClient.php']);
        expect(getStock.contract?.file).toBe('resources/wsdl/stock.wsdl');
    });

    it('Runtime and Delivery: services with ports, resources, workflows, jobs and the deploy chain', () => {
        const r = areas.runtime!;
        expect(r.services.find((x) => x.name === 'db')?.ports.some((p) => p.target === 5432)).toBe(true);
        expect(r.resources.length).toBeGreaterThan(0);
        const v = areas.delivery!;
        expect(v.workflows.map((w) => w.file)).toEqual(['.github/workflows/ci.yml']);
        expect(v.jobs.find((j) => j.name === 'deploy')?.needs.length).toBeGreaterThan(0);
        expect(v.chain.some((c) => c.kind === 'deploy')).toBe(true);
    });

    it('Impact: the uncommitted change, its affected items across areas and every risk term', () => {
        const m = areas.impact!;
        expect(m.changed).toEqual(['database/migrations/2024_01_01_000003_create_comments_table.php']);
        expect(m.affected.find((a) => a.layer === 'data')?.name).toBe('comments.body');
        expect(m.risk!.terms.map((t) => t.term)).toContain('columns');
        expect(m.risk!.total).toBe(m.risk!.terms.reduce((n, t) => n + t.contribution, 0));
    });

    it('Agent: exactly the verbs the CLI routes, each MCP tool named exists', () => {
        const routed = cliVerbs(path.resolve(__dirname, '../../src/scripts/code_graph'));
        expect(areas.agent!.verbs.map((v) => v.name)).toEqual(AGENT_VERBS.filter((v) => routed.has(v.name)).map((v) => v.name));
        expect(areas.agent!.verbs.map((v) => v.name)).toEqual(expect.arrayContaining(['query', 'explain', 'impact', 'review-risk']));
        for (const v of areas.agent!.verbs) if (v.mcp) expect(Object.keys(GRAPH_TOOLS), v.name).toContain(v.mcp.split(' ')[0]);
        expect(cliVerbs(os.tmpdir()).size).toBe(0);
    });
});

describe('tours are templates over facts', () => {
    it('walk entry, flow and data; a step turns stale when its input fact changes', async () => {
        const tour = areas.tours!.find((t) => t.steps.some((s) => s.area === 'data'))!;
        expect(tour.steps.map((s) => s.area)).toEqual(['code', 'code', 'data', 'delivery']);
        expect(tour.steps.every((s) => s.state === 'fresh')).toBe(true);
        const { graph } = await buildFromRepo(root, null, { lanes: true });
        const flow = graph.nodes.find((n) => n.kind === 'flow' && tour.title === `Follow ${n.label}`)!;
        const changed: CodeGraph = { ...graph, nodes: graph.nodes.map((n) => (n.id === flow.id ? { ...n, fact: { ...n.fact!, attrs: { ...n.fact!.attrs, tables: ['comments', 'invoices'] } } } : n)) };
        const again = produceAreas(root, changed, { previousTours: areas.tours!, hunks: [] }).areas.tours!.find((t) => t.id === tour.id)!;
        expect(again.steps.map((s) => s.state)).toEqual(['fresh', 'fresh', 'stale', 'fresh']);
        const same = produceAreas(root, graph, { previousTours: areas.tours!, hunks: [] }).areas.tours!.find((t) => t.id === tour.id)!;
        expect(same.steps.every((s) => s.state === 'fresh')).toBe(true);
    }, 60_000);
});

describe('the intended against the actual schema', () => {
    it('overlays the snapshot on the migrations, a missing column as null', async () => {
        const dir = tmp('map-data-');
        fs.cpSync(path.join(FX, 'data/drift'), dir, { recursive: true });
        const { graph } = await buildFromRepo(dir, null, { lanes: true });
        const d = produceAreas(dir, graph, { hunks: [] }).areas.data!;
        const orders = d.tables.find((t) => t.name === 'orders')!;
        expect(orders.columns.find((c) => c.name === 'note')?.actual).toBeNull();
        expect(orders.columns.find((c) => c.name === 'shop_id')?.actual).toMatchObject({ type: 'integer', witness: { file: 'agents/map/data/snapshot/default.sql' } });
        expect(d.tables.find((t) => t.name === 'order_items')!.columns.every((c) => c.actual === undefined)).toBe(true);
        expect(d.actualSources).toEqual(['agents/map/data/oracle/Coupon.json', 'agents/map/data/snapshot/default.sql']);
        expect(new Set(d.findings.map((f) => f.id))).toEqual(new Set(['DR-1', 'DR-2', 'DR-5', 'DR-6', 'DR-7', 'DR-8', 'DR-9', 'DR-10', 'DR-11', 'DR-12', 'DR-13']));
        expect(areaProblems({ data: d })).toEqual([]);
    });

    it('an area no lane ran for is left out', async () => {
        const dir = tmp('map-none-');
        fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1;\n');
        const { graph } = await buildFromRepo(dir, null);
        const a = produceAreas(dir, graph, { hunks: [] }).areas;
        expect(Object.keys(a).sort()).toEqual(['agent', 'impact']);
        expect(a.impact?.empty).toMatch(/no change/);
    });
});

describe('after refresh --touched, a redraw reads the working-tree overlay', () => {
    it('shows an uncommitted new column as added, without rebuilding the graph', async () => {
        const dir = tmp('map-overlay-');
        fs.cpSync(path.join(FX, 'correctness/p1-blog'), dir, { recursive: true });
        fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
        git(dir, 'init', '-q');
        git(dir, 'add', '-A');
        git(dir, 'commit', '-qm', 'base');
        const first = await buildMap(dir);
        expect(first.graphBuilt).toBe(true);
        const mig = 'database/migrations/2024_01_01_000003_create_comments_table.php';
        const p = path.join(dir, mig);
        fs.writeFileSync(p, fs.readFileSync(p, 'utf-8').replace("$table->text('body');", "$table->text('body');\n            $table->string('mood')->nullable();"));
        const stdout = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            expect(await cli(['refresh', '--touched', mig, '--root', dir])).toBe(0);
        } finally {
            process.stdout.write = stdout;
        }
        const second = await buildMap(dir);
        expect(second.graphBuilt).toBe(false);
        const a = (JSON.parse(fs.readFileSync(path.join(second.outDir, 'code', 'map.json'), 'utf-8')) as { areas: MapAreas }).areas;
        const mood = a.data!.tables.find((t) => t.name === 'comments')!.columns.find((c) => c.name === 'mood');
        expect(mood).toMatchObject({ type: 'varchar', nullable: true, witness: { file: mig, confirm: 'added' } });
        expect(a.data!.tables.find((t) => t.name === 'comments')!.columns.find((c) => c.name === 'body')?.witness.confirm).toBe('unconfirmed');
    }, 120_000);
});

describe('the page shows each area', () => {
    it('renders the facts of every area in the browser', async () => {
        const { chromium } = await import('@playwright/test');
        browser = await chromium.launch({ headless: true });
        const html = pathToFileURL(path.join(outDir, 'index.html')).href;
        const expectations: Array<[string, string]> = [
            ['data', 'comments'],
            ['data/findings', 'comments.post_id'],
            ['interfaces', 'partner'],
            ['runtime', areas.runtime!.resources[0]!.name],
            ['delivery', 'deploy'],
            ['impact', 'comments.body'],
            ['agent', 'review-risk'],
        ];
        for (const [hash, text] of expectations) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(String(e)));
            await page.goto(`${html}#/${hash}`);
            await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
            expect(await page.locator('#av').innerText(), hash).toContain(text);
            expect(errors, hash).toEqual([]);
            await page.close();
        }
    }, 120_000);
});
