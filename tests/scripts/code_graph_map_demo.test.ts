import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/code_graph/cli.js';
import { buildMap, type MapMeta } from '../../src/scripts/code_graph/map.js';
import { buildDemoMap, DEMO_FIXTURE, demoOutDir, materialiseDemoRepo, type DemoResult } from '../../src/scripts/code_graph/map_demo.js';
import { KNOWLEDGE_AREA_IDS, type MapAreas } from '../../src/scripts/code_graph/map_areas.js';

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
    model: { files: Array<{ path: string; churn?: number; owners?: Array<[string, number]> }> };
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

    it('has a payload with data for every knowledge area', () => {
        const { areas } = readMapJson(demo.outDir);
        for (const id of KNOWLEDGE_AREA_IDS) {
            const p = areas[id] as { empty?: string } | undefined;
            expect(p, id).toBeDefined();
            expect(p?.empty, id).toBeUndefined();
        }
        const data = areas.data as unknown as { tables: Array<{ name: string }>; findings: Array<{ id: string }> };
        expect(data.tables.length).toBeGreaterThan(5);
        expect(data.findings.some((f) => f.id.startsWith('DR-'))).toBe(true);
        const interfaces = areas.interfaces as unknown as { findings: Array<{ id: string }> };
        expect(interfaces.findings.some((f) => f.id.startsWith('IF-'))).toBe(true);
        const delivery = areas.delivery as unknown as { findings: Array<{ id: string }> };
        expect(delivery.findings.some((f) => f.id.startsWith('DL-'))).toBe(true);
        const runtime = areas.runtime as unknown as { services: unknown[]; resources: unknown[] };
        expect(runtime.services.length).toBeGreaterThan(0);
        expect(runtime.resources.length).toBeGreaterThan(0);
    });

    it('reads the scripted history and the working change', () => {
        const { meta, model, areas } = readMapJson(demo.outDir);
        expect(meta.state).toBe('edited');
        const shared = model.files.filter((f) => (f.owners?.length ?? 0) > 1);
        expect(shared.length).toBeGreaterThan(0);
        expect(model.files.some((f) => (f.churn ?? 0) >= 3)).toBe(true);
        const impact = areas.impact as unknown as { changed: string[] };
        expect(impact.changed).toEqual(expect.arrayContaining(['app/Services/PartnerClient.php', '.github/workflows/ci.yml']));
    });

    it('draws the hub from three fixture projects', () => {
        const hub = JSON.parse(fs.readFileSync(path.join(demo.outDir, 'hub', 'projects', 'hub.json'), 'utf-8')) as { projects: Array<{ name: string; page: string | null }>; ports: unknown[] };
        expect(hub.projects.map((p) => p.name).sort()).toEqual(['alpha', 'beta', 'demo-shop']);
        expect(hub.projects.every((p) => p.page !== null && fs.existsSync(path.join(demo.outDir, 'hub', p.page)))).toBe(true);
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
    }, 120_000);

    it('fails loudly when a history step or the working change no longer matches the fixture', () => {
        const a = tmpDir('cg-demo-step-');
        expect(() => materialiseDemoRepo(DEMO_FIXTURE, path.join(a, 'r'), [{ author: { name: 'x', email: 'x@example.com' }, message: 'gone', paths: ['no/such/dir/'] }])).toThrow(/matches no fixture file/);
        const fixture = path.join(tmpDir('cg-demo-fx-'), 'fx');
        fs.cpSync(DEMO_FIXTURE, fixture, { recursive: true });
        fs.writeFileSync(path.join(fixture, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
        expect(() => materialiseDemoRepo(fixture, path.join(a, 'r2'))).toThrow(/no longer contains its anchor/);
    }, 60_000);
});
