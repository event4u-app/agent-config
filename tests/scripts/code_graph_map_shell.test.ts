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
// payload, search over every kind, the freshness banner, both languages, and
// the page at every width in both themes.

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
        expect(await page.locator('.ocard').count()).toBe(1 + KNOWLEDGE_AREA_IDS.length);
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

    it('the Code breadcrumb starts at the map home', async () => {
        const page = await open(empty, '#/code');
        await page.click('#crumbs .crumb-map');
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'overview');
        expect(await page.locator('.ocard').count()).toBe(1 + KNOWLEDGE_AREA_IDS.length);
        await page.close();
    });
});

describe('an area without data is shown, says so and names the reason', () => {
    it('every knowledge area with no reader run', async () => {
        const page = await open(empty, '#/overview');
        for (const id of KNOWLEDGE_AREA_IDS) {
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
        expect(await page.locator('#av-main .av-head').textContent()).toMatch(/partial read — every count is a lower bound/);
        await page.locator('.db-col', { hasText: 'email' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'column/users.email');
        const detail = (await page.locator('#av-right-body').textContent()) ?? '';
        expect(detail).toContain('database/migrations/0001_create_users.php:14');
        expect(detail).toContain('changed');
        expect(await page.locator('#av-main .av-crumbs').textContent()).toContain('users.email');
        await page.locator('#av-main .av-crumbs button', { hasText: 'Data' }).click();
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
        expect(await page.locator('#av-main').textContent()).toMatch(/partner[\s\S]*soap[\s\S]*PARTNER_URL/);
        await page.click('#av-bar [role="tab"]:has-text("Operations")');
        expect(await page.locator('#av-main').textContent()).toMatch(/partner · GetStock/);
        await page.evaluate(() => { location.hash = '#/delivery'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'delivery');
        expect(await page.locator('#av-main').textContent()).toMatch(/Stage 1[\s\S]*test[\s\S]*Stage 2[\s\S]*deploy/);
        await page.evaluate(() => { location.hash = '#/agent'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'agent');
        expect(await page.locator('#av-main').textContent()).toContain('agent-config code-graph explain <seed>');
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

    it('shows Compose services and published ports from the Runtime payload, with a collision marked', async () => {
        const areas = sampleAreas();
        areas.runtime = services();
        const page = await open((await drawn(areas)).html, '#/delivery');
        const tabs = await page.locator('#av-bar [role="tab"]').allTextContents();
        expect(tabs[0]).toBe('Local environment');
        expect(tabs).toEqual(expect.arrayContaining(['Pipeline', 'Build → deploy', 'Findings']));
        const main = (await page.locator('#av-main').textContent()) ?? '';
        expect(main).toMatch(/web[\s\S]*nginx:1\.25[\s\S]*api[\s\S]*db/);
        expect(main).toMatch(/Published ports \(2\)/);
        expect(await page.locator('#av-main .tbl tbody tr').count()).toBe(3);
        expect(await page.locator('#av-main .tbl .st.bad').count()).toBe(2);
        expect(await page.locator('#av-bar').textContent()).toMatch(/3 services · 2 published ports · declared, never observed/);
        await page.locator('#av-main .tname', { hasText: 'db' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'local/db');
        expect(await page.locator('#av-detail').textContent()).toMatch(/docker-compose\.yml:15/);
        // The facts stay where the Runtime reader stored them.
        await page.evaluate(() => { location.hash = '#/runtime'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'runtime');
        await page.click('#av-bar [role="tab"]:has-text("Services")');
        expect(await page.locator('#av-main').textContent()).toMatch(/web[\s\S]*api[\s\S]*db/);
        await page.close();
    });

    it('is live with only the local environment when no delivery reader ran', async () => {
        const page = await open((await drawn({ runtime: services() })).html, '#/delivery');
        expect(await page.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Local environment']);
        expect(await page.locator('#nodata-delivery').count()).toBe(0);
        expect(await page.locator('#av-main').textContent()).toMatch(/web[\s\S]*8080\/tcp/);
        await page.close();
        const none = await open(empty, '#/delivery');
        expect(await none.locator('#nodata-delivery').isVisible()).toBe(true);
        await none.close();
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
        calls: [
            { project: 'aaaa-1', service: 'beta', method: 'GET', path: '/api/v1/orders/{id}', witness: w('src/orders.ts', 2), match: { project: 'bbbb-2', route: 'GET /orders/:id', witness: w('src/app.ts', 6) } },
            { project: 'aaaa-1', service: 'beta', method: 'POST', path: '/audit-log', witness: w('src/orders.ts', 7), unmatched: 'no_endpoint_match' },
        ],
        skipped: [],
    });

    it('routes only to Projects, draws the projects, the service map and the detail with both witnesses', async () => {
        const html = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hub-'))), 'index.html');
        roots.push(path.dirname(html));
        fs.writeFileSync(html, renderHub(payload()));
        const page = await open(html);
        expect(await route(page)).toEqual({ route: 'projects', item: '' });
        expect(await page.locator('#areanav a').allTextContents()).toEqual(['Projects']);
        expect(await page.locator('#pin-commit').textContent()).toMatch(/HUB/);
        expect(await page.locator('#banner').isVisible()).toBe(false);
        expect(await page.locator('.pgraph text.plabel').allTextContents()).toEqual(['alpha', 'beta']);
        expect(await page.locator('.pgraph line.pfact').count()).toBe(1);
        expect(await page.evaluate(() => (window as unknown as { __mapLabelBoxes: { boxes: unknown[] } }).__mapLabelBoxes.boxes.length)).toBe(2);
        await page.click('#av-bar [role="tab"]:has-text("Service map")');
        const calls = (await page.locator('#av-main').textContent()) ?? '';
        expect(calls).toMatch(/GET \/api\/v1\/orders\/\{id\}[\s\S]*beta · GET \/orders\/:id/);
        expect(calls).toMatch(/POST \/audit-log[\s\S]*no route matches/);
        await page.locator('#av-main .rowpick', { hasText: 'GET /api/v1/orders/{id}' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'call/0');
        expect(await page.locator('#av-detail').textContent()).toMatch(/alpha · src\/orders\.ts:2[\s\S]*beta · src\/app\.ts:6/);
        await page.click('#av-bar [role="tab"]:has-text("Port collisions")');
        expect(await page.locator('#av-main').textContent()).toMatch(/8080\/tcp[\s\S]*alpha[\s\S]*web[\s\S]*beta[\s\S]*api/);
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
        fs.writeFileSync(html, renderHub(payload()));
        const page = await open(html, '#/projects/project%2Faaaa-1');
        expect(await page.locator('#av-detail a[href="aaaa-1/index.html"]').count()).toBe(1);
        await page.evaluate(() => { location.hash = '#/projects/project%2Fbbbb-2'; });
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === 'project/bbbb-2');
        expect(await page.locator('#av-detail a').count()).toBe(0);
        expect(await page.locator('#av-detail').textContent()).toContain('no map drawn yet');
        await page.click('#lang');
        expect(await page.locator('#areanav a').allTextContents()).toEqual(['Projekte']);
        expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/undefined|\[object Object\]|NaN/);
        await page.close();
        const problems: string[] = [];
        for (const scheme of ['dark', 'light'] as const) {
            for (const width of [1440, 375, 320]) {
                const p = await browser.newPage({ viewport: { width, height: 800 }, colorScheme: scheme });
                let errors = 0;
                p.on('pageerror', () => { errors += 1; });
                for (const tab of ['', 'Service map', 'Port collisions']) {
                    await p.goto(`${pathToFileURL(html).href}#/projects`);
                    if (tab) await p.click(`#av-bar [role="tab"]:has-text("${tab}")`);
                    const scroll = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
                    if (errors || scroll) problems.push(`${scheme} ${width} ${tab || 'Projects'}: errors ${errors}, scroll ${scroll}`);
                }
                await p.close();
            }
        }
        expect(problems).toEqual([]);
    });
});

describe('the overview', () => {
    it('one card per area, with the fact state and its reason, a filter and tours', async () => {
        const page = await open(full, '#/overview');
        expect(await page.locator('.ocard').count()).toBe(1 + KNOWLEDGE_AREA_IDS.length);
        // Data holds a changed and a gone witness.
        expect(await page.locator('#ov-data').textContent()).toMatch(/contradicted[\s\S]*changed or gone/);
        expect(await page.locator('#ov-interfaces').textContent()).toMatch(/1 of 3/);
        expect(await page.locator('#ov-impact').textContent()).toMatch(/no data yet[\s\S]*No change preview was written/);
        expect(await page.locator('#ov-code').textContent()).toMatch(/never \(index only\)/);
        await page.click('.ov-filters button:has-text("With data")');
        expect(await page.locator('#ov-impact').count()).toBe(0);
        expect(await page.locator('#ov-data').count()).toBe(1);
        await page.click('.ov-filters button:has-text("No data yet")');
        expect(await page.locator('#ov-impact').count()).toBe(1);
        expect(await page.locator('#ov-code').count()).toBe(0);
        expect(await page.locator('#av-main').textContent()).toMatch(/Then the partner service\s*input changed/);
        await page.click('#ov-impact');
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
        expect(await page.locator('#av-detail').textContent()).toContain('PARTNER_URL');
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

describe('the freshness banner', () => {
    it('names the reason while the graph is behind HEAD, on every area, and is absent when fresh', async () => {
        for (const hash of ['', '#/overview', '#/data']) {
            const page = await open(behind, hash);
            expect(await page.locator('#banner').isVisible()).toBe(true);
            expect(await page.locator('#banner').textContent()).toMatch(/3 commit\(s\) behind HEAD[\s\S]*Confirm a witness/);
            await page.close();
        }
        const fresh = await open(full);
        expect(await fresh.locator('#banner').isVisible()).toBe(false);
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
            return { fixed: cs.position === 'fixed', visible: cs.visibility !== 'hidden' && r.right > 1 && r.left < window.innerWidth - 1 };
        });

    it('pinned at 1440, a flyout with a scrim at 1000, never pinned on a phone', async () => {
        const wide = await open(full, '#/data', { width: 1440 });
        expect(await side(wide)).toMatchObject({ fixed: false, visible: true });
        await wide.close();
        const tablet = await open(full, '#/data', { width: 1000 });
        expect(await side(tablet)).toMatchObject({ visible: false });
        await tablet.click('#av-open');
        expect(await side(tablet)).toMatchObject({ fixed: true, visible: true });
        expect(await tablet.locator('#av-scrim').isVisible()).toBe(true);
        await tablet.click('#av-scrim', { position: { x: 20, y: 400 } });
        expect(await side(tablet)).toMatchObject({ visible: false });
        await tablet.close();
        const phone = await open(full, '#/data', { width: 375, height: 812 });
        await phone.click('#av-open');
        expect(await side(phone)).toMatchObject({ fixed: true, visible: true });
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
