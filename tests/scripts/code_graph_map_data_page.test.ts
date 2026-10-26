/**
 * The Data area as the handed-over Database page: the Schema rail (scope with
 * no-data tags, the four source switches, the edge legend, the findings), the
 * ERD with its controls, the Drift and Migrations lenses, and the Detail rail
 * with its evidence, actions and links into Code — all from a payload, none
 * from the design's sample values.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import type { DataPayload, MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { wit } from './code_graph_map_areas_fixture.js';

let browser: Browser;
let html: string;
let bare: string;
const roots: string[] = [];

const mig = (n: string): string => `database/migrations/2024_03_11_00000${n}_create.php`;

function payload(): DataPayload {
    return {
        reader: 'data lane',
        completeness: 'complete',
        engine: 'pgsql',
        actualSources: ['agents/map/data/snapshot/default.sql'],
        erd: [{ cluster: 'orders', file: 'data/schema-orders.md', tables: ['orders', 'customers', 'invoices'] }],
        tables: [
            {
                name: 'customers',
                connection: 'default',
                models: ['app/Models/Customer.php'],
                witness: wit(mig('1'), 3),
                columns: [
                    { name: 'id', type: 'bigint', nullable: false, key: 'pk', family: 'integer', witness: wit(mig('1'), 4), actual: { type: 'bigint', nullable: false, family: 'integer', witness: wit('agents/map/data/snapshot/default.sql', 2) } },
                    { name: 'external_id', type: 'varchar(64)', nullable: false, family: 'text', witness: wit(mig('1'), 5), actual: { type: 'integer', nullable: false, family: 'integer', witness: wit('agents/map/data/snapshot/default.sql', 3) } },
                    { name: 'legacy', type: 'varchar', nullable: true, family: 'text', witness: wit(mig('1'), 6), actual: null },
                ],
            },
            {
                name: 'orders',
                connection: 'default',
                models: ['app/Models/Order.php'],
                witness: wit(mig('2'), 3),
                columns: [
                    { name: 'id', type: 'bigint', nullable: false, key: 'pk', witness: wit(mig('2'), 4) },
                    { name: 'customer_id', type: 'bigint', nullable: false, witness: wit(mig('2'), 5), code: { reads: [wit('app/Models/Order.php', 30)], writes: [] } },
                ],
            },
            {
                name: 'invoices',
                connection: 'default',
                models: [],
                witness: wit(mig('3'), 3),
                columns: [
                    { name: 'id', type: 'bigint', nullable: false, key: 'pk', witness: wit(mig('3'), 4) },
                    { name: 'customer_id', type: 'bigint', nullable: false, key: 'fk', witness: wit(mig('3'), 5) },
                ],
            },
        ],
        foreignKeys: [{ from: { table: 'invoices', column: 'customer_id' }, to: { table: 'customers', column: 'id' }, onDelete: 'cascade', onUpdate: 'restrict', witness: wit(mig('3'), 9) }],
        relations: [
            { kind: 'n:1', from: 'Order', to: 'Customer', key: 'customer_id', witness: wit('app/Models/Order.php', 12) },
            { kind: 'n:m', from: 'Order', to: 'Tag', witness: wit('app/Models/Order.php', 18) },
        ],
        findings: [
            {
                id: 'DR-1',
                severity: 'medium',
                subject: 'column:orders.customer_id',
                title: 'code relation without a foreign key',
                tier: 'advice',
                fix: 'ALTER TABLE orders ADD CONSTRAINT …',
                message: 'a relation joins on column:orders.customer_id, and no foreign key constrains it\nfix (proposal, never applied): ALTER TABLE orders ADD CONSTRAINT …',
                completeness: 'complete',
                witnesses: [wit('app/Models/Order.php', 12, 'confirmed'), wit(mig('2'), 5, 'changed')],
            },
            { id: 'DR-3', severity: 'medium', subject: 'app/Models/Tag.php#Tag', message: 'model Tag persists to no table', completeness: 'complete', witnesses: [wit('app/Models/Tag.php', 7)] },
        ],
    };
}

async function draw(areas: MapAreas): Promise<string> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-data-page-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'app/Models'), { recursive: true });
    fs.mkdirSync(path.join(root, 'agents'));
    for (const m of ['Order', 'Customer', 'Tag']) fs.writeFileSync(path.join(root, `app/Models/${m}.php`), `<?php\nclass ${m} {}\n`);
    const res = await buildMap(root, { areas });
    return path.join(res.outDir, 'index.html');
}

async function open(file: string, hash = '#/data', width = 1440, scheme: 'dark' | 'light' = 'dark'): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: scheme });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    (page as unknown as { errors: string[] }).errors = errors;
    await page.goto(pathToFileURL(file).href + hash);
    await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
    return page;
}
const item = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item);
const waitItem = (page: Page, v: string): Promise<unknown> => page.waitForFunction((x) => (window as unknown as { __mapRoute: { item: string } }).__mapRoute.item === x, v);

beforeAll(async () => {
    html = await draw({ data: payload() });
    const p = payload();
    bare = await draw({ data: { ...p, engine: undefined, actualSources: undefined, findings: [], tables: p.tables.map((tb) => ({ ...tb, columns: tb.columns.map((c) => ({ ...c, actual: undefined, code: undefined })) })) } as DataPayload });
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('the Schema rail', () => {
    it('scope, four source switches, the edge legend and the findings; a field no reader fills carries the no-data tag', async () => {
        const page = await open(html);
        const left = page.locator('#av-left-body');
        expect(await left.locator('.db-switch').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-src') + ':' + b.getAttribute('aria-checked')))).toEqual(['C:true', 'M:true', 'L:true', 'Q:false']);
        const text = (await left.textContent()) ?? '';
        expect(text).toMatch(/connection\s*default · pgsql/);
        expect(text).toMatch(/environment\s*no data/);
        expect(text).toContain('1 of 3 tables');
        expect(text).toMatch(/physical FK \(L\/M\)[\s\S]*ORM relation \(C\)[\s\S]*CASCADE/);
        expect(await left.locator('.db-find').allTextContents()).toEqual([expect.stringContaining('DR-1'), expect.stringContaining('DR-3')]);
        expect(await left.locator('.db-find[aria-pressed="true"]').textContent()).toContain('DR-1');
        await left.locator('.db-find', { hasText: 'DR-3' }).click();
        await waitItem(page, 'finding/1');
        expect(await page.locator('#av-right-body').textContent()).toContain('app/Models/Tag.php:7');
        const none = await open(bare);
        const t2 = (await none.locator('#av-left-body').textContent()) ?? '';
        expect(t2).toMatch(/engine\s*no data/);
        expect(await none.locator('.db-switch[data-src="L"] .nodata-tag').count()).toBe(1);
        expect(t2).toContain('No findings.');
        await page.close();
        await none.close();
    });
});

describe('the ERD', () => {
    it('draws every table with key markers, the cascade FK with its rules and an ORM relation without a FK, and a model with no table', async () => {
        const page = await open(html);
        expect(await page.locator('.db-table').evaluateAll((cs) => cs.map((c) => c.getAttribute('data-table')).sort())).toEqual(['customers', 'invoices', 'model:Tag', 'orders']);
        expect(await page.locator('.db-table[data-table="customers"] .db-col .k.PK').count()).toBe(1);
        expect(await page.locator('.db-table[data-table="invoices"] .db-col .k.FK').count()).toBe(1);
        expect(await page.locator('.db-edges line.cascade').count()).toBe(1);
        expect(await page.locator('.db-elabel.cascade').textContent()).toBe('FK · ON DELETE CASCADE');
        expect(await page.locator('.db-elabel.orm').allTextContents()).toEqual(['ORM only · no FK', 'ORM only · no FK']);
        expect(await page.locator('.db-table.ghost').textContent()).toContain('named by code, no table');
        // The column the picked finding is about is marked, its table carries the finding colour.
        expect(await page.locator('.db-table[data-table="orders"]').getAttribute('class')).toContain('hot');
        expect(await page.locator('.db-table[data-table="orders"] .db-col.hotcol').textContent()).toContain('customer_id');
        expect((page as unknown as { errors: string[] }).errors).toEqual([]);
        await page.close();
    });

    it('the source switches are the code ∣ intended ∣ actual overlay; differences are marked and switch off with their source', async () => {
        const page = await open(html);
        const cust = page.locator('.db-table[data-table="customers"]');
        expect(await cust.locator('.db-col.diff').textContent()).toContain('external_id');
        expect(await cust.locator('.db-col.gone').textContent()).toContain('legacy');
        await page.click('.db-switch[data-src="M"]');
        expect(await cust.locator('.db-col', { hasText: 'external_id' }).locator('.y').textContent()).toBe('integer');
        await page.click('.db-switch[data-src="L"]');
        expect(await cust.locator('.db-col.diff, .db-col.gone').count()).toBe(0);
        expect(await page.locator('.db-edges line.cascade').count()).toBe(0);
        await page.click('.db-switch[data-src="C"]');
        expect(await page.locator('.db-edges line.orm').count()).toBe(0);
        await page.click('.db-switch[data-src="Q"]');
        expect(await page.locator('.db-table[data-table="orders"] .db-col', { hasText: 'customer_id' }).locator('.y').textContent()).toBe('R1 W0');
        for (const s of ['M', 'L', 'C', 'Q']) await page.click(`.db-switch[data-src="${s}"]`);
        await page.close();
    });

    it('Lines, Columns and Layout change what is drawn; zoom and fit move the world', async () => {
        const page = await open(html, '#/data/table%2Fcustomers');
        await page.click('.db-seg[aria-label="Lines"] button[data-v="focus"]');
        expect(await page.locator('.db-table[data-table="model:Tag"]').getAttribute('class')).toContain('faded');
        expect(await page.locator('.db-table[data-table="invoices"]').getAttribute('class')).not.toContain('faded');
        expect(await page.locator('.db-table[data-table="orders"]').getAttribute('class')).not.toContain('faded');
        await page.click('.db-seg[aria-label="Lines"] button[data-v="off"]');
        expect(await page.locator('.db-edges line').count()).toBe(0);
        await page.click('.db-seg[aria-label="Lines"] button[data-v="all"]');
        await page.click('.db-seg[aria-label="Columns"] button[data-v="keys"]');
        expect(await page.locator('.db-table[data-table="customers"] .db-more').textContent()).toBe('+ 1 more column');
        await page.click('.db-seg[aria-label="Columns"] button[data-v="all"]');
        await page.click('.db-seg[aria-label="Layout"] button[data-v="domain"]');
        expect(await page.locator('.db-group span').allTextContents()).toEqual(expect.arrayContaining(['orders', 'code']));
        await page.click('.db-seg[aria-label="Layout"] button[data-v="grid"]');
        // A layout change fits the world on the next frame.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const z0 = await page.evaluate(() => (window as unknown as { __mapErd: { z: number } }).__mapErd.z);
        await page.click('.db-zoom button[aria-label="Zoom in"]');
        expect(await page.evaluate(() => (window as unknown as { __mapErd: { z: number } }).__mapErd.z)).toBeCloseTo(Math.min(3, z0 * 1.2), 5);
        expect(await page.locator('.db-zl').textContent()).toMatch(/^Zoom \d\.\d×$/);
        await page.close();
    });

    it('picking a table opens its detail with the model file and the way into Code', async () => {
        const page = await open(html);
        await page.locator('.db-table[data-table="orders"] .db-thead').click();
        await waitItem(page, 'table/orders');
        const detail = page.locator('#av-right-body');
        expect(await detail.textContent()).toMatch(/2 column\(s\) · 1 model file\(s\)/);
        await detail.locator('.frow.link', { hasText: 'app/Models/Order.php' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'code');
        await page.close();
    });
});

describe('the Detail rail on a finding', () => {
    it('kicker, title, severity, summary, both witnesses with badges, rule, reasons, and the three actions doing what an offline page can', async () => {
        const page = await open(html, '#/data/finding%2F0');
        const d = page.locator('#av-right-body');
        expect(await d.locator('.kick').textContent()).toBe('orders.customer_id · DR-1');
        expect(await d.locator('.ttl').textContent()).toBe('code relation without a foreign key');
        expect(await d.locator('.db-sum').textContent()).not.toContain('fix (proposal');
        expect(await d.locator('.db-ev .db-src').allTextContents()).toEqual(['C', 'M']);
        expect(await d.textContent()).toMatch(/source checked\s*no – required before a change/);
        expect(await d.textContent()).toMatch(/rule\s*DR-1 · advice/);
        expect(await d.textContent()).toContain('ALTER TABLE orders ADD CONSTRAINT');
        await d.locator('button', { hasText: 'Verify now' }).click();
        expect(await page.locator('#av-right-body .db-cmd').textContent()).toBe('agent-config code-graph confirm column:orders.customer_id');
        await page.locator('#av-right-body button', { hasText: 'Mark as intended' }).click();
        expect(JSON.parse((await page.locator('#av-right-body .db-cmd').textContent()) ?? '{}')).toEqual({ virtual_relations: [{ rule: 'DR-1', subject: 'column:orders.customer_id', reason: '…' }] });
        expect(await page.locator('#av-right-body').textContent()).toContain('AC only proposes.');
        await page.locator('#av-right-body button', { hasText: 'Open source' }).click();
        await page.waitForFunction(() => (window as unknown as { __mapRoute: { route: string } }).__mapRoute.route === 'code');
        await page.close();
    });
});

describe('the Drift and Migrations lenses', () => {
    it('Drift sets intended against the saved schema per column; other environments stay unverifiable', async () => {
        const page = await open(html);
        await page.click('#av-main [role="tab"]:has-text("Drift")');
        const grid = (await page.locator('.db-grid').textContent()) ?? '';
        expect(grid).toMatch(/customers\.external_id[\s\S]*varchar\(64\)[\s\S]*integer[\s\S]*unverifiable[\s\S]*Drift · type/);
        expect(grid).toMatch(/customers\.legacy[\s\S]*Drift · missing/);
        expect(grid).toMatch(/customers\.id[\s\S]*matching/);
        expect(grid).not.toContain('orders.customer_id');
        const none = await open(bare);
        await none.click('#av-main [role="tab"]:has-text("Drift")');
        expect(await none.locator('.db-grid .nodata-tag').count()).toBe(1);
        await page.close();
        await none.close();
    });

    it('Migrations lists each migration file by date with what it creates; the applied state is no data', async () => {
        const page = await open(html);
        await page.click('#av-main [role="tab"]:has-text("Migrations")');
        expect(await page.locator('.db-mig .file').allTextContents()).toEqual(['2024_03_11_000001_create.php', '2024_03_11_000002_create.php', '2024_03_11_000003_create.php']);
        expect(await page.locator('.db-mig .when').first().textContent()).toBe('2024-03-11');
        expect(await page.locator('.db-mig').nth(2).textContent()).toContain('create invoices · 2 column(s) · 1 FK');
        expect(await page.locator('.db-mig .nodata-tag').count()).toBe(3);
        await page.close();
    });
});

describe('every width and theme', () => {
    it('renders without a page error or a sideways scroll at 1440, 1000, 375 and 320 in both themes, both rails reachable on a phone', async () => {
        for (const width of [1440, 1000, 375, 320]) {
            for (const scheme of ['dark', 'light'] as const) {
                const page = await open(html, '#/data', width, scheme);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${scheme}`).toBe(true);
                expect((page as unknown as { errors: string[] }).errors, `${width} ${scheme}`).toEqual([]);
                if (width < 1240) {
                    await page.click('#av-open-left');
                    await page.locator('#av-left').waitFor({ state: 'visible', timeout: 2000 });
                }
                await page.close();
            }
        }
    }, 120_000);
});
