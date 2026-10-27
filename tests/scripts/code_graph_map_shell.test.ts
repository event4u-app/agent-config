import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type HubPayload, renderHub } from '../../src/scripts/code_graph/estate_map.js';
import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';
import { KNOWLEDGE_AREA_IDS, type MapAreas, type RuntimePayload } from '../../src/scripts/code_graph/map_areas.js';
import { sampleAreas, wit } from './code_graph_map_areas_fixture.js';

// The shell around the areas: routing, the area pages with and without a
// payload, search over every kind, the freshness reason, both languages, and
// the page at every width in both themes.

// The Overview draws the design's nine layer cards: Code, Database, Integrations,
// Environment, CI/CD, Infrastructure, Knowledge, Impact and Projects.
const OVERVIEW_LAYERS = 11;

let browser: Browser;
let empty: string;
let full: string;
let behind: string;
const roots: string[] = [];

async function drawn(areas?: MapAreas): Promise<{ html: string; dir: string }> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-shell-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
    fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
    const res = await buildMap(root, areas ? { areas } : {});
    return { html: path.join(res.outDir, 'index.html'), dir: res.outDir };
}

async function open(html: string, hash = '', opts: { width?: number; height?: number; scheme?: 'light' | 'dark' } = {}): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 }, colorScheme: opts.scheme ?? 'dark' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(html).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}
const route = (page: Page): Promise<{ route: string; item: string }> =>
    page.evaluate(() => (window as unknown as { __mapRoute: { route: string; item: string } }).__mapRoute);

beforeAll(async () => {
    // No reader ran for any knowledge area: the map is drawn with an empty areas section.
    empty = (await drawn({})).html;
    const f = await drawn(sampleAreas());
    full = f.html;
    // The same map, drawn while the graph is three commits behind HEAD.
    const doc = JSON.parse(fs.readFileSync(path.join(f.dir, 'code', 'map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0]; areas: MapAreas };
    doc.model.pin = { ...(doc.model.pin ?? { commit: '', date: '', generation: '' }), freshness: 'behind:3' };
    behind = path.join(f.dir, 'behind.html');
    fs.writeFileSync(behind, renderHtml(doc.model, { ...doc.meta, state: 'behind:3' }, doc.areas));
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('the router', () => {
    it('opens the map home, Overview, without a hash or with an unknown one, and the nav switches areas', async () => {
        const page = await open(empty);
        expect((await route(page)).route).toBe('overview');
        expect(await page.locator('#wb').isVisible()).toBe(false);
        expect(await page.locator('#av').isVisible()).toBe(true);
        expect(await page.locator('.ocard').count()).toBe(OVERVIEW_LAYERS);
        expect(await page.locator('#areanav a[data-route="overview"]').getAttribute('aria-current')).toBe('page');
        await page.click('#areanav a[data-route="code"]');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'code');
        expect(await page.locator('#wb').isVisible()).toBe(true);
        expect(await page.locator('#areanav a[data-route="code"]').getAttribute('aria-current')).toBe('page');
        await page.click('#areanav a[data-route="data"]');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'data');
        expect(await page.locator('#wb').isVisible()).toBe(false);
        expect(await page.locator('#areanav a[data-route="data"]').getAttribute('aria-current')).toBe('page');
        await page.close();
        const odd = await open(empty, '#/nowhere');
        expect((await route(odd)).route).toBe('overview');
        await odd.close();
        const projects = await open(empty, '#/projects');
        expect((await route(projects)).route).toBe('overview');
        expect(await projects.locator('#areanav a[data-route="projects"]').count()).toBe(0);
        await projects.close();
    });

    it('the Code breadcrumb starts at the repository, the nav leads home', async () => {
        const page = await open(empty, '#/code');
        expect((await page.locator('#crumbs button').first().textContent())?.trim()).toBe('Repo');
        await page.click('#areanav a[data-route="overview"]');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'overview');
        expect(await page.locator('.ocard').count()).toBe(OVERVIEW_LAYERS);
        await page.close();
    });
});

describe('the shell of the 2026-10-bf handover', () => {
    it('nav order: eleven routes, Bugs and Wissen before Impact, no-data entries carry the handover title', async () => {
        const page = await open(full, '#/overview');
        const nav = await page.evaluate(() => Array.from(document.querySelectorAll('#areanav a')).map((a) => ({ r: a.getAttribute('data-route'), text: a.textContent, title: a.getAttribute('title'), empty: a.classList.contains('empty') })));
        expect(nav.map((n) => n.r)).toEqual(['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'bugs', 'knowledge', 'impact', 'agent']);
        expect(nav.find((n) => n.r === 'bugs')).toMatchObject({ text: 'Bugs', empty: true, title: 'Bug data is local – never in the committed map' });
        for (const n of nav) {
            if (n.r === 'overview' || n.r === 'code') expect(n.title, n.r!).toBeNull();
            else if (n.empty && n.r !== 'bugs') expect(n.title, n.r!).toBe('no data yet in the real map');
            else if (!n.empty) expect(n.title, n.r!).toBeNull();
        }
        await page.close();
        const de = await browser.newPage({ locale: 'de-DE', colorScheme: 'dark' });
        await de.goto(pathToFileURL(empty).href + '#/bugs');
        await de.waitForFunction(() => (window as unknown as { __mapRoute?: { route: string } }).__mapRoute?.route === 'bugs');
        expect(await de.locator('#areanav a[data-route="knowledge"]').textContent()).toBe('Wissen');
        expect(await de.locator('#areanav a[data-route="bugs"]').getAttribute('title')).toBe('Bug-Daten sind lokal – nie in der committeten Map');
        expect(await de.locator('#areanav a[data-route="data"]').getAttribute('title')).toBe('noch keine Daten in der echten Map');
        expect(await de.locator('#nodata-bugs').isVisible()).toBe(true);
        await de.close();
    });

    it('header chips: "built at" commit chip, lowercase freshness, amber when behind, the snapshot chip in a committed map', async () => {
        const page = await open(full, '#/overview');
        const pin = await page.evaluate(() => (JSON.parse(document.getElementById('map-data')!.textContent!) as { model: { pin: { commit: string; generation: string } } }).model.pin);
        expect(await page.locator('#pin-commit').textContent()).toMatch(new RegExp(`^built at ${pin.commit.slice(0, 8)}( · \\d+/\\d+)?$`));
        expect(await page.locator('#pin-commit').getAttribute('title')).toBe(`Map drawn at ${pin.commit.slice(0, 12)} · Generation ${pin.generation.slice(0, 16)}`);
        expect(await page.locator('#pin-fresh').textContent()).toBe('fresh');
        expect(await page.locator('#pin-snap').isVisible()).toBe(true);
        expect(await page.locator('#pin-snap').textContent()).toBe('Snapshot · no branch state');
        expect(await page.locator('#pin-snap').getAttribute('title')).toContain('code-graph map --branches');
        expect(await page.locator('#pin-snap').evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('dashed');
        await page.close();
        const late = await open(behind, '#/overview');
        expect(await late.locator('#pin-fresh').textContent()).toBe('behind:3');
        const tint = await late.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--amberTint').trim());
        expect(await late.locator('#pin-fresh').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(tint.replace(/\s+/g, '').replace(/,/g, ', '));
        await late.close();
        const de = await browser.newPage({ locale: 'de-DE', colorScheme: 'dark' });
        await de.goto(pathToFileURL(full).href + '#/overview');
        await de.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
        expect(await de.locator('#pin-commit').textContent()).toMatch(/^gebaut bei \S+/);
        expect(await de.locator('#pin-snap').textContent()).toBe('Snapshot · ohne Branch-Stand');
        await de.close();
    });
});

describe('the provenance footer', () => {
    it('provenance: every page names its source file and the commit, German wording, none on the hub', async () => {
        const page = await browser.newPage({ locale: 'de-DE', colorScheme: 'dark' });
        await page.goto(pathToFileURL(full).href + '#/overview');
        await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
        const sha = await page.evaluate(() => String((JSON.parse(document.getElementById('map-data')!.textContent!) as { model: { pin: { commit: string } } }).model.pin.commit).slice(0, 8));
        const want: Record<string, string> = { overview: 'manifest.json + code/map.json', data: 'data.json', systems: 'systems.json', interfaces: 'interfaces.json', runtime: 'runtime.json', delivery: 'delivery.json + runtime.json', impact: 'code/map.json → areas.impact', agent: 'code/map.json → areas.agent', knowledge: 'map.json', bugs: 'agents/map' };
        for (const [r, src] of Object.entries(want)) {
            await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
            await page.waitForFunction((x) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === x, r);
            const text = (await page.locator('#prov').textContent()) ?? '';
            expect(text, r).toMatch(new RegExp(`^Echte Daten · ${src.replace(/[.+]/g, '\\$&')} @ ${sha}`));
            expect(await page.locator('#prov').evaluate((e) => getComputedStyle(e).fontSize)).toBe('11px');
        }
        await page.evaluate(() => { location.hash = '#/bugs'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'bugs');
        expect(await page.locator('#prov').textContent()).toBe(`Echte Daten · agents/map @ ${sha} · keine Bug-Lane`);
        await page.close();
    });
});

describe('an area without data is shown, says so and names the reason', () => {
    it('every knowledge area with no reader run', async () => {
        const page = await open(empty, '#/overview');
        // The agent area's verb list is written on every map, so only the others can be without a reader.
        const written = await page.evaluate(() => Object.keys((JSON.parse(document.getElementById('map-data')!.textContent!) as { areas: object }).areas));
        const unread = KNOWLEDGE_AREA_IDS.filter((id) => !written.includes(id));
        expect(unread.length).toBeGreaterThanOrEqual(KNOWLEDGE_AREA_IDS.length - 1);
        for (const id of unread) {
            expect(await page.locator(`#areanav a[data-route="${id}"]`).getAttribute('class')).toContain('empty');
            await page.evaluate((r) => { location.hash = `#/${r}`; }, id);
            await page.waitForFunction((r) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === r, id);
            const card = page.locator(`#nodata-${id}`);
            expect(await card.isVisible()).toBe(true);
            const text = (await card.textContent()) ?? '';
            expect(text).toMatch(/No data yet/);
            expect(text).toMatch(/(reader ran|was written)/);
            expect(await page.locator('#av-side').isVisible()).toBe(false);
        }
        await page.close();
    });

    it('a reader that ran and found nothing says what it found', async () => {
        const page = await open(full, '#/runtime');
        const text = (await page.locator('#nodata-runtime').textContent()) ?? '';
        expect(text).toContain('compose ran and found nothing');
        expect(text).toContain('no compose file in this tree');
        await page.close();
    });
});

describe('an area with a payload renders its facts with their witnesses', () => {
    it('data: tables, keys, an item with its witness and confirm state, and the way back', async () => {
        const page = await open(full, '#/data');
        expect(await page.locator('#nodata-data').count()).toBe(0);
        const main = (await page.locator('#av-main').textContent()) ?? '';
        expect(main).toContain('users');
        expect(main).toContain('comments');
        expect(await page.locator('#av-main .av-head .av-barmeta .st').getAttribute('title')).toMatch(/partial read — every count is a lower bound/);
        await page.locator('.db-col', { hasText: 'email' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'column/users.email');
        const detail = (await page.locator('#av-right-body').textContent()) ?? '';
        expect(detail).toContain('database/migrations/0001_create_users.php:14');
        expect(detail).toContain('changed');
        expect(await page.locator('#av-right-body .ttl').textContent()).toContain('users.email');
        await page.locator('#av-right-body .deselect').click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === '');
        expect(await page.locator('#av-left-body').textContent()).toContain('DR-1');
        await page.close();
    });

    it('a finding lists both witnesses', async () => {
        const page = await open(full, '#/data/finding%2F0');
        const detail = (await page.locator('#av-right-body').textContent()) ?? '';
        expect(detail).toContain('app/Models/Comment.php:20');
        expect(detail).toContain('database/migrations/0003_create_comments.php:11');
        expect(detail).toMatch(/moved[\s\S]*gone/);
        await page.close();
    });

    it('interfaces, delivery and agent draw their own facts; explain is the graph verb with its CLI', async () => {
        const page = await open(full, '#/interfaces');
        // Interfaces lays out its own rails: the services sit in the left rail, the operations in the centre.
        expect(await page.locator('#av').textContent()).toMatch(/partner[\s\S]*soap[\s\S]*PARTNER_URL/i);
        await page.click('#av [role="tab"]:has-text("Operations")');
        expect(await page.locator('#av').textContent()).toMatch(/partner[\s\S]*GetStock/);
        await page.evaluate(() => { location.hash = '#/delivery'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'delivery');
        expect(await page.locator('#av-main').textContent()).toMatch(/Check[\s\S]*test[\s\S]*Roll out[\s\S]*deploy/);
        await page.evaluate(() => { location.hash = '#/agent'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'agent');
        expect(await page.locator('#av').textContent()).toContain('agent-config code-graph explain <seed>');
        await page.close();
    });
});

describe('the local environment on the Delivery area (DEC-1)', () => {
    const services = (): RuntimePayload => ({
        reader: 'compose',
        completeness: 'complete',
        findings: [],
        environments: [],
        resources: [],
        services: [
            { name: 'web', image: 'nginx:1.25', ports: [{ published: 8080, target: 80 }], networks: ['front'], envNames: ['APP_URL'], witness: wit('docker-compose.yml', 3, 'confirmed') },
            { name: 'api', image: 'node:22', ports: [{ published: 8080, target: 3000 }, { target: 9229 }], networks: ['front'], envNames: [], witness: wit('docker-compose.yml', 9) },
            { name: 'db', image: 'postgres:16', ports: [{ published: 5432, target: 5432 }], networks: [], envNames: ['POSTGRES_DB'], witness: wit('docker-compose.yml', 15) },
        ],
    });

    it('shows Compose services as cards, a host port two of them publish as a conflict, and the service in the rail', async () => {
        const areas = sampleAreas();
        areas.runtime = services();
        const page = await open((await drawn(areas)).html, '#/delivery');
        await page.click('#av-bar [role="tab"]:has-text("Local environment")');
        const tabs = await page.locator('#av-bar [role="tab"]').allTextContents();
        expect(tabs).toEqual(['Local environment', 'CI/CD']);
        const main = (await page.locator('#av-main').textContent()) ?? '';
        expect(main).toMatch(/web[\s\S]*nginx:1\.25[\s\S]*api[\s\S]*db/);
        expect(main).toMatch(/Networks[\s\S]*front · web, api/);
        expect(await page.locator('#av-main .ops-card').count()).toBe(3);
        expect(await page.locator('#av-main .ops-card .st.ops-bad').count()).toBe(2);
        expect(await page.locator('#av-main .ops-card', { hasText: 'db' }).locator('.st.ops-bad').count()).toBe(0);
        expect(await page.locator('#av-bar').textContent()).toMatch(/3 services · 1 network · 1 conflict/);
        // Observed state and health are never read: the elements stay and say so.
        expect(await page.locator('#av-main .ops-card .nodata-tag').count()).toBe(3);
        await page.locator('#av-main .ops-card', { hasText: 'db' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'local/db');
        expect(await page.locator('#av-right-body').textContent()).toMatch(/Compose service[\s\S]*db[\s\S]*docker-compose\.yml:15/);
        // The facts stay where the Runtime reader stored them; Runtime itself shows IaC only.
        await page.evaluate(() => { location.hash = '#/runtime'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'runtime');
        expect(await page.locator('#av-main').textContent()).toMatch(/no Terraform or Kubernetes resource was read/);
        await page.close();
    });

    it('is live with only the local environment when no delivery reader ran', async () => {
        const page = await open((await drawn({ runtime: services() })).html, '#/delivery');
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Local environment']);
        expect(await page.locator('#nodata-delivery').count()).toBe(0);
        expect(await page.locator('#av-main').textContent()).toMatch(/web[\s\S]*8080→80/);
        await page.close();
        const none = await open(empty, '#/delivery');
        expect(await none.locator('#nodata-delivery').isVisible()).toBe(true);
        await none.close();
    });
});

describe('the Runtime page is the design\'s Infrastruktur page', () => {
    const iac = (): RuntimePayload => ({
        reader: 'runtime',
        completeness: 'complete',
        findings: [{ id: 'RT-6', severity: 'medium', subject: 'resource:tf:infra:aws_iam_role.app', message: 'aws_instance.app references aws_iam_role.app, which no file declares', completeness: 'complete', witnesses: [wit('infra/main.tf', 9), wit('infra/main.tf', 3)] }],
        environments: ['shop'],
        resources: [
            { name: 'aws_instance.app', type: 'aws_instance', environments: [], witness: wit('infra/main.tf', 3) },
            { name: 'aws_security_group.web', type: 'aws_security_group', environments: [], witness: wit('infra/main.tf', 12) },
            { name: 'Deployment/api', type: 'Deployment', environments: ['shop'], witness: wit('k8s/app.yaml', 2, 'confirmed') },
        ],
        services: [],
        links: [
            { from: 'aws_instance.app', to: 'aws_security_group.web', relation: 'references', witness: wit('infra/main.tf', 5) },
            { from: 'aws_instance.app', to: 'aws_iam_role.app', relation: 'references', witness: wit('infra/main.tf', 9) },
        ],
    });

    it('zones per folder, the raw switch, the environment grid, and the resource rail with its finding', async () => {
        const page = await open((await drawn({ runtime: iac() })).html, '#/runtime');
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Topology', 'Environment comparison']);
        // The comparison: one column per environment, the stands the map cannot read tagged with why.
        expect(await page.locator('#av-main .ops-th').allTextContents()).toEqual(['Resource', 'shop']);
        expect(await page.locator('#av-main').textContent()).toMatch(/P, R and O need a plan file/);
        await page.click('#av-bar [role="tab"]:has-text("Topology")');
        const zones = await page.locator('#av-main .ops-zone-outer .ops-zname').allTextContents();
        expect(zones.sort()).toEqual(['aws · infra/', 'kubernetes · k8s/']);
        // Cleaned: the security group and its link are hidden; the raw view shows them.
        expect(await page.locator('#av-main .ops-res', { hasText: 'aws_security_group.web' }).count()).toBe(0);
        expect(await page.locator('#av-bar [role="switch"]').getAttribute('aria-checked')).toBe('false');
        expect(await page.locator('#av-bar [role="switch"]').textContent()).toBe('Cleaned · 1 link hidden');
        expect(await page.locator('#av-main .ops-links').textContent()).toMatch(/aws_iam_role\.app \(references\) · declared in no file/);
        await page.click('#av-bar [role="switch"]');
        expect(await page.locator('#av-main .ops-res.raw', { hasText: 'aws_security_group.web' }).count()).toBe(1);
        expect(await page.locator('#av-main .ops-links').textContent()).toMatch(/aws_instance\.app → aws_security_group\.web/);
        // The resource with a finding is picked first and shows it.
        expect(await page.locator('#av-main .ops-res.on').textContent()).toMatch(/aws_instance\.app[\s\S]*drift\?/);
        expect(await page.locator('#av-right-body').textContent()).toMatch(/infra\/main\.tf:3[\s\S]*no data[\s\S]*RT-6/);
        await page.locator('#av-main .ops-res', { hasText: 'Deployment/api' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'resource/Deployment/api');
        expect(await page.locator('#av-right-body').textContent()).toMatch(/Deployment · shop[\s\S]*k8s\/app\.yaml:2[\s\S]*No findings/);
        await page.close();
    });
});

describe('the Delivery CI/CD view judges each job per scenario, never inventing a result', () => {
    const ci = (): NonNullable<MapAreas['delivery']> => ({
        reader: 'delivery',
        completeness: 'complete',
        findings: [{ id: 'DL-3', severity: 'medium', subject: 'environment:.github/workflows/ci.yml#production', message: 'production has no manual gate', completeness: 'complete', witnesses: [wit('.github/workflows/ci.yml', 20)] }],
        workflows: [{ file: '.github/workflows/ci.yml', name: 'CI', triggers: ['push', 'pull_request'], events: [{ event: 'push', branches: ['main'], paths: false }, { event: 'pull_request', branches: [], paths: false }], witness: wit('.github/workflows/ci.yml', 1) }],
        jobs: [
            { id: '.github/workflows/ci.yml#test', workflow: '.github/workflows/ci.yml', name: 'test', needs: [], uses: [], isTest: true, witness: wit('.github/workflows/ci.yml', 8) },
            { id: '.github/workflows/ci.yml#deploy', workflow: '.github/workflows/ci.yml', name: 'deploy', needs: ['.github/workflows/ci.yml#test'], environment: 'production', uses: [], isDeploy: true, witness: wit('.github/workflows/ci.yml', 14) },
            { id: '.github/workflows/ci.yml#gate', workflow: '.github/workflows/ci.yml', name: 'gate', needs: [], uses: [], condition: "vars.ON == 'true'", witness: wit('.github/workflows/ci.yml', 18) },
        ],
        environments: ['production'],
        chain: [],
    });
    const runs = async (page: Page): Promise<Record<string, string>> =>
        Object.fromEntries(await page.locator('#av-main .ops-job').evaluateAll((bs) => bs.map((b) => [b.querySelector('.ops-jname')?.textContent ?? '', b.querySelector('.st')?.textContent ?? ''])));

    it('push → main runs, a tag skips the branch-filtered workflow, a condition is unknown; findings land on the job', async () => {
        const page = await open((await drawn({ delivery: ci() })).html, '#/delivery');
        expect(await page.locator('#av-bar [role="radio"]').allTextContents()).toEqual(['push → main', 'pull_request', 'tag v1.2.0']);
        expect(await runs(page)).toEqual({ test: 'skipped', deploy: 'skipped', gate: 'skipped' });
        await page.click('#av-bar [role="radio"]:has-text("push → main")');
        expect(await page.locator('#av-bar [role="radio"][aria-checked="true"]').textContent()).toBe('push → main');
        expect(await runs(page)).toEqual({ test: 'runs', deploy: 'runs', gate: 'unknown' });
        expect(await page.locator('#av-main').textContent()).toMatch(/Check[\s\S]*test[\s\S]*gate[\s\S]*Production · Clean up[\s\S]*deploy/);
        await page.locator('#av-main .ops-job', { hasText: 'deploy' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'job/.github/workflows/ci.yml#deploy');
        expect(await page.locator('#av-right-body').textContent()).toMatch(/Job · ci\.yml[\s\S]*deploy[\s\S]*push → main[\s\S]*DL-3/);
        await page.click('#av-bar [role="radio"]:has-text("pull_request")');
        expect(await runs(page)).toEqual({ test: 'runs', deploy: 'runs', gate: 'unknown' });
        await page.close();
    });
});

describe('the hub on the same shell (5.11)', () => {
    const w = (file: string, line: number) => ({ file, line, hash: 'ab12cd34' });
    const payload = (): HubPayload => ({
        reader: 'hub',
        completeness: 'complete',
        findings: [],
        projects: [
            { id: 'aaaa-1', name: 'alpha', indexed: true, indexedAt: '2026-10-26', page: 'aaaa-1/index.html' },
            { id: 'bbbb-2', name: 'beta', indexed: false, page: null, pageReason: 'no map drawn yet' },
        ],
        edges: [{ source: 'aaaa-1', target: 'bbbb-2', via: 'package', detail: '@x/beta' }],
        ports: [{ port: '8080/tcp', uses: [{ project: 'aaaa-1', name: 'web', witness: w('docker-compose.yml', 5) }, { project: 'bbbb-2', name: 'api', witness: w('docker-compose.yml', 5) }] }],
        images: [],
        services: [],
        versions: [{ subject: 'npm:react', framework: true, differs: true, uses: [{ project: 'aaaa-1', name: '18.2.0', witness: w('package-lock.json', 9) }, { project: 'bbbb-2', name: '19.0.0', witness: w('package-lock.json', 9) }] }],
        calls: [
            { project: 'aaaa-1', service: 'beta', method: 'GET', path: '/api/v1/orders/{id}', witness: w('src/orders.ts', 2), match: { project: 'bbbb-2', route: 'GET /orders/:id', witness: w('src/app.ts', 6) } },
            { project: 'aaaa-1', service: 'beta', method: 'POST', path: '/audit-log', witness: w('src/orders.ts', 7), unmatched: 'no_endpoint_match' },
        ],
        skipped: [],
    });

    it('is the global-scope page: banner, registry, every link drawn by kind, and the picked link with both witnesses', async () => {
        const html = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hub-'))), 'index.html');
        roots.push(path.dirname(html));
        fs.writeFileSync(html, renderHub(payload(), path.dirname(html)));
        const page = await open(html);
        expect(await route(page)).toEqual({ route: 'projects', item: '' });
        expect(await page.locator('#areanav').isVisible()).toBe(false);
        expect(await page.locator('#hub-banner').textContent()).toMatch(/GLOBAL SCOPE[\s\S]*cg-hub-[\s\S]*this machine only/);
        expect(await page.locator('.brand-name.hub').textContent()).toContain('ESTATE MAP');
        expect(await page.locator('#pin-fresh').textContent()).toBe('2 projects · 1 indexed');
        expect(await page.locator('#banner').isVisible()).toBe(false);
        expect((await page.locator('#av-left-body .ops-regname').allTextContents()).sort()).toEqual(['alpha', 'beta']);
        expect((await page.locator('.ops-pnode .ops-pname').allTextContents()).sort()).toEqual(['alpha', 'beta']);
        for (const k of ['package', 'call', 'shared']) expect(await page.locator(`.ops-gsvg line.pe-${k}`).count()).toBe(1);
        // The call that lands on a route is the link picked first.
        expect(await page.locator('#av-right-body').textContent()).toMatch(/call → route[\s\S]*alpha → beta[\s\S]*alpha · src\/orders\.ts:2[\s\S]*beta · src\/app\.ts:6/);
        expect(await page.locator('#av-main').textContent()).toMatch(/Calls without a target \(1\)[\s\S]*POST \/audit-log[\s\S]*no route matches/);
        expect(await page.locator('#av-main').textContent()).toMatch(/Versions across projects \(1\)[\s\S]*npm:react[\s\S]*18\.2\.0[\s\S]*19\.0\.0[\s\S]*differs/);
        await page.locator('.ops-elabel', { hasText: '8080/tcp' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'edge/2');
        expect(await page.locator('#av-right-body').textContent()).toMatch(/shared host port[\s\S]*alpha · web · docker-compose\.yml:5[\s\S]*beta · api · docker-compose\.yml:5/);
        expect(await page.locator('.ops-gsvg line.pe-shared.on').count()).toBe(1);
        await page.fill('#search', 'alp');
        expect(await page.locator('#results button').first().textContent()).toMatch(/Projects · alpha/);
        await page.close();
        const odd = await open(html, '#/code');
        expect((await route(odd)).route).toBe('projects');
        await odd.close();
    });

    it('links a project to its page only where one exists, and renders in both languages and at every width', async () => {
        const html = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hub-'))), 'index.html');
        roots.push(path.dirname(html));
        fs.writeFileSync(html, renderHub(payload(), path.dirname(html)));
        const page = await open(html, '#/projects/project%2Faaaa-1');
        expect(await page.locator('#av-right-body a[href="aaaa-1/index.html"]').count()).toBe(1);
        await page.evaluate(() => { location.hash = '#/projects/project%2Fbbbb-2'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'project/bbbb-2');
        expect(await page.locator('#av-right-body a').count()).toBe(0);
        expect(await page.locator('#av-right-body').textContent()).toContain('no map drawn yet');
        await page.click('#lang');
        expect(await page.locator('#hub-scope').textContent()).toBe('GLOBALER SCOPE');
        expect(await page.locator('#search').getAttribute('placeholder')).toBe('Projekt, Paket, Vertrag …');
        expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/undefined|\[object Object\]|NaN/);
        await page.close();
        const problems: string[] = [];
        for (const scheme of ['dark', 'light'] as const) {
            for (const width of [1440, 375, 320]) {
                const p = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme });
                let errors = 0;
                p.on('pageerror', () => { errors += 1; });
                for (const hash of ['#/projects', '#/projects/edge%2F2', '#/projects/project%2Fbbbb-2']) {
                    await p.goto(`${pathToFileURL(html).href}${hash}`);
                    const scroll = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
                    if (errors || scroll) problems.push(`${scheme} ${width} ${hash}: errors ${errors}, scroll ${scroll}`);
                }
                await p.close();
            }
        }
        expect(problems).toEqual([]);
    });
});

describe('the overview', () => {
    it('one card per design layer, with the fact state and its reason, a filter and tours', async () => {
        const page = await open(full, '#/overview');
        expect(await page.locator('.ocard').count()).toBe(OVERVIEW_LAYERS);
        // Data holds a changed and a gone witness.
        expect(await page.locator('#ov-data').textContent()).toMatch(/contradicted[\s\S]*changed or gone/);
        expect(await page.locator('#ov-interfaces').textContent()).toMatch(/1 of 3/);
        expect(await page.locator('#ov-impact').textContent()).toMatch(/no data yet[\s\S]*No change preview was written/);
        expect(await page.locator('#ov-code').textContent()).toMatch(/never \(index only\)/);
        await page.click('.ov-filters button:has-text("With data")');
        expect(await page.locator('#ov-impact').count()).toBe(0);
        expect(await page.locator('#ov-data').count()).toBe(1);
        await page.click('.ov-filters button:has-text("Planned")');
        expect(await page.locator('#ov-impact').count()).toBe(1);
        expect(await page.locator('#ov-code').count()).toBe(0);
        // Tours are not on the handover's Übersicht (Decision D2).
        expect(await page.locator('#av-main').textContent()).not.toMatch(/Then the partner service/);
        await page.click('#ov-impact .otitle');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'impact');
        await page.close();
    });
});

describe('search covers every kind; a preset only narrows the kind', () => {
    it('finds a service and an operation, narrows to services, and opens the hit in its area', async () => {
        const page = await open(full, '#/code');
        await page.fill('#search', 'partner');
        const presets = page.locator('#kinds button');
        expect(await presets.count()).toBe(3);
        expect(await page.locator('#results button').count()).toBe(2);
        await presets.filter({ hasText: 'Services' }).click();
        expect(await page.inputValue('#search')).toBe('partner');
        expect((await route(page)).route).toBe('code');
        const hits = page.locator('#results button');
        expect(await hits.count()).toBe(1);
        expect(await hits.first().textContent()).toBe('Interfaces · partner');
        await hits.first().click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'service/partner');
        expect(await page.locator('#av-side').textContent()).toContain('PARTNER_URL');
        await page.close();
    });

    it('a file hit goes to Code from any area', async () => {
        const page = await open(full, '#/data');
        await page.fill('#search', 'b.ts');
        await page.locator('#results button', { hasText: /^b\.ts$/ }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'code');
        expect(await page.locator('#panel .fn').textContent()).toBe('b.ts');
        await page.close();
    });
});

describe('the freshness reason', () => {
    it('rides on the header chip while the graph is behind HEAD, on every area, with no banner row; none when fresh', async () => {
        for (const hash of ['', '#/overview', '#/data', '#/code']) {
            const page = await open(behind, hash);
            expect(await page.locator('#banner').isVisible()).toBe(false);
            expect(await page.locator('#pin-fresh').textContent()).toBe('behind:3');
            expect(await page.locator('#pin-fresh').getAttribute('title')).toMatch(/3 commit\(s\) behind HEAD[\s\S]*Confirm a witness/);
            await page.close();
        }
        const fresh = await open(full);
        expect(await fresh.locator('#pin-fresh').getAttribute('title')).toBeNull();
        await fresh.close();
    });
});

describe('the Code area refinements', () => {
    it('health in points of 25 with the largest lever, the six tiles, languages, the empty-state lists, deselect and the aggregation chip', async () => {
        const page = await open(empty, '#/code');
        const health = (await page.locator('#health').textContent()) ?? '';
        expect(health).toMatch(/\d+(\.\d+)?\/25/);
        expect(health).toMatch(/Largest lever: /);
        const kpis = (await page.locator('#kpis').textContent()) ?? '';
        for (const label of ['Files', 'Lines', 'Areas', 'Dead files', 'Routes resolved', 'Languages by lines']) expect(kpis).toContain(label);
        expect(await page.locator('#panel').textContent()).toMatch(/Pick a file[\s\S]*Most used/);
        const fileCount = await page.evaluate(() => (JSON.parse((document.getElementById('map-data') as HTMLElement).textContent as string) as { model: { files: unknown[] } }).model.files.length);
        expect(await page.locator('#foot').textContent()).toContain(`aggregated: ${fileCount} files in 1 area bubbles`);
        expect(await page.getAttribute('#search', 'placeholder')).toBe('File, symbol, table, service …');
        await page.fill('#search', 'a.ts');
        await page.locator('#results button', { hasText: /^a\.ts$/ }).click();
        expect(await page.locator('#panel .fn').textContent()).toBe('a.ts');
        await page.click('#deselect');
        expect(await page.locator('#panel').textContent()).toMatch(/Recently picked[\s\S]*a\.ts/);
        await page.close();
    });
});

describe('both languages', () => {
    it('every string key exists in English and German, with the same shape', async () => {
        const page = await open(full);
        const diff = await page.evaluate(() => {
            const s = (window as unknown as { __mapStrings: { en: Record<string, unknown>; de: Record<string, unknown> } }).__mapStrings;
            const out: string[] = [];
            function cmp(a: Record<string, unknown>, b: Record<string, unknown>, at: string): void {
                for (const k of Object.keys(a)) {
                    if (!(k in b)) out.push(`${at}${k} missing in de`);
                    else if (typeof a[k] !== typeof b[k]) out.push(`${at}${k} differs in type`);
                    else if (a[k] && typeof a[k] === 'object') cmp(a[k] as Record<string, unknown>, b[k] as Record<string, unknown>, `${at}${k}.`);
                }
                for (const k of Object.keys(b)) if (!(k in a)) out.push(`${at}${k} missing in en`);
            }
            cmp(s.en, s.de, '');
            return out;
        });
        expect(diff).toEqual([]);
        await page.close();
    });

    it('switching to German relabels the shell and every area page without an undefined', async () => {
        const page = await open(full, '#/overview');
        await page.click('#lang');
        expect(await page.locator('#areanav a[data-route="overview"]').textContent()).toBe('Übersicht');
        for (const r of ['overview', 'code', ...KNOWLEDGE_AREA_IDS]) {
            await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
            await page.waitForFunction((x) => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === x, r);
            expect(await page.evaluate(() => document.body.innerText), r).not.toMatch(/undefined|\[object Object\]|NaN/);
        }
        await page.close();
    });
});

describe('the area detail rail follows the Code rails', () => {
    const side = (page: Page) =>
        page.evaluate(() => {
            const el = document.getElementById('av-side') as HTMLElement;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { fixed: cs.position === 'absolute', visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.right > 1 && r.left < window.innerWidth - 1 };
        });

    it('pinned at 1440, a flyout with a scrim at 1100, in the flow and never pinned on a phone', async () => {
        const wide = await open(full, '#/data', { width: 1440 });
        expect(await side(wide)).toMatchObject({ fixed: false, visible: true });
        await wide.close();
        const tablet = await open(full, '#/data', { width: 1100 });
        expect(await side(tablet)).toMatchObject({ visible: false });
        await tablet.click('#av-open');
        expect(await side(tablet)).toMatchObject({ fixed: true, visible: true });
        expect(await tablet.locator('#av-scrim').isVisible()).toBe(true);
        await tablet.click('#av-scrim', { position: { x: 20, y: 400 } });
        expect(await side(tablet)).toMatchObject({ visible: false });
        await tablet.close();
        const phone = await open(full, '#/data', { width: 375, height: 812 });
        await phone.click('#av-open');
        expect(await side(phone)).toMatchObject({ fixed: false, visible: true });
        expect(await phone.locator('#av-pin').isVisible()).toBe(false);
        await phone.close();
    });
});

describe('every area renders at 1440, 375 and 320 px in both themes', () => {
    it('no page error, no request, no sideways scroll', async () => {
        const problems: string[] = [];
        for (const scheme of ['dark', 'light'] as const) {
            for (const width of [1440, 375, 320]) {
                for (const r of ['overview', 'code', ...KNOWLEDGE_AREA_IDS]) {
                    const page = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme });
                    let errors = 0;
                    let requests = 0;
                    const url = pathToFileURL(full).href;
                    page.on('pageerror', () => { errors += 1; });
                    page.on('request', (q) => { if (q.url().split('#')[0] !== url) requests += 1; });
                    await page.goto(`${url}#/${r}`);
                    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
                    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth > window.innerWidth, theme: document.documentElement.dataset['resolvedTheme'] }));
                    if (errors || requests || m.scroll || m.theme !== scheme) problems.push(`${scheme} ${width} ${r}: errors ${errors}, requests ${requests}, scroll ${m.scroll}, theme ${m.theme}`);
                    await page.close();
                }
            }
        }
        expect(problems).toEqual([]);
    });
});
