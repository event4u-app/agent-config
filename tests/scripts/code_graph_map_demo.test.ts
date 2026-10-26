import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/code_graph/cli.js';
import { buildMap, type MapMeta } from '../../src/scripts/code_graph/map.js';
import { buildDemoMap, DEMO_FIXTURE, demoOutDir, materialiseDemoRepo, type DemoResult } from '../../src/scripts/code_graph/map_demo.js';
import { KNOWLEDGE_AREA_IDS, type MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { generateDemoLoad, generateHubProjects } from '../../src/scripts/code_graph/demo/map_demo_generate.js';

// `map --demo`: the demo fixture goes through the real build and map writer,
// every area has data, only the demo carries the sample-data flag, and nothing
// lands in the user-global home.

const tmps: string[] = [];
function tmpDir(prefix: string): string {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    tmps.push(d);
    return d;
}

interface Drawn {
    meta: MapMeta;
    model: { files: Array<{ path: string; churn?: number; owners?: Array<[string, number]> }>; areas: Array<{ kind: string }> };
    areas: MapAreas;
}
const readMapJson = (dir: string): Drawn => JSON.parse(fs.readFileSync(path.join(dir, 'code', 'map.json'), 'utf-8')) as Drawn;
const pageData = (html: string): { meta: MapMeta; areas: Record<string, unknown> } =>
    JSON.parse(/<script type="application\/json" id="map-data">(.*?)<\/script>/s.exec(fs.readFileSync(html, 'utf-8'))?.[1] ?? '{}') as { meta: MapMeta; areas: Record<string, unknown> };

let savedHome: string | undefined;
let sandboxHome: string;
let root: string;
let demo: DemoResult;

beforeAll(async () => {
    savedHome = process.env['EVENT4U_CONFIG_HOME'];
    // The home the demo must leave alone: it would be the user's own.
    sandboxHome = path.join(tmpDir('cg-demo-home-'), 'home');
    process.env['EVENT4U_CONFIG_HOME'] = sandboxHome;
    root = tmpDir('cg-demo-root-');
    fs.mkdirSync(path.join(root, 'agents'));
    demo = await buildDemoMap(root);
}, 180_000);
afterAll(() => {
    if (savedHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedHome;
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

describe('the demo map', () => {
    it('lands in the root\'s gitignored .build/demo/, with the hub beside it', () => {
        expect(demo.outDir).toBe(demoOutDir(root));
        expect(demo.outDir).toBe(path.join(root, 'agents', 'map', '.build', 'demo'));
        for (const f of ['index.html', 'MAP.md', 'manifest.json', 'code/map.json', 'hub/index.html', 'hub/projects/hub.json']) {
            expect(fs.existsSync(path.join(demo.outDir, f)), f).toBe(true);
        }
        expect(fs.existsSync(path.join(demo.outDir, '.build'))).toBe(false);
        expect(fs.existsSync(path.join(demo.outDir, 'hub', '.build'))).toBe(false);
    });

    it('carries the demo flag and the chip, on the project map and on the hub', () => {
        expect(readMapJson(demo.outDir).meta.demo).toBe(true);
        for (const html of [demo.page, demo.hubPage]) {
            expect(pageData(html).meta.demo).toBe(true);
            expect(fs.readFileSync(html, 'utf-8')).toContain('id="pin-demo"');
        }
    });

    it('has a payload with data for every knowledge area, under load', () => {
        const { model, areas } = readMapJson(demo.outDir);
        for (const id of KNOWLEDGE_AREA_IDS) {
            const p = areas[id] as { empty?: string } | undefined;
            expect(p, id).toBeDefined();
            expect(p?.empty, id).toBeUndefined();
        }
        expect(model.files.length).toBeGreaterThanOrEqual(2000);
        expect(model.areas.length).toBeGreaterThanOrEqual(120);
        const data = areas.data as unknown as { tables: Array<{ name: string; connection?: string }>; findings: Array<{ id: string }> };
        expect(data.tables.length).toBeGreaterThanOrEqual(60);
        expect(new Set(data.tables.map((t) => t.connection)).size).toBeGreaterThanOrEqual(3);
        expect(data.findings.filter((f) => f.id.startsWith('DR-')).length).toBeGreaterThanOrEqual(24);
        const interfaces = areas.interfaces as unknown as { services: Array<{ protocol: string; operations: unknown[] }>; findings: Array<{ id: string }> };
        expect(interfaces.services.length).toBeGreaterThanOrEqual(25);
        expect(interfaces.services.reduce((n, s) => n + s.operations.length, 0)).toBeGreaterThanOrEqual(150);
        expect(new Set(interfaces.services.map((s) => s.protocol))).toEqual(new Set(['rest', 'soap', 'graphql', 'grpc', 'sdk']));
        expect(interfaces.findings.some((f) => f.id.startsWith('IF-'))).toBe(true);
        const runtime = areas.runtime as unknown as { services: unknown[]; resources: unknown[]; environments: string[] };
        expect(runtime.services.length).toBeGreaterThanOrEqual(30);
        expect(runtime.resources.length).toBeGreaterThanOrEqual(80);
        expect(runtime.environments).toEqual(expect.arrayContaining(['dev', 'staging', 'prod']));
        const delivery = areas.delivery as unknown as { workflows: unknown[]; jobs: unknown[]; findings: Array<{ id: string }> };
        expect(delivery.workflows.length).toBeGreaterThanOrEqual(20);
        expect(delivery.jobs.length).toBeGreaterThanOrEqual(100);
        expect(delivery.findings.some((f) => f.id.startsWith('DL-'))).toBe(true);
    });

    it('reads the scripted history and the working change', () => {
        const { meta, model, areas } = readMapJson(demo.outDir);
        expect(meta.state).toBe('edited');
        const authors = new Set(model.files.flatMap((f) => (f.owners ?? []).map((o) => o[0])));
        expect(authors.size).toBeGreaterThanOrEqual(8);
        expect(model.files.filter((f) => (f.owners?.length ?? 0) > 1).length).toBeGreaterThan(50);
        expect(model.files.some((f) => (f.churn ?? 0) >= 20)).toBe(true);
        const impact = areas.impact as unknown as { changed: string[] };
        expect(impact.changed.length).toBeGreaterThanOrEqual(18);
        expect(impact.changed).toEqual(expect.arrayContaining(['app/Services/PartnerClient.php', '.github/workflows/ci.yml', 'deploy/shop/compose.yaml', 'infra/envs/prod/main.tf']));
    });

    it('draws the hub from at least ten projects with package, call and shared links', () => {
        const hub = JSON.parse(fs.readFileSync(path.join(demo.outDir, 'hub', 'projects', 'hub.json'), 'utf-8')) as {
            projects: Array<{ name: string; page: string | null }>;
            edges: Array<{ via: string }>;
            calls: Array<{ match?: unknown }>;
            ports: unknown[];
        };
        expect(hub.projects.length).toBeGreaterThanOrEqual(10);
        expect(hub.projects.map((p) => p.name)).toEqual(expect.arrayContaining(['alpha', 'beta', 'demo-shop']));
        expect(hub.projects.every((p) => p.page !== null && fs.existsSync(path.join(demo.outDir, 'hub', p.page)))).toBe(true);
        expect(hub.edges.some((e) => e.via === 'package')).toBe(true);
        expect(hub.calls.some((c) => c.match)).toBe(true);
        expect(hub.ports.length).toBeGreaterThan(0);
    });

    it('writes nothing into the user-global home and restores it', () => {
        expect(process.env['EVENT4U_CONFIG_HOME']).toBe(sandboxHome);
        expect(fs.existsSync(sandboxHome)).toBe(false);
    });
});

describe('a real map', () => {
    it('has no demo flag and no chip', async () => {
        const r = tmpDir('cg-demo-real-');
        fs.mkdirSync(path.join(r, 'agents'));
        fs.writeFileSync(path.join(r, 'a.ts'), 'export const a = 1;\n');
        fs.writeFileSync(path.join(r, 'b.ts'), "import { a } from './a';\nexport const b = a;\n");
        const res = await buildMap(r);
        expect(res.meta.demo).toBeUndefined();
        expect(readMapJson(res.outDir).meta.demo).toBeUndefined();
        const html = path.join(res.outDir, 'index.html');
        expect(pageData(html).meta.demo).toBeUndefined();
        expect(fs.readFileSync(html, 'utf-8')).not.toContain('id="pin-demo"');
    }, 60_000);
});

describe('guards', () => {
    let out: string[];
    beforeEach(() => {
        out = [];
        const sink = (s: string | Uint8Array): boolean => {
            out.push(String(s));
            return true;
        };
        vi.spyOn(process.stdout, 'write').mockImplementation(sink);
        vi.spyOn(process.stderr, 'write').mockImplementation(sink);
    });
    afterEach(() => vi.restoreAllMocks());

    it('refuses an --out directory that holds something other than a map', async () => {
        const dir = tmpDir('cg-demo-out-');
        fs.writeFileSync(path.join(dir, 'notes.md'), '# mine\n');
        expect(await main(['map', '--demo', '--root', root, '--out', dir, '--no-verify'])).toBe(1);
        expect(out.join('')).toContain('refusing to write the demo map');
        expect(fs.readdirSync(dir)).toEqual(['notes.md']);
    });

    it('rewrites an --out directory that already holds a map, through the CLI', async () => {
        const dir = tmpDir('cg-demo-out2-');
        expect(await main(['map', '--demo', '--root', root, '--out', dir, '--no-verify'])).toBe(0);
        expect(await main(['map', '--demo', '--root', root, '--out', dir, '--no-verify'])).toBe(0);
        expect(readMapJson(dir).meta.demo).toBe(true);
        expect(out.join('')).toContain('code-graph map --demo');
    }, 300_000);

    it('fails loudly when a history step or the working change no longer matches the fixture', () => {
        const a = tmpDir('cg-demo-step-');
        expect(() => materialiseDemoRepo(DEMO_FIXTURE, path.join(a, 'r'), [{ author: { name: 'x', email: 'x@example.com' }, message: 'gone', paths: ['no/such/dir/'] }])).toThrow(/matches no fixture file/);
        const fixture = path.join(tmpDir('cg-demo-fx-'), 'fx');
        fs.cpSync(DEMO_FIXTURE, fixture, { recursive: true });
        fs.writeFileSync(path.join(fixture, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
        expect(() => materialiseDemoRepo(fixture, path.join(a, 'r2'), undefined, { load: false })).toThrow(/no longer contains its anchor/);
    }, 60_000);
});

describe('the load generator', () => {
    it('is deterministic for a seed and differs for another', () => {
        const flat = (seed: number): string => JSON.stringify(generateDemoLoad(seed).commits.map((c) => [c.author.name, c.message, Object.keys(c.files), Object.values(c.files)]));
        expect(flat(7)).toBe(flat(7));
        expect(JSON.stringify(generateHubProjects(7))).toBe(JSON.stringify(generateHubProjects(7)));
        expect(JSON.stringify(generateHubProjects(7))).not.toBe(JSON.stringify(generateHubProjects(8)));
    });

    it('writes at least 200 commits by at least 8 authors, 25 decision records and a working change across layers', () => {
        const load = generateDemoLoad();
        expect(load.commits.length).toBeGreaterThanOrEqual(200);
        expect(new Set(load.commits.map((c) => c.author.email)).size).toBeGreaterThanOrEqual(8);
        const files = load.commits.flatMap((c) => Object.keys(c.files));
        expect(files.filter((f) => /^docs\/decisions\/ADR-\d+/.test(f)).length).toBeGreaterThanOrEqual(25);
        expect(files.length).toBeGreaterThanOrEqual(2000);
        const touched = load.working.map((w) => w.file);
        for (const prefix of ['app/Modules/', 'database/migrations/', 'app/Integrations/', '.github/workflows/', 'deploy/', 'infra/']) {
            expect(touched.some((f) => f.startsWith(prefix)), prefix).toBe(true);
        }
    });
});
