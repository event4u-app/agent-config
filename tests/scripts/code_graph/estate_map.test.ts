import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/code_graph/cli.js';
import { estateMapDir, renderHub, type HubPayload } from '../../../src/scripts/code_graph/estate_map.js';
import { hubDir } from '../../../src/scripts/code_graph/graph_home.js';
import { verifyMap } from '../../../src/scripts/code_graph/map_verify.js';
import { makeEstate } from './estate_fixture.js';

let tmp: string;
let saved: string | undefined;
let out: string[];

async function cg(...argv: string[]): Promise<number> {
    out = [];
    return main(argv);
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-estate-map-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    out = [];
    const sink = (s: string | Uint8Array): boolean => {
        out.push(String(s));
        return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(sink);
    vi.spyOn(process.stderr, 'write').mockImplementation(sink);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

async function indexEstate(): Promise<ReturnType<typeof makeEstate>> {
    const e = makeEstate(tmp, 2);
    expect(await cg('projects', 'index', 'on')).toBe(0);
    for (const r of [e.core, e.app, e.billing]) expect(await cg('build', '--root', r)).toBe(0);
    return e;
}

function hubData(): { payload: HubPayload; shell: { routes: string[]; home: string } } {
    const html = fs.readFileSync(path.join(estateMapDir(), 'index.html'), 'utf-8');
    const json = /<script type="application\/json" id="map-data">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}';
    const data = JSON.parse(json) as { areas: { projects: HubPayload }; shell: { routes: string[]; home: string } };
    return { payload: data.areas.projects, shell: data.shell };
}

describe('the hub (5.11): the estate on the shared shell', () => {
    it('writes the hub layout under the user-global map/, package links solid and guesses dashed', async () => {
        await indexEstate();
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        expect(estateMapDir()).toBe(hubDir());
        const own = fs.readdirSync(estateMapDir()).filter((e) => ['index.html', 'manifest.json', 'projects', '.build'].includes(e));
        expect(own.sort()).toEqual(['.build', 'index.html', 'manifest.json', 'projects']);
        expect(fs.existsSync(path.join(estateMapDir(), 'projects', 'hub.json'))).toBe(true);
        const { payload, shell } = hubData();
        expect(shell).toMatchObject({ routes: ['projects'], home: 'projects' });
        expect(payload.projects).toHaveLength(3);
        expect(payload.projects.every((p) => p.indexed && p.name !== '')).toBe(true);
        expect(payload.edges.some((e) => e.via === 'package')).toBe(true);
        expect(payload.edges.some((e) => e.via === 'unique-name')).toBe(true);
        const html = fs.readFileSync(path.join(estateMapDir(), 'index.html'), 'utf-8');
        expect(html).toContain('href="#/projects"');
        expect(html).not.toContain('href="#/code"');
        expect(html).toMatch(/line\.pe-package \{[^}]*stroke-width: 2\.5px;[^}]*\}/);
        expect(html).not.toMatch(/line\.pe-package \{[^}]*stroke-dasharray/);
        expect(html).toMatch(/line\.pe-unique-name \{[^}]*stroke-dasharray/);
        expect(html).not.toMatch(/(src|href)="https?:/);
        const manifest = JSON.parse(fs.readFileSync(path.join(estateMapDir(), 'manifest.json'), 'utf-8')) as { kind: string; areas: { projects: { path: string; projects: number } } };
        expect(manifest).toMatchObject({ kind: 'hub', areas: { projects: { path: 'projects/hub.json', projects: 3 } } });
    }, 120_000);

    it('links each project to its own page in the hub: a graph home, or a mirror of the project\'s agents/map/', async () => {
        const e = makeEstate(tmp, 1);
        fs.mkdirSync(path.join(e.app, 'agents'));
        for (const r of [e.core, e.app]) expect(await cg('build', '--root', r)).toBe(0);
        expect(await cg('map', '--root', e.core, '--no-verify')).toBe(0);
        expect(await cg('map', '--root', e.app, '--no-verify')).toBe(0);
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        const { payload } = hubData();
        expect(payload.projects).toHaveLength(2);
        for (const p of payload.projects) {
            expect(p.page, p.name).toBe(`${p.id}/index.html`);
            expect(fs.existsSync(path.join(estateMapDir(), p.page as string))).toBe(true);
        }
        const app = payload.projects.find((p) => fs.existsSync(path.join(estateMapDir(), p.id, 'code', 'map.json')) && !fs.existsSync(path.join(estateMapDir(), p.id, '.build')));
        expect(app, 'the project-home map is mirrored without its .build/').toBeDefined();
        expect(payload.edgesReason).toMatch(/estate index is off/);
    }, 120_000);

    it('renders an empty machine with the reason, not a blank page', async () => {
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        const { payload } = hubData();
        expect(payload.projects).toEqual([]);
        expect(payload.empty).toMatch(/no project is registered/);
    });

    it('passes the map render check on its Projects route', async () => {
        await indexEstate();
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        const check = await verifyMap(path.join(estateMapDir(), 'index.html'), { hash: '#/projects' });
        // This estate shares no port, image, service or call: the labels are one box per project and one per link.
        const { payload } = hubData();
        expect(payload.ports.length + payload.images.length + payload.services.length + payload.calls.length).toBe(0);
        const labels = payload.projects.length + payload.edges.length;
        expect(check.verification, JSON.stringify(check)).not.toBe('failed');
        if (check.verification === 'verified') {
            expect(check.viewports.map((v) => v.name)).toEqual(['desktop', 'mobile-375', 'mobile-320']);
            for (const v of check.viewports) {
                expect(v.pageErrors + v.externalRequests).toBe(0);
                expect(v.horizontalScroll).toBe(false);
                expect(v.views.every((x) => x.labels === labels && x.outside === 0 && x.overlapping === 0)).toBe(true);
            }
        }
    }, 180_000);

    it('is refused inside a git work tree, for --out and for a home that sits in one', async () => {
        await indexEstate();
        const repo = path.join(tmp, 'some-repo');
        fs.mkdirSync(repo);
        execFileSync('git', ['-C', repo, 'init', '-q']);
        expect(await cg('map', '--estate', '--out', path.join(repo, 'estate'), '--no-verify')).toBe(1);
        expect(out.join('')).toMatch(/refusing to write the estate map inside a git work tree/);
        expect(fs.existsSync(path.join(repo, 'estate'))).toBe(false);
        process.env.EVENT4U_CONFIG_HOME = path.join(repo, 'home');
        expect(await cg('map', '--estate', '--no-verify')).toBe(1);
        expect(fs.existsSync(path.join(repo, 'home', 'map', 'index.html'))).toBe(false);
    }, 120_000);

    it('renders a hostile project name as data', () => {
        const payload: HubPayload = {
            reader: 'hub',
            completeness: 'complete',
            findings: [],
            projects: [{ id: 'a'.repeat(12), name: '</script><img src=x onerror=alert(1)>', indexed: false, page: null }],
            edges: [],
            ports: [],
            images: [],
            services: [],
            calls: [],
            skipped: [],
        };
        const html = renderHub(payload);
        expect(html).not.toContain('</script><img');
        expect(html).toContain('\\u003c/script>');
    });
});
