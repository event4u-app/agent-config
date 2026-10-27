import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Browser, Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap, renderHtml } from '../../src/scripts/code_graph/map.js';
import type { MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { sampleAreas } from './code_graph_map_areas_fixture.js';

// A control whose data is missing stays visible, says "no data" and names what is
// missing; the same control with data is an ordinary, working control.

let browser: Browser;
const roots: string[] = [];

async function mapOf(withGit: boolean): Promise<string> {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-nodata-')));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
    if (withGit) {
        const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, stdio: 'ignore' }); };
        git('init', '-q');
        git('add', '.');
        git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    }
    const res = await buildMap(root);
    return path.join(res.outDir, 'index.html');
}

async function open(html: string): Promise<Page> {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`${pathToFileURL(html).href}#/code`);
    await page.waitForFunction(() => (window as unknown as { __mapView?: unknown }).__mapView !== undefined);
    return page;
}

beforeAll(async () => {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ headless: true });
}, 120_000);
afterAll(async () => {
    await browser?.close();
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

describe('controls without data are labelled, never hidden', () => {
    it('without git history "Churn" is visible, disabled, labelled and names what is missing', async () => {
        const page = await open(await mapOf(false));
        const churn = page.locator('#colorby button', { hasText: 'Churn' });
        expect(await churn.isVisible()).toBe(true);
        expect(await churn.isDisabled()).toBe(true);
        expect(await churn.textContent()).toMatch(/no data/i);
        expect(await churn.getAttribute('title')).toMatch(/no data yet.*git history/i);
        await page.close();
    });

    it('with git history "Churn" is an ordinary control', async () => {
        const page = await open(await mapOf(true));
        const churn = page.locator('#colorby button', { hasText: 'Churn' });
        expect(await churn.isDisabled()).toBe(false);
        expect(await churn.textContent()).not.toMatch(/no data/i);
        await page.close();
    });

    it('the Flow lens and the Memory column say what is missing instead of a bare "?"', async () => {
        const page = await open(await mapOf(false));
        const flow = page.locator('#lenses button', { hasText: 'Flow' });
        expect(await flow.isVisible()).toBe(true);
        expect(await flow.textContent()).toMatch(/no view yet/i);
        await page.click('#lenses button:has-text("Knowledge")');
        // Knowledge needs a file: mark one through search.
        await page.fill('#search', 'a.ts');
        await page.locator('#results button', { hasText: /^a\.ts$/ }).click();
        await page.click('#lenses button:has-text("Knowledge")');
        expect(await page.locator('#lensview').textContent()).toMatch(/Memory\s*no data/i);
        await page.close();
    });
});

describe('a lane that ran and found nothing keeps its page (the 2026-10-bf real state)', () => {
    let html: string;
    let areas: MapAreas;
    beforeAll(async () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-skel-')));
        roots.push(root);
        fs.mkdirSync(path.join(root, 'agents'));
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
        const res = await buildMap(root);
        const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { meta: Parameters<typeof renderHtml>[1]; model: Parameters<typeof renderHtml>[0] };
        areas = sampleAreas();
        const data = areas.data as unknown as { empty?: string; tables: unknown[]; findings: Array<{ subject: string }> };
        data.empty = 'no migration, schema file, committed dump or snapshot was found';
        data.tables = [];
        data.findings = data.findings.map((f, i) => ({ ...f, subject: `tests/fixtures/app/Models/M${i}.php#M${i}` }));
        areas.impact = { reader: 'review-risk over the working diff', completeness: 'complete', empty: 'no change against HEAD', findings: [], rev: 'HEAD', changed: [], affected: [] } as unknown as MapAreas['impact'];
        html = path.join(res.outDir, 'skel.html');
        fs.writeFileSync(html, renderHtml(doc.model, doc.meta, areas));
    });
    async function at(hash: string): Promise<Page> {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
        await page.goto(`${pathToFileURL(html).href}${hash}`);
        await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
        return page;
    }

    it('skeleton: Data keeps one tab, its reader line, the four rungs and what it found anyway; Impact its revision line', async () => {
        const page = await at('#/data');
        expect(await page.locator('#av-main [role="tab"]').allTextContents()).toEqual(['ERD · noch keine Daten']);
        expect(await page.locator('#av-main [role="tab"]').getAttribute('aria-selected')).toBe('true');
        expect(await page.locator('.empty-card').count()).toBe(0);
        const card = page.locator('#nodata-data.empty-page');
        expect(await card.isVisible()).toBe(true);
        expect(await card.locator('.ep-head').textContent()).toBe('Noch keine Daten: no migration, schema file, committed dump or snapshot was found.');
        expect(await card.locator('.ep-rungs b').allTextContents()).toEqual(['T1', 'T2', 'T3', 'T4']);
        const fl = (areas.data as unknown as { findings: unknown[] }).findings.length;
        expect(await page.locator('.ep-foundh').textContent()).toBe(`Trotzdem gefunden · ${fl} Befunde`);
        expect(await page.locator('.ep-facts').textContent()).toMatch(/– alle aus Test-Fixtures$/);
        expect(await page.locator('.ep-row').count()).toBe(fl);
        expect(await page.locator('.ep-row .ep-model').first().textContent()).toBe('M0');
        const compl = (areas.data as unknown as { completeness: string }).completeness;
        expect(await page.locator('#av-main .av-barmeta').textContent()).toContain({ complete: 'vollständig', partial: 'teilweise', unknown: 'unbekannt' }[compl]);
        expect(await page.locator('#prov').textContent()).toMatch(/^Echte Daten · data\.json @ /);
        expect(await card.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/4px 0px 0px 0px inset$/);
        await page.close();
        const imp = await at('#/impact');
        expect(await imp.locator('#av-bar [role="tab"]').allTextContents()).toEqual(['Änderung · keine']);
        expect(await imp.locator('.ep-rev').textContent()).toBe('rev: HEAD · changed: 0 · affected: 0');
        expect(await imp.locator('#nodata-impact .ep-head').textContent()).toBe('Keine Änderung gegen HEAD – der Arbeitsbaum ist sauber.');
        expect(await imp.locator('.empty-card').count()).toBe(0);
        await imp.close();
    });

    it('skeleton sensitivity: with no reader at all the page is the no-data card, not the skeleton', async () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-skel0-')));
        roots.push(root);
        fs.mkdirSync(path.join(root, 'agents'));
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;\n');
        const none = path.join((await buildMap(root, { areas: {} })).outDir, 'index.html');
        const page = await browser.newPage({ locale: 'de-DE' });
        await page.goto(`${pathToFileURL(none).href}#/data`);
        await page.waitForFunction(() => (window as unknown as { __mapRoute?: unknown }).__mapRoute !== undefined);
        expect(await page.locator('.empty-card').count()).toBe(1);
        expect(await page.locator('.empty-page').count()).toBe(0);
        await page.close();
    });
});

